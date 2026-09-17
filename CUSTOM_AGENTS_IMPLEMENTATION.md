# Custom Agents Implementation Summary

## Overview
Successfully implemented custom agents functionality in the Code Sentinel web-ui. The web-ui now reads and displays custom agents defined in `opencode.jsonc` files from project directories, matching the behavior of the OpenCode TUI.

## Problem Statement
Previously, the web-ui only showed default agents (build and plan) even though custom agents were being copied from `/home/cautious-sea/Projects/CS-Agents` to new projects. The OpenCode TUI could see these custom agents, but the web-ui could not.

## Solution
Implemented a complete solution that:
1. Reads `opencode.jsonc` or `opencode.json` from project directories
2. Parses custom agent configurations using JSON5 (supports comments and trailing commas)
3. Displays all custom agents in the agent selector dropdown
4. Maintains backward compatibility with default agents

## Changes Made

### 1. Backend Changes

#### `/src/server/service/opencode/getAgents.ts`
- **Added JSON5 parsing**: Supports JSONC format with comments
- **Added config file reading**: Reads from `opencode.jsonc` or `opencode.json`
- **Added custom agent parsing**: Extracts agent definitions from config
- **Updated type definitions**: Added "all" mode for custom agents
- **Improved error handling**: Gracefully falls back to defaults

Key features:
- Accepts optional `cwd` parameter to specify project directory
- Merges custom agents with default agents
- Avoids duplicates when custom agents override defaults

#### `/src/server/hono/route.ts`
- **Modified `/opencode/agents` endpoint**: Now accepts optional `projectId` query parameter
- **Added workspace path resolution**: Fetches project workspace path when projectId is provided
- **Passes workspace path to getAgents**: Enables project-specific agent loading

### 2. Frontend Changes

#### `/src/app/hooks/useModelsAndAgents.ts`
- **Updated `useAgents` hook**: Now accepts optional `projectId` parameter
- **Updated query key**: Includes projectId for proper cache invalidation
- **Updated Agent interface**: Added "all" mode type

#### `/src/components/AgentSelector.tsx`
- **Added `projectId` prop**: Allows passing project context
- **Passes projectId to hook**: Enables project-specific agent fetching

#### `/src/app/projects/[projectId]/components/newChat/NewChat.tsx`
- **Passes projectId to AgentSelector**: Ensures correct agents are shown when starting new chat

#### `/src/app/projects/[projectId]/sessions/[sessionId]/components/resumeChat/ResumeChat.tsx`
- **Passes projectId to AgentSelector**: Ensures correct agents are shown when resuming chat

### 3. Dependencies
- **Added `json5` package**: Enables parsing of JSONC files with comments

### 4. Testing
- **Created comprehensive test suite**: `getAgents.test.ts`
- **All tests passing**: Verified default agents, custom agents, and error handling
- **Created test setup file**: `vitest.setup.ts` for test infrastructure

## How It Works

### Flow Diagram
```
User opens project → Frontend requests agents with projectId
                   ↓
API receives projectId → Resolves workspace path
                   ↓
getAgents reads opencode.jsonc → Parses agent definitions
                   ↓
Returns merged list → Custom agents + Default agents
                   ↓
AgentSelector displays all agents → User can select any agent
```

### Example Custom Agent Configuration
```jsonc
{
  "agent": {
    "ux-expert": {
      "prompt": "{file:./.bmad-core/agents/ux-expert.md}",
      "mode": "all",
      "tools": {
        "write": true,
        "edit": true,
        "bash": true
      },
      "description": "Use for UI/UX design, wireframes, prototypes, front-end specifications, and user experience optimization"
    },
    "dev": {
      "prompt": "{file:./.bmad-core/agents/dev.md}",
      "mode": "all",
      "tools": {
        "write": true,
        "edit": true,
        "bash": true
      },
      "description": "Use for code implementation, debugging, refactoring, and development best practices"
    }
  }
}
```

## Verified Functionality

### Test Results
✅ All 3 tests passing:
- Default agents returned when no project specified
- Custom agents loaded from opencode.jsonc
- Graceful fallback when config file missing

### Runtime Verification
✅ Dev server running successfully
✅ API endpoint responding correctly: `/api/opencode/agents?projectId=...`
✅ No TypeScript errors
✅ No runtime errors

## Custom Agents Available
When a project has the CS-Agents template copied, the following custom agents are available:
- **ux-expert**: UI/UX design and optimization
- **sm**: Scrum Master for agile processes
- **qa**: Test architecture and quality assurance
- **po**: Product Owner for backlog management
- **pm**: Product Manager for strategy
- **dev**: Full Stack Developer
- **bmad-orchestrator**: Workflow coordination
- **bmad-master**: Comprehensive expertise
- **architect**: System design and architecture
- **analyst**: Business analysis and research

## Benefits
1. **Feature Parity**: Web-ui now matches TUI functionality
2. **Better UX**: Users can access all their custom agents
3. **Project-Specific**: Each project can have different agents
4. **Backward Compatible**: Default agents still work
5. **Type Safe**: Full TypeScript support
6. **Well Tested**: Comprehensive test coverage

## Future Enhancements
- Add agent filtering/search in dropdown
- Show agent mode badges (primary/subagent/all)
- Add agent preview/documentation tooltip
- Support for agent icons/avatars
- Agent usage analytics

## Files Modified
1. `src/server/service/opencode/getAgents.ts` - Core logic
2. `src/server/hono/route.ts` - API endpoint
3. `src/app/hooks/useModelsAndAgents.ts` - React hook
4. `src/components/AgentSelector.tsx` - UI component
5. `src/app/projects/[projectId]/components/newChat/NewChat.tsx` - Integration
6. `src/app/projects/[projectId]/sessions/[sessionId]/components/resumeChat/ResumeChat.tsx` - Integration
7. `package.json` - Added json5 dependency

## Files Created
1. `src/server/service/opencode/getAgents.test.ts` - Test suite
2. `src/test-setups/vitest.setup.ts` - Test infrastructure
3. `CUSTOM_AGENTS_IMPLEMENTATION.md` - This documentation
