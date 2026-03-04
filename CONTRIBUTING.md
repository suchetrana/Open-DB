# Contributing to OpenDB Studio

Thank you for considering a contribution to OpenDB Studio. This document outlines the process and standards for contributing to the project.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Branching Strategy](#branching-strategy)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Code Standards](#code-standards)
- [Architecture Guidelines](#architecture-guidelines)
- [Issue Guidelines](#issue-guidelines)
- [Review Process](#review-process)
- [Areas Looking for Contributions](#areas-looking-for-contributions)
- [Questions?](#questions)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful, inclusive, and professional environment. Harassment, discrimination, and abusive behavior will not be tolerated. Maintainers reserve the right to remove, edit, or reject contributions that violate these standards.

---

## Getting Started

1. **Fork** the repository to your GitHub account
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/Open-DB.git
   cd Open-DB/open-db
   ```
3. **Install dependencies:**
   ```bash
   npm install
   ```
4. **Start the development server:**
   ```bash
   npm run dev
   ```
5. **Verify the build:**
   ```bash
   npm run build
   ```

---

## Development Setup

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | 18+ |
| npm | 9+ |
| Docker Desktop | Latest (for container features) |
| Git | 2.30+ |

### Project Layout

```
open-db/src/
├── main/         # Electron main process (Node.js)
│   ├── ipc/      # IPC channel handlers
│   └── services/ # Business logic services
├── preload/      # Context bridge (security boundary)
└── renderer/     # React frontend
    └── src/
        ├── components/  # UI components (layout, editor, sidebar, terminal, ui)
        ├── store/       # Zustand store
        └── types/       # TypeScript type definitions
```

### Key Files

| File | Purpose |
|---|---|
| `src/main/index.ts` | Electron entry point, window creation |
| `src/main/ipc/index.ts` | Registers all IPC handlers |
| `src/preload/index.ts` | Context bridge with 4 API namespaces |
| `src/renderer/src/store/useAppStore.ts` | Central Zustand store (~770 lines) |
| `src/renderer/src/types/index.ts` | All shared TypeScript types |
| `Claude.md` | Complete project context (read this first) |

---

## Branching Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable release branch. All PRs target this branch. |
| `feature/<name>` | New features (`feature/mysql-query-support`) |
| `fix/<name>` | Bug fixes (`fix/terminal-resize-crash`) |
| `refactor/<name>` | Code restructuring (`refactor/store-split`) |
| `docs/<name>` | Documentation changes (`docs/api-reference`) |

**Rules:**
- Never push directly to `main`
- Keep branches short-lived (aim to merge within a few days)
- Rebase on `main` before submitting a PR to avoid merge conflicts

---

## Commit Conventions

Use [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

| Type | Usage |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs` | Documentation only |
| `style` | Formatting, whitespace (no logic change) |
| `test` | Adding or updating tests |
| `chore` | Build config, dependencies, CI |
| `perf` | Performance improvement |

### Scopes

Use the relevant module: `main`, `renderer`, `preload`, `ipc`, `store`, `docker`, `database`, `terminal`, `editor`, `sidebar`, `ui`

### Examples

```
feat(docker): add MongoDB container log streaming
fix(database): handle connection timeout on slow networks
refactor(store): split useAppStore into domain slices
docs(readme): update architecture diagram
chore(deps): upgrade electron to v29
```

---

## Pull Request Process

### Before Submitting

1. **Read [Claude.md](Claude.md)** to understand the current architecture and conventions
2. Ensure your code builds without errors: `npm run build`
3. Test your changes manually (automated test suite is planned but not yet in place)
4. Update documentation if your change affects:
   - IPC channels (update `Claude.md` IPC section)
   - Store actions or state (update `Claude.md` Store section)
   - Component tree (update `Claude.md` UI section)
   - Types (update `Claude.md` Types section)

### PR Template

When opening a pull request, include:

```markdown
## Summary
Brief description of what this PR does.

## Changes
- List of specific changes made

## Type
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation
- [ ] Other

## Testing
Describe how you tested these changes.

## Screenshots
If applicable, include screenshots of UI changes.

## Related Issues
Closes #<issue-number>
```

### Review Criteria

PRs will be reviewed for:

- **Correctness** — Does it work as described?
- **Architecture alignment** — Does it follow existing patterns (singleton services, Zustand + Immer, IPC invoke pattern)?
- **Type safety** — Are TypeScript types used properly? No `any` without justification.
- **Code clarity** — Is the code readable without excessive comments?
- **Scope** — Does the PR do one thing well, or is it trying to do too much?

---

## Code Standards

### TypeScript

- Strict mode enabled. Do not use `// @ts-ignore` or `any` without a comment explaining why.
- Use interfaces for object shapes, type aliases for unions and intersections.
- Export types from `src/renderer/src/types/index.ts` — do not scatter type definitions across components.

### React Components

- Functional components only. No class components.
- Use the existing Zustand store for state — do not introduce local `useState` for data that other components need.
- Tailwind utility classes for styling. Use the custom color tokens defined in `tailwind.config.ts` (e.g., `bg-elevated`, `text-primary`, `border-default`).
- Use the `<Icon name="..." />` component for Material Symbols — do not import icon libraries.

### Electron / IPC

- All IPC uses `ipcMain.handle` / `ipcRenderer.invoke` (request-response). Push events use `webContents.send`.
- Add new channels to the appropriate handler file in `src/main/ipc/`.
- Expose new methods through `src/preload/index.ts` and update the `Window.electronAPI` type in `src/preload/index.d.ts`.
- Update `Claude.md` IPC channel count when adding or removing channels.

### Services

- Services are singletons exported as module-level instances.
- Services should not import from the renderer. Communication flows: Renderer -> IPC -> Service.

### Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Files (components) | PascalCase | `DatabaseExplorer.tsx` |
| Files (services) | kebab-case | `database.service.ts` |
| Files (handlers) | kebab-case | `database.handlers.ts` |
| React components | PascalCase | `EditorToolbar` |
| Store actions | camelCase | `connectToDatabase` |
| IPC channels | kebab-case with namespace | `db:get-schemas` |
| CSS/Tailwind tokens | kebab-case | `bg-surface-hover` |
| Tab IDs | `tab-` + random | `tab-a3f9x2` |
| Terminal IDs | `term-` + timestamp | `term-1709012345678` |
| Container names | `opendb-` prefix | `opendb-mypostgres` |

---

## Architecture Guidelines

### Adding a New Feature

1. **Backend service** — Add or extend a service in `src/main/services/`
2. **IPC handler** — Register channel(s) in `src/main/ipc/`
3. **Preload bridge** — Expose method(s) in `src/preload/index.ts`
4. **Type definitions** — Add interfaces in `src/renderer/src/types/index.ts`
5. **Store action** — Add action in `src/renderer/src/store/useAppStore.ts`
6. **Component** — Build or update component in `src/renderer/src/components/`
7. **Documentation** — Update `Claude.md` with new channels, actions, types

### Adding a New Database Engine

If you want to add support for a new database type (e.g., Cassandra query execution):

1. Add the driver dependency to `package.json`
2. Extend `DatabaseType` union in types
3. Implement connection/query logic in `database.service.ts`
4. Add Docker image config in `docker.service.ts`
5. Update the `Connections` and `DockerContainers` components
6. Test container creation, connection, and query execution

### Adding a New IPC Channel

1. Add handler in the appropriate file under `src/main/ipc/`
2. Add method to the correct namespace in `src/preload/index.ts`
3. Update type declarations in `src/preload/index.d.ts`
4. Update channel count in `Claude.md`

---

## Issue Guidelines

### Reporting Bugs

Include:
- Operating system and version
- Node.js version (`node -v`)
- Docker Desktop version (if applicable)
- Steps to reproduce
- Expected vs. actual behavior
- Error messages or screenshots

### Requesting Features

Include:
- Clear description of the feature
- Use case / motivation
- Proposed implementation approach (optional but helpful)
- Whether you are willing to implement it

### Labels

| Label | Meaning |
|---|---|
| `bug` | Confirmed bug |
| `feature` | New feature request |
| `good first issue` | Suitable for new contributors |
| `help wanted` | Maintainers would appreciate help |
| `documentation` | Docs improvement |
| `migration` | Related to Rust/Tauri migration |

---

## Review Process

1. A maintainer will review your PR within a reasonable timeframe
2. Feedback will be given as inline comments or a summary review
3. Address all requested changes and push updates to the same branch
4. Once approved, a maintainer will merge the PR
5. Your contribution will be included in the next release

---

## Areas Looking for Contributions

If you are looking for a place to start, these areas would benefit from contributions:

| Area | Description | Difficulty |
|---|---|---|
| MySQL query execution | Wire MySQL driver through editor execute flow | Medium |
| MongoDB query execution | Wire MongoDB driver or mongosh through IPC | Medium |
| Query history UI | Build a panel to browse saved query history from SQLite | Easy |
| Result export | Implement CSV and JSON export from results grid | Easy |
| Terminal resize | Integrate `node-pty` for proper PTY resize handling | Medium |
| Search/replace | Wire the existing search UI to file content search | Medium |
| Test infrastructure | Set up Vitest + Playwright for unit and e2e tests | Medium |
| Settings panel | Build a settings UI backed by the existing SQLite table | Easy |
| Rust migration prep | Identify and isolate service boundaries for Tauri port | Hard |

---

## Questions?

Open a GitHub Issue with the `question` label, or start a Discussion thread. We are happy to help you get oriented.
