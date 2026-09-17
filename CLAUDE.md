# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive web-based Opencode client (forked from claude-code-viewer via codex-viewer) that provides complete interactive functionality for managing Opencode projects. Users can start new conversations, resume existing sessions, monitor running tasks in real-time, and browse conversation history through a modern web interface.

## Development Commands

**Start development server:**
```bash
pnpm dev
```
Runs Next.js on port 3400 with Turbopack for fast development.

**Build and type checking:**
```bash
pnpm build      # Next.js standalone build + asset copying via scripts/build.sh
pnpm typecheck  # TypeScript compilation check (noEmit)
```

**Linting and formatting:**
```bash
pnpm lint       # Run format and lint checks sequentially (biome format + biome check)
pnpm fix        # Auto-fix format and lint issues with unsafe fixes
```

**Testing:**
```bash
pnpm test       # Run all tests once with Vitest
pnpm test:watch # Run tests in watch mode
```

## Architecture Overview

### Technology Stack
- **Frontend**: Next.js 15.3.4 with React 19.1.1, TypeScript (strict mode via @tsconfig/strictest)
- **Backend**: Hono.js 4.9.5 API routes served via Next.js API routes with Zod validation
- **Styling**: Tailwind CSS 4.1.12 with shadcn/ui components (Radix UI primitives)
- **Data fetching**: TanStack Query 5.85.5 with Suspense integration and error boundaries
- **State management**: Jotai 2.13.1 atoms for client-side filtering and UI state
- **Validation**: Zod 4.1.5 schemas with modular conversation parsing
- **Code formatting**: Biome 2.2.2 (replaces ESLint + Prettier)
- **Testing**: Vitest 3.2.4 with global test setup
- **Package manager**: pnpm 10.8.1

### Core Architecture Patterns

**API Layer**: Hono.js app mounted at `/api` with type-safe routes:
- `/api/projects` - List all Opencode projects
- `/api/projects/:projectId` - Get project details and sessions
- `/api/projects/:projectId/sessions/:sessionId` - Get session conversations
- `/api/projects/:projectId/new-session` - Start new Opencode task
- `/api/projects/:projectId/sessions/:sessionId/resume` - Resume existing session
- `/api/tasks/abort` - Abort running task
- `/api/tasks/alive` - Get all running tasks
- `/api/events/state_changes` - Server-Sent Events for real-time updates

**Data Flow**:
1. Backend reads JSONL files from `~/.local/share/opencode/storage/session/` (configurable via `OPENCODE_STORAGE_ROOT`)
2. Parses and validates conversation entries with Zod schemas
3. Frontend fetches via type-safe API client with TanStack Query
4. Real-time updates via Server-Sent Events for file system changes and task updates

**Opencode Integration**:
- `CodexTaskController` (`src/server/service/codex/`) manages Opencode process lifecycle
- Spawns `opencode run --format json` commands with session management
- Handles session creation, resumption, and task abortion
- Tracks running tasks with unique IDs (ULID) and emits status changes via EventBus

### File Structure Patterns

**Server Services** (`src/server/service/`):
- `codex/`: Codex/Opencode task management, session parsing, and process control
- `opencode/`: Opencode-specific utilities and integrations
- `project/`: Project operations (getProjects, getProject, getProjectMeta)
- `session/`: Session operations (getSessions, getSession, getSessionMeta)
- `events/`: EventBus singleton and FileWatcherService for real-time monitoring
- `git/`: Git operations (branches, commits, diff) for project context
- `mcp/`: MCP list management for Opencode integrations
- `paths.ts`: Centralized storage path configuration (XDG-compliant, env-overridable)

**Conversation Schema** (`src/lib/conversation-schema/`):
- Modular Zod schemas for User, Assistant, Summary, System entry types
- Union types for flexible conversation parsing
- Separate schemas for content types (Text, ToolUse, ToolResult, Thinking)

**Frontend Components**:
- App router pages in `src/app/projects/[projectId]/`
- Session components in dynamic routes with modular structure
- Reusable UI components in `src/components/ui/`
- Custom hooks: `useServerEvents`, `useTaskNotifications`, `useFileCompletion`

### Key Features

**Real-time Updates**:
- FileWatcherService singleton monitors `~/.local/share/opencode/storage/session/` using Node.js `fs.watch()`
- Server-Sent Events via Hono's `streamSSE()` for live UI updates
- Event types: `connected`, `project_changed`, `session_changed`, `task_changed`, `heartbeat`
- Automatic TanStack Query cache invalidation when files are modified
- Heartbeat mechanism (30s intervals) for connection health monitoring

**Task Management**:
- Start new Opencode sessions or resume existing ones
- Monitor running tasks with live status updates
- Abort tasks via UI with proper process cleanup
- Track task status: running, completed, failed, waiting
- Automatic cleanup on server shutdown via prexit hooks
- Queue system for sequential task execution per session

**Command Autocompletion**:
- Parses available commands from conversation history
- Supports both global and local Opencode commands
- XML-like command structure parsing for enhanced display
- File path completion for improved developer experience

### Development Notes

- Biome handles all code formatting and linting (no ESLint/Prettier)
- Strict TypeScript with `exactOptionalPropertyTypes: false` for flexibility
- Vitest with global test setup in `src/test-setups/vitest.setup.ts`
- TanStack Query for server state with React Suspense boundaries
- Jotai atoms for client-side state management
- React 19 with progressive loading and error boundaries
- Storage paths follow XDG Base Directory spec, override with `OPENCODE_STORAGE_ROOT`