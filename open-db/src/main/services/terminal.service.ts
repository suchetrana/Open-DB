/**
 * TerminalService – manages shell / Docker exec sessions
 *
 * Architecture inspired by VS Code's terminal backend
 * (src/vs/platform/terminal/node/terminalProcess.ts):
 *
 *   Renderer (xterm.js)  ←—IPC—→  Main (TerminalService)  ←—→  Process / Docker stream
 *
 * Two session types:
 *   1. Local shell  – child_process.spawn (powershell / bash)
 *   2. Docker exec  – dockerode exec with TTY stream
 */
import { spawn, type ChildProcess } from 'child_process'
import os from 'os'
import { BrowserWindow } from 'electron'
import { dockerService } from './docker.service'

export interface TerminalSession {
  id: string
  type: 'local' | 'docker'
  process: ChildProcess | null
  stream: NodeJS.ReadWriteStream | null
}

class TerminalService {
  private sessions = new Map<string, TerminalSession>()

  /** Spawn a local shell (PowerShell on Windows, bash/zsh elsewhere) */
  createLocal(id: string, cwd?: string): void {
    const shell =
      process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash'
    const args = process.platform === 'win32' ? ['-NoLogo', '-NoProfile'] : []

    const proc = spawn(shell, args, {
      cwd: cwd || os.homedir(),
      env: { ...process.env, TERM: 'xterm-256color' },
      stdio: ['pipe', 'pipe', 'pipe']
    })

    const session: TerminalSession = { id, type: 'local', process: proc, stream: null }
    this.sessions.set(id, session)

    const send = (data: string) => this.sendToRenderer(id, data)

    proc.stdout?.on('data', (buf: Buffer) => send(buf.toString()))
    proc.stderr?.on('data', (buf: Buffer) => send(buf.toString()))
    proc.on('exit', (code) => {
      send(`\r\n\x1b[90m[Process exited with code ${code ?? 0}]\x1b[0m\r\n`)
      this.sendExitToRenderer(id)
      this.sessions.delete(id)
    })
  }

  /** Attach to a Docker container (docker exec -it … /bin/sh) */
  async createDocker(id: string, containerId: string, cmd?: string[]): Promise<void> {
    const stream = await dockerService.createExecStream(containerId, cmd)

    const session: TerminalSession = { id, type: 'docker', process: null, stream }
    this.sessions.set(id, session)

    const send = (data: string) => this.sendToRenderer(id, data)

    stream.on('data', (buf: Buffer) => send(buf.toString()))
    stream.on('end', () => {
      send('\r\n\x1b[90m[Connection closed]\x1b[0m\r\n')
      this.sendExitToRenderer(id)
      this.sessions.delete(id)
    })
    stream.on('error', (err: Error) => {
      send(`\r\n\x1b[31m[Error: ${err.message}]\x1b[0m\r\n`)
    })
  }

  /** Write data from xterm.js into the process / stream stdin */
  write(id: string, data: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    if (session.type === 'local' && session.process) {
      session.process.stdin?.write(data)
    } else if (session.type === 'docker' && session.stream) {
      session.stream.write(data)
    }
  }

  /** Resize (only effective with real PTY; stub for child_process) */
  resize(_id: string, _cols: number, _rows: number): void {
    // With node-pty this would call pty.resize(cols, rows)
    // child_process.spawn doesn't support resize – no-op for now
  }

  /** Kill / close a terminal session */
  close(id: string): void {
    const session = this.sessions.get(id)
    if (!session) return

    if (session.type === 'local' && session.process) {
      session.process.kill()
    } else if (session.type === 'docker' && session.stream) {
      session.stream.end()
    }

    this.sessions.delete(id)
  }

  // ── IPC helpers ──

  private sendToRenderer(sessionId: string, data: string): void {
    const wins = BrowserWindow.getAllWindows()
    for (const win of wins) {
      win.webContents.send('terminal:data', sessionId, data)
    }
  }

  private sendExitToRenderer(sessionId: string): void {
    const wins = BrowserWindow.getAllWindows()
    for (const win of wins) {
      win.webContents.send('terminal:exit', sessionId)
    }
  }
}

export const terminalService = new TerminalService()
