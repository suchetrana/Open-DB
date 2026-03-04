/**
 * Docker IPC Handlers
 */
import { ipcMain } from 'electron'
import { dockerService, type CreateContainerOpts } from '../services/docker.service'

export function registerDockerHandlers(): void {
  ipcMain.handle('docker:status', async () => {
    await dockerService.checkStatus()
    return { available: dockerService.available }
  })

  ipcMain.handle('docker:list-containers', async () => {
    return dockerService.listContainers()
  })

  ipcMain.handle('docker:create-container', async (_e, opts: CreateContainerOpts) => {
    return dockerService.createContainer(opts)
  })

  ipcMain.handle('docker:start-container', async (_e, id: string) => {
    await dockerService.startContainer(id)
    return { ok: true }
  })

  ipcMain.handle('docker:stop-container', async (_e, id: string) => {
    await dockerService.stopContainer(id)
    return { ok: true }
  })

  ipcMain.handle('docker:remove-container', async (_e, id: string) => {
    await dockerService.removeContainer(id)
    return { ok: true }
  })

  ipcMain.handle('docker:logs', async (_e, id: string, tail?: number) => {
    return dockerService.getLogs(id, tail)
  })
}
