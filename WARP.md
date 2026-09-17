# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

Opencode Viewer is a full-featured web client for Opencode projects built with Next.js 15, React 19, and Hono. It provides real-time session monitoring, project exploration, and conversation timeline viewing synchronized with `~/.local/share/opencode/storage/`.

## Common Commands

### Development
```bash
pnpm install          # Install dependencies (requires Node 20.12+)
pnpm dev             # Start dev server with Turbopack on http://localhost:3400
pnpm start           # Run the bundled CLI binary from dist/
```

### Testing & Quality Gates
```bash
pnpm test            # Run Vitest unit/integration tests
pnpm test:watch      # Run tests in watch mode
pnpm typecheck       # Run TypeScript compiler checks (tsc --noEmit)
pnpm lint            # Run Biome format and lint checks
pnpm fix             # Auto-fix Biome format and lint issues
```

### Building
```bash
pnpm build           # Execute scripts/build.sh to create standalone CLI bundle
```

The build process:
1. Runs `next build` to create production bundle
2. Copies `public/` and `.next/static/` into `.next/standalone/`
3. Moves standalone output to `dist/` for CLI distribution

### Running Tests
```bash
# Run all tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Run specific test file
pnpm test path/to/test.test.ts
```

Test configuration lives in `vitest.config.ts` with setup files in `src/test-setups/`.

## Architecture & Key Concepts

### Directory Structure
```
src/
├── app/                    # Next.js 15 routes (App Router)
│   ├── api/               # API route handlers that delegate to Hono
│   ├── projects/          # Project list and detail pages
│   └── [route]/           # Other page routes
├── components/
│   └── ui/                # Atomic UI primitives (Button, Card, etc.)
├── lib/
│   ├── conversation-schema/ # Zod schemas for sessions, messages, parts
│   ├── api/               # Frontend API client utilities
│   ├── atoms/             # Jotai state atoms
│   └── sse/               # SSE client utilities
├── server/
│   ├── hono/              # Hono app configuration and routes
│   ├── service/           # Backend business logic
│   │   ├── events/        # EventBus and file watcher (SSE)
│   │   ├── opencode/      # Session/message/part file readers
│   │   ├── project/       # Project aggregation and indexing
│   │   └── session/       # Session state and history
│   └── config/            # Server configuration
└── utils/                 # Shared utility functions
```

### Hybrid API Architecture

**Next.js API Routes + Embedded Hono:**
- API routes live in `src/app/api/[[...route]]/route.ts`
- They delegate to a Hono app defined in `src/server/hono/app.ts`
- Hono provides type-safe routing, middleware, and request validation
- Routes are registered in `src/server/hono/route.ts`
- This pattern allows using Hono's ecosystem while maintaining Next.js compatibility

### Real-time Updates via SSE

**EventBus Pattern:**
- Singleton `EventBus` (src/server/service/events/EventBus.ts) manages all SSE events
- `FileWatcherService` monitors three directories:
  - `session/` - Session metadata changes
  - `message/` - New conversation turns
  - `part/` - Streaming message fragments
- Events flow: File system change → FileWatcher → EventBus → SSE stream → React Query invalidation

**Event Types:**
- `project_changed` - Emitted when any session in a project updates
- `session_changed` - Emitted for specific session modifications
- Both events carry `projectId`, `sessionId`, and `fileEventType` ("change" | "rename")

### Data Layer

**Zod Schemas as Single Source of Truth:**
- All conversation types defined in `src/lib/conversation-schema/`
- Schemas mirror on-disk JSON structure from `~/.local/share/opencode/storage/`
- TypeScript types are inferred from Zod schemas, not manually maintained
- Key schemas:
  - `AssistantEntrySchema` / `UserEntrySchema` - Conversation turns
  - `ToolUseContentSchema` / `ToolResultContentSchema` - Tool invocations
  - `ThinkingContentSchema` - Model reasoning steps

**Storage Paths:**
- Managed by `src/server/service/paths.ts`
- Default: `~/.local/share/opencode/storage/` (Linux/macOS)
- Override with `OPENCODE_STORAGE_ROOT` environment variable
- Directory structure: `session/*.json`, `message/*/*.json`, `part/*/*.json`

### Frontend State Management

**TanStack Query + Jotai:**
- React Query handles server state (sessions, projects, messages)
- Jotai atoms manage client-side UI state (filters, layout preferences)
- Suspense boundaries wrap async data fetching
- SSE events trigger React Query cache invalidation for live updates

## Code Style & Conventions

### Naming
- Components: `PascalCase.tsx`
- Utilities: `camelCase.ts`
- Constants: `SCREAMING_SNAKE_CASE`
- Atomic UI components: suffix with `Atom` (e.g., `ButtonAtom.tsx`)

### Formatting
- Two-space indentation, double quotes, sorted imports (enforced by Biome)
- Run `pnpm fix` before committing
- Biome config in `biome.json`

### Testing
- Co-locate tests beside source: `feature.test.ts` or `Component.test.tsx`
- Mock utilities and fixtures in `src/test-setups/`
- Run `pnpm test && pnpm typecheck` before PRs

### Module Organization
Each route keeps related code co-located:
```
src/app/projects/[id]/
├── page.tsx           # Route component
├── hooks.ts           # Route-specific hooks
├── components.tsx     # Local components
└── service.ts         # Data fetching logic
```

This keeps changes reviewable and prevents sprawling directories.

## Environment Variables

```bash
# Server configuration
PORT=3400                          # Dev server port
OPENCODE_STORAGE_ROOT=~/.local/... # Override default storage path

# CLI behavior
CC_VIEWER_NO_AUTO_OPEN=1          # Disable auto browser launch
NO_AUTO_OPEN=1                    # Alternative disable flag
NO_AUTO_BROWSER=1                 # Alternative disable flag
```

## Development Tips

### Working with Sessions
- Session files are read-only from the viewer's perspective
- UI updates happen automatically when Opencode writes to disk
- To test live updates, run an Opencode agent in parallel and watch the viewer

### Debugging SSE
- Check browser DevTools → Network → `events` for SSE connection status
- Server logs show file watcher events and EventBus emissions
- React Query DevTools available in development mode

### Adding New API Routes
1. Add route handler in `src/server/hono/route.ts`
2. Define Zod validation schema if accepting input
3. Add frontend client in `src/lib/api/`
4. Wire to React Query hook with proper cache keys

### CLI Development
- Entry point: `dist/index.js` (generated by build)
- Standalone mode: `node dist/index.js`
- Test CLI changes: `pnpm build && pnpm start`
- Do not delete or rename `dist/index.js` - breaks `npx @nogataka/opencode-viewer`

## Commit Conventions

Use Conventional Commits format:
- `feat: add session timeline`
- `fix: resolve SSE reconnection bug`
- `docs: update API examples`
- `refactor: extract watcher logic`

Reference issues with `#123` when applicable.

## Pre-PR Checklist

1. Run `pnpm fix` to auto-format code
2. Run `pnpm typecheck` to verify types
3. Run `pnpm test` to ensure tests pass
4. Test build with `pnpm build`
5. Document new environment variables or breaking changes
6. Attach screenshots for UI changes or terminal output for CLI changes
