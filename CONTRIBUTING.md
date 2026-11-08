# Contributing to Worship Studio

Thank you for considering a contribution! Worship Studio is an offline-first worship presentation tool for churches. Your help makes it better for everyone.

## Development Setup

### Prerequisites
- **Node.js 24** (LTS recommended)
- **Git**
- **Windows desktop** for Electron validation and Windows packaging. Other platforms are not currently validated.

### Quick Start
```bash
git clone https://github.com/cjw21332/worship-studio.git
cd worship-studio
npm ci
npm run dev          # Build + launch Electron
npm run test         # Run unit tests
npm run typecheck    # TypeScript strict check
npm run build        # Production build
```

### Project Structure
```
frontend/          # React UI (Vite + React 19 + TypeScript)
  ui-v2/           # Main workspace (Library/Service/Presentation)
  tutorial/        # Interactive walkthrough
backend/           # Electron main process + workers (TypeScript + Node)
  *.ts             # Core modules (database, presentation, outputs, etc.)
packaging/         # Installer assets, icons, entitlements
scripts/           # Build helpers, validation checks
tests/             # Unit tests (tsx --test)
```

## Code Standards

- **TypeScript strict mode** — no `any`, explicit types
- **Zod schemas** for all IPC boundaries (see `backend/main.ts`)
- **Drizzle ORM** for SQLite — migrations in `database.ts`
- **React 19** + **Zustand** for state — hooks in `frontend/*.tsx`
- **CSS Variables** for theming — `frontend/tokens.css`, `desk-colors.css`
- **Conventional Commits**: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`

## Pull Request Process

1. **Fork** the repo and create a branch: `git checkout -b feat/your-feature`
2. **Develop** with `npm run dev` to build and launch the app
3. **Test**: `npm run typecheck && npm test && npm run build`
4. **Commit** with conventional messages
5. **Push** and open a PR against `main`
6. **CI** must pass (typecheck, tests, build, packaging test)

### PR Checklist
- [ ] TypeScript compiles without errors (`npm run typecheck`)
- [ ] All tests pass (`npm test`)
- [ ] Production build succeeds (`npm run build`)
- [ ] Windows packaging test passes (`npm run package:dir`)
- [ ] New features have tests
- [ ] Breaking changes documented in PR description
- [ ] UI changes tested in both Simple and Full mode

## Architecture Guidelines

### IPC Communication
- All main↔renderer messages go through `preload.ts` with Zod validation
- Use `ipcMain.handle` (invoke) for request/response
- Use `ipcMain.on` + `webContents.send` for events
- Never expose Node/Electron APIs directly to renderer

### State Management
- **Backend**: Single source of truth in `main.ts` `state` (Presentation)
- **Frontend**: Zustand store synced via `presentation:state` events
- **Workers**: Bible/Media workers communicate via `postMessage`

### Database (SQLite + Drizzle)
- Schema in `backend/database.ts` with `sqliteTable`
- Migrations via `PRAGMA user_version` (see `openStore`)
- WAL mode enabled for concurrency
- JSON columns for flexible metadata (validated by Zod on read)

### Theming
- CSS variables in `frontend/tokens.css` (primitive) + `desk-colors.css` (semantic)
- Theme configs in `backend/themes.ts` — cascading: global → content-type → item → slide
- Live preview via `SlideRenderer` with computed styles

## Testing

```bash
npm test                    # Unit tests (tsx --test)
npm run test:coverage       # Coverage report
node scripts/startup-check.cjs
node scripts/text-styles-check.cjs
```

### Writing Tests
- Place in `tests/*.test.ts`
- Use `import { test, assert } from 'node:test'`
- Mock IPC with test doubles (see `tests/bible-selection.test.ts`)

## Release Process

Maintainers only:
Follow the Windows release acceptance checklist in `VALIDATION.md`. CI checks and packages an unpacked Windows build; it does not sign, publish releases, or configure an update feed. A release owner must arrange and verify those steps separately.

## License

By contributing, you agree your contributions are licensed under the **MIT License** (see `LICENSE`).

## Questions?

- Open a [GitHub Discussion](https://github.com/cjw21332/worship-studio/discussions)
- Check [VALIDATION.md](VALIDATION.md) for test coverage details
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for system overview (TODO)
