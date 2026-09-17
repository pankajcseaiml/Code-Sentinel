# Model and Agent Selection Feature Implementation

## Overview
Successfully implemented model and agent selection capabilities in the OpenCode web-ui, allowing users to choose specific AI models and agents when starting new chat sessions.

## Changes Made

### Backend Changes

#### 1. Service Layer (`src/server/service/opencode/`)
- **`getModels.ts`**: Fetches available models from OpenCode CLI using `opencode models` (parses plain text output)
- **`getAgents.ts`**: Returns available agents (build, plan) with their descriptions

#### 2. API Routes (`src/server/hono/route.ts`)
- Added `GET /opencode/models` endpoint to list available models
- Added `GET /opencode/agents` endpoint to list available agents
- Updated `POST /projects/:projectId/new-session` to accept optional `model` and `agent` parameters
- Updated `POST /projects/:projectId/sessions/:sessionId/resume` to accept optional `model` and `agent` parameters

#### 3. Task Controller (`src/server/service/opencode/taskController.ts`)
- Updated `StartSessionOptions` and `LaunchOptions` types to include `model` and `agent` fields
- Modified `launchProcess` to pass `--agent` and `--model` flags to OpenCode CLI when provided

### Frontend Changes

#### 1. Hooks (`src/app/hooks/`)
- **`useModelsAndAgents.ts`**: Created React Query hooks for fetching models and agents
  - `useModels()`: Fetches and caches available models
  - `useAgents()`: Fetches and caches available agents

#### 2. UI Components (`src/components/`)
- **`ModelSelector.tsx`**: Dropdown component for selecting AI models
  - Groups models by provider
  - Shows loading and error states
  - Optional selection with placeholder
- **`AgentSelector.tsx`**: Dropdown component for selecting agents
  - Displays agent descriptions
  - Shows loading and error states
  - Optional selection with placeholder

#### 3. Chat Interface (`src/app/projects/[projectId]/components/`)
- **`NewChat.tsx`**: Updated to include model and agent selectors
  - Added state management for selected model and agent
  - Integrated selectors into the UI with responsive grid layout
  - Passes selections to the mutation
- **`ResumeChat.tsx`**: Updated to include model and agent selectors above chat input
  - Added state management for selected model and agent
  - Integrated selectors with compact design using smaller text
  - Passes selections when resuming conversations
- **`useChatMutations.ts`**: Updated mutations to accept and send model/agent parameters
  - `useNewChatMutation`: Now accepts `model` and `agent` options
  - `useResumeChatMutation`: Now accepts `model` and `agent` options

## How It Works

### User Flow
1. User opens "New Chat" dialog
2. User optionally selects a model from the dropdown (grouped by provider)
3. User optionally selects an agent from the dropdown
4. User types their message
5. On submit, the selected model and agent are passed to OpenCode CLI

### OpenCode CLI Integration
The implementation passes model and agent selections to OpenCode using CLI flags:
```bash
opencode run --format json --agent <agent-name> --model <provider/model> "<message>"
```

### API Communication
```typescript
// Frontend → Backend
POST /projects/:projectId/new-session
{
  "message": "user message",
  "model": "anthropic/claude-3-5-sonnet-20241022",  // optional
  "agent": "build"                                   // optional
}

// Backend → OpenCode CLI
opencode run --format json --agent build --model anthropic/claude-3-5-sonnet-20241022 "user message"
```

## Features
- **Optional Selection**: Both model and agent are optional - users can rely on OpenCode defaults
- **Grouped Models**: Models are grouped by provider for better organization
- **Descriptive Agents**: Agent descriptions help users understand each agent's purpose
- **Loading States**: Proper loading indicators while fetching options
- **Error Handling**: Graceful error handling if models/agents can't be loaded
- **Caching**: React Query caches model and agent lists for 5 minutes
- **Responsive UI**: Grid layout adapts to mobile and desktop screens
- **Accessibility**: Proper semantic HTML and ARIA attributes

## Testing
- ✅ TypeScript type checking passes (`pnpm typecheck`)
- ✅ Biome linter passes (`pnpm lint`)
- ✅ Code formatting is correct (`pnpm fix`)

## Future Enhancements
1. **Config Persistence**: Remember user's last selected model/agent
2. **Custom Agents**: Support loading custom agents from `opencode.json` or markdown files
3. **Model Metadata**: Show additional model information (context window, capabilities)
4. **Resume Chat**: Apply model/agent selection to resume chat functionality
5. **Validation**: Validate model/agent compatibility before submission
6. **Favorites**: Allow users to mark favorite model/agent combinations

## Documentation References
Implementation based on OpenCode documentation:
- Model configuration: `opencode.json` with provider/model structure
- Agent configuration: JSON and Markdown format with mode, model, tools
- CLI flags: `--agent <name>` and `--model <provider/model>`

## Files Modified
- `src/server/service/opencode/getModels.ts` (new)
- `src/server/service/opencode/getAgents.ts` (new)
- `src/server/service/opencode/taskController.ts`
- `src/server/hono/route.ts`
- `src/app/hooks/useModelsAndAgents.ts` (new)
- `src/components/ModelSelector.tsx` (new)
- `src/components/AgentSelector.tsx` (new)
- `src/app/projects/[projectId]/components/newChat/NewChat.tsx`
- `src/app/projects/[projectId]/sessions/[sessionId]/components/resumeChat/ResumeChat.tsx`
- `src/app/projects/[projectId]/components/chatForm/useChatMutations.ts`

## Fixes Applied

### Issue 1: Models Not Loading
**Problem**: The initial implementation assumed `opencode models` returned JSON output, but it actually returns plain text (one model per line in format `provider/model`).

**Solution**: Updated `getModels.ts` to parse plain text output by:
1. Splitting output by newlines
2. Parsing each line to extract provider and model using string operations
3. Building the model list with proper provider/model separation

### Issue 2: Model/Agent Selection Only in New Chat
**Problem**: Model and agent selection was only available in the "New Chat" dialog, not when resuming conversations.

**Solution**: Added model and agent selectors to `ResumeChat.tsx` component, positioned above the chat input area with:
- Compact grid layout (2 columns on desktop, 1 on mobile)
- Smaller text labels for space efficiency
- Consistent styling with the New Chat modal
- State management to pass selections to the resume mutation
