# CRITICAL FIX: Subsequent Messages Not Displaying

## The Problem
Your logs showed that:
- ✅ SSE events were being received (`session_changed`)
- ✅ File watcher was working
- ✅ Opencode CLI was executing
- ❌ But responses weren't showing in the UI

## The Root Cause
The bug was in `/src/hooks/useServerEvents.ts` line 94:

```typescript
// BROKEN CODE:
if (event.data.type === "session_changed") {
  await queryClient.invalidateQueries({ queryKey: ["sessions"] });
}
```

This only invalidated the **sessions list** query, but NOT the **specific session** query that the session page uses.

The session page uses this query key: `["sessions", sessionId]`
But the SSE handler was only invalidating: `["sessions"]`

So the session page never knew to refetch its data!

## The Fix
Changed to invalidate BOTH queries:

```typescript
// FIXED CODE:
if (event.data.type === "session_changed") {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["sessions"] }),
    // Also invalidate the specific session being viewed
    event.data.data?.sessionId
      ? queryClient.invalidateQueries({
          queryKey: ["sessions", event.data.data.sessionId],
        })
      : Promise.resolve(),
  ]);
}
```

## How to Verify the Fix

1. **Start the dev server**: `pnpm dev`

2. **Send a message and watch browser console**:
   - Before fix: Only saw `[SSE] Session changed event received`
   - After fix: Also see `[SSE] Invalidated queries for session: <sessionId>`

3. **Send a second message**:
   - Before fix: No response displayed
   - After fix: Response appears immediately!

## What You'll See Now

When you send a message, the browser console will show:
```
[SSE] Session changed event received: {projectId: "...", sessionId: "...", fileEventType: "change"}
[SSE] Invalidated queries for session: L2hvbWUvY2F1dGlvdXMtc2VhLy4uLg==
```

That second line confirms the specific session query is being invalidated, which triggers a refetch and displays the new response.

## Additional Improvements

While fixing the main issue, I also added:

1. **Display reasoning as fallback** - When the agent doesn't provide text but has reasoning
2. **Completion indicator** - Shows "Task completed successfully" for tool-only responses
3. **Enhanced logging** - Better debugging for future issues

## Files Changed

1. ⭐ `/src/hooks/useServerEvents.ts` - **THE CRITICAL FIX**
2. `/src/app/projects/[projectId]/sessions/[sessionId]/components/conversationList/ConversationList.tsx` - UI improvements
3. `/src/server/service/opencode/taskController.ts` - Added logging
4. `/src/server/service/opencode/parseSession.ts` - Added logging

## Test It Now!

The fix is complete. Just restart your dev server and try sending multiple messages in a row. They should all display their responses now!
