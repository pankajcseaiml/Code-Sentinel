# Agent Persona Fix Documentation

## Problem Description

When users selected a custom agent (e.g., "analyst", "ux-expert") in the web-ui, the agent would appear in the dropdown but the AI would not actually adopt that agent's persona. For example:
- User selects "analyst" agent
- User asks "who are you?"
- Expected: "Hello, I am Mary, your business analyst"
- Actual: "I am Code Supernova" (generic model response)

## Root Cause

OpenCode sessions are **permanently bound to the agent they were created with**. The `--agent` flag only works when **creating a NEW session**, not when continuing an existing one.

### How OpenCode Handles Agents

1. **Creating a new session:**
   ```bash
   opencode run --agent analyst "who are you?"
   # Creates new session with analyst agent ✅
   ```

2. **Continuing an existing session:**
   ```bash
   opencode run --session ses_abc123 --agent analyst "who are you?"
   # The --agent flag is IGNORED ❌
   # Session continues with whatever agent it was created with
   ```

### The Web-UI Issue

The web-ui was passing both `--session` and `--agent` flags:
```typescript
// Old behavior
const args = ["run", "--format", "json"];
if (options.agent) {
  args.push("--agent", options.agent);  // This flag...
}
if (options.sessionUuid) {
  args.push("--session", options.sessionUuid);  // ...is ignored when this is present
}
```

This meant:
- **New Chat**: Would try to continue the last session for that project, ignoring the selected agent
- **Resume Chat**: Would continue the existing session, ignoring the selected agent

## Solution

Modified the API endpoints to **NOT pass session information when an agent is explicitly selected**. This forces OpenCode to create a fresh session with the selected agent.

### Changes Made

#### 1. New Session Endpoint (`/projects/:projectId/new-session`)

**Before:**
```typescript
const task = await taskController.startOrContinueTask(
  {
    projectId,
    cwd: project.meta.workspacePath,
    model,
    agent,
  },
  message,
);
```

**After:**
```typescript
// For new sessions, don't pass sessionUuid/sessionPathId
// This ensures OpenCode creates a fresh session with the selected agent
// The --agent flag only works when creating a new session, not continuing one
const task = await taskController.startOrContinueTask(
  {
    projectId,
    cwd: project.meta.workspacePath,
    model,
    agent,
    // Explicitly don't pass sessionUuid or sessionPathId for new sessions
  },
  message,
);
```

#### 2. Resume Session Endpoint (`/projects/:projectId/sessions/:sessionId/resume`)

**Before:**
```typescript
const task = await taskController.startOrContinueTask(
  {
    projectId,
    sessionPathId: sessionId,
    sessionUuid: header.sessionUuid,
    cwd: project.meta.workspacePath,
    model,
    agent,
  },
  resumeMessage,
);
```

**After:**
```typescript
// If an agent is explicitly selected, create a new session instead of continuing
// This is because OpenCode sessions are bound to the agent they were created with
// and the --agent flag is ignored when using --session to continue
const task = await taskController.startOrContinueTask(
  {
    projectId,
    // Only pass session info if NO agent is selected
    // This allows continuing with the same agent, or starting fresh with a new one
    sessionPathId: agent ? undefined : sessionId,
    sessionUuid: agent ? undefined : header.sessionUuid,
    cwd: project.meta.workspacePath,
    model,
    agent,
  },
  resumeMessage,
);
```

## Behavior After Fix

### Scenario 1: New Chat with Agent Selected
1. User selects "analyst" agent
2. User types "who are you?"
3. Web-ui calls `/projects/:projectId/new-session` with `agent: "analyst"`
4. Backend does NOT pass `--session` flag
5. OpenCode creates NEW session with analyst agent ✅
6. AI responds as analyst persona ✅

### Scenario 2: New Chat without Agent Selected
1. User leaves agent dropdown empty
2. User types "hello"
3. Web-ui calls `/projects/:projectId/new-session` without `agent`
4. Backend does NOT pass `--session` flag
5. OpenCode creates NEW session with default agent (build) ✅

### Scenario 3: Resume Chat with Agent Selected
1. User opens existing session
2. User selects "ux-expert" agent
3. User types "design a login page"
4. Web-ui calls `/projects/:projectId/sessions/:sessionId/resume` with `agent: "ux-expert"`
5. Backend does NOT pass `--session` flag (because agent is selected)
6. OpenCode creates NEW session with ux-expert agent ✅
7. AI responds as UX expert persona ✅

### Scenario 4: Resume Chat without Agent Selected
1. User opens existing session
2. User leaves agent dropdown empty
3. User types "continue"
4. Web-ui calls `/projects/:projectId/sessions/:sessionId/resume` without `agent`
5. Backend DOES pass `--session` flag
6. OpenCode continues existing session with original agent ✅

## Trade-offs

### Pros ✅
- **Agent personas work correctly**: Selected agents actually apply their persona
- **User control**: Users can switch agents at any time
- **Intuitive behavior**: Selecting an agent does what users expect

### Cons ⚠️
- **New sessions created**: Each agent selection creates a new session
- **Session history**: Switching agents mid-conversation starts fresh (no context from previous session)
- **More sessions**: Projects will have more session files

## Alternative Approaches Considered

### 1. Store Agent in Session File
**Idea**: Modify OpenCode to store agent info in session JSON
**Rejected**: Would require forking/modifying OpenCode core

### 2. Track Agent in Web-UI Database
**Idea**: Store agent-to-session mapping in web-ui
**Rejected**: Doesn't solve the core issue that OpenCode ignores `--agent` with `--session`

### 3. Use OpenCode Session API
**Idea**: Use `/session` API instead of CLI
**Rejected**: Web-ui uses CLI for better compatibility and simplicity

## Testing

### Manual Test Steps
1. Open web-ui at http://localhost:3400
2. Create new project or open existing one
3. Select "analyst" agent from dropdown
4. Type: "who are you?"
5. Verify response includes analyst persona (e.g., mentions being a business analyst)
6. Select "ux-expert" agent
7. Type: "who are you?"
8. Verify response includes UX expert persona
9. Leave agent dropdown empty
10. Type: "who are you?"
11. Verify response uses default agent

### Expected Results
- ✅ Each agent selection creates a new session
- ✅ AI adopts the selected agent's persona
- ✅ Agent descriptions from `opencode.jsonc` are respected
- ✅ No agent selected = default "build" agent

## Files Modified

1. **`src/server/hono/route.ts`**
   - Modified `/projects/:projectId/new-session` endpoint
   - Modified `/projects/:projectId/sessions/:sessionId/resume` endpoint
   - Added logic to conditionally pass session info based on agent selection

## Related Documentation

- [Custom Agents Implementation](./CUSTOM_AGENTS_IMPLEMENTATION.md)
- [OpenCode Agent Documentation](https://opencode.ai/docs/agents)
- [OpenCode Session API](https://opencode.ai/docs/server)

## Future Enhancements

1. **Session Forking**: Allow users to fork a session with a different agent while preserving context
2. **Agent Indicator**: Show which agent a session was created with
3. **Agent Switching Warning**: Warn users that switching agents creates a new session
4. **Context Preservation**: Optionally include previous session context when switching agents
