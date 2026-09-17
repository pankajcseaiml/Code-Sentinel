# Fix: Empty Assistant Responses Issue

## Problem
When sending prompts to the opencode agent, the UI would show "task completed" without displaying any assistant response. This happens in two scenarios:

1. **First message works, subsequent messages don't**: The first message gets a response, but follow-up messages show "Codex is processing" then "task completed" without any visible response.
2. **Tool-only responses**: The agent performs actions using tools without providing a final text response.

## Root Causes

### Issue 1: Subsequent Messages Not Showing Responses (FIXED)
**Root Cause Found**: The SSE handler was only invalidating the sessions list query `["sessions"]`, but NOT the specific session query `["sessions", sessionId]`. This meant:
- File watcher was working correctly ✓
- SSE events were being received ✓
- But the session page wasn't refetching its data ✗

The opencode CLI was executing correctly and writing responses to files, but the UI wasn't displaying them because the React Query cache wasn't being invalidated for the specific session being viewed.

### Issue 2: Tool-Only Responses
The parsing logic in `parseSession.ts` only created assistant message entries when `text.length > 0`, causing the UI to have nothing to display except tool calls.

## Solution
Applied a multi-layered fix to ensure users always see feedback:

### 1. Display Reasoning as Fallback (ConversationList.tsx)
When no assistant text messages are present, the UI now displays reasoning/thinking content:
```typescript
{turn.assistantMessages.length === 0 && turn.reasonings.length > 0 ? (
  <div className="flex flex-col gap-4">
    {turn.reasonings.map((reasoning) => (
      <AssistantMessage
        key={reasoning.id}
        text={formatText(reasoning.text)}
        timestamp={reasoning.timestamp}
      />
    ))}
  </div>
) : null}
```

### 2. Show Completion Indicator (ConversationList.tsx)
When there are only tool calls without any text or reasoning, display a completion message:
```typescript
{turn.assistantMessages.length === 0 &&
  turn.reasonings.length === 0 &&
  toolPairs.length > 0 ? (
  <div className="text-sm text-muted-foreground italic">
    Task completed successfully
  </div>
) : null}
```

### 3. Fix Query Invalidation (useServerEvents.ts) - CRITICAL FIX
The main issue was that session_changed events weren't invalidating the specific session query:

**Before (BROKEN):**
```typescript
if (event.data.type === "session_changed") {
  await queryClient.invalidateQueries({ queryKey: ["sessions"] });
}
```

**After (FIXED):**
```typescript
if (event.data.type === "session_changed") {
  // Invalidate both the sessions list and the specific session
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    // Invalidate the specific session if we have the sessionId
    event.data.data?.sessionId
      ? queryClient.invalidateQueries({
          queryKey: ["sessions", event.data.data.sessionId],
        })
      : Promise.resolve(),
  ]);
}
```

This ensures that when a session file changes, the session page refetches its data and displays the new responses.

### 4. Enhanced Debug Logging
Added comprehensive logging to diagnose issues:

**parseSession.ts** - Log empty text responses:
```typescript
if (text.length === 0 && (reasonings.length > 0 || toolData.calls.length > 0)) {
  console.log(
    `Assistant message ${message.id} has no text but contains ${reasonings.length} reasonings and ${toolData.calls.length} tool calls`,
  );
}
```

**taskController.ts** - Log opencode CLI execution:
```typescript
console.log(`[TaskController] Launching opencode with args:`, args);
console.log(`[TaskController] opencode stdout:`, trimmed);
console.log(`[TaskController] opencode process exited with code ${code}`);
```

**useServerEvents.ts** - Log session change events and invalidation:
```typescript
console.log("[SSE] Session changed event received:", event.data.data);
console.log("[SSE] Invalidated queries for session:", event.data.data?.sessionId);
```

## Files Modified
1. `/src/app/projects/[projectId]/sessions/[sessionId]/components/conversationList/ConversationList.tsx`
   - Added reasoning display when no assistant messages
   - Added completion indicator for tool-only responses

2. `/src/server/service/opencode/parseSession.ts`
   - Added debug logging for empty text responses

3. `/src/server/service/opencode/taskController.ts`
   - Added logging for opencode CLI execution and output
   - Added process exit logging

4. `/src/hooks/useServerEvents.ts` ⭐ **CRITICAL FIX**
   - Fixed query invalidation to include specific session query
   - Added logging for session change events and invalidation

## Expected Behavior After Fix
- **With reasoning**: Users will see the agent's thought process when no final text response is provided
- **With only tools**: Users will see "Task completed successfully" along with the tool calls
- **With text**: Users will see the normal assistant response (unchanged)
- **Console logs**: Detailed logs help diagnose any remaining issues

## Debugging Guide

### If subsequent messages still don't show responses:

1. **Check browser console** for:
   - `[SSE] Session changed event received` - confirms file watcher is working
   - `data` events - shows SSE connection is active

2. **Check server console** for:
   - `[TaskController] Launching opencode with args` - confirms CLI is being called
   - `[TaskController] opencode stdout` - shows CLI output
   - `[TaskController] opencode process exited with code 0` - confirms successful completion
   - `Assistant message X has no text but contains...` - shows parsing is working

3. **Check opencode storage** at `~/.local/share/opencode/storage/`:
   - `session/*.json` - session files
   - `message/<sessionUuid>/*.json` - message files
   - `part/<messageId>/*.json` - part files (tool calls, reasoning, text)

4. **Verify opencode CLI** works standalone:
   ```bash
   cd /path/to/your/project
   opencode run --format json "your message"
   ```

## Testing
To verify the fix:
1. Start the development server: `pnpm dev`
2. Open browser console and server terminal
3. Send a first message and verify response appears
4. Send a second message and watch the logs:
   - Server should show opencode launching with `--session <uuid>`
   - Browser should show SSE session_changed events
   - UI should display the response
5. Try a prompt that uses tools without text (e.g., "read the README file")
6. Verify that either reasoning or the completion indicator is displayed
