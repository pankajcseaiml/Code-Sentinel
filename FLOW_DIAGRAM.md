# Message Flow Diagram

## Before Fix (BROKEN) ❌

```
User sends message
    ↓
Frontend calls /resume API
    ↓
Backend launches opencode CLI
    ↓
Opencode writes to files:
  - ~/.local/share/opencode/storage/message/<uuid>/<messageId>.json
  - ~/.local/share/opencode/storage/part/<messageId>/<partId>.json
    ↓
File watcher detects changes
    ↓
SSE emits "session_changed" event
    ↓
Frontend receives event
    ↓
Invalidates query: ["sessions"]  ← WRONG KEY!
    ↓
Session page uses: ["sessions", sessionId]  ← DIFFERENT KEY!
    ↓
❌ Query not invalidated, page doesn't refetch
    ↓
❌ No response displayed
```

## After Fix (WORKING) ✅

```
User sends message
    ↓
Frontend calls /resume API
    ↓
Backend launches opencode CLI
    ↓
Opencode writes to files:
  - ~/.local/share/opencode/storage/message/<uuid>/<messageId>.json
  - ~/.local/share/opencode/storage/part/<messageId>/<partId>.json
    ↓
File watcher detects changes
    ↓
SSE emits "session_changed" event
    ↓
Frontend receives event
    ↓
Invalidates BOTH queries:
  - ["sessions"]  ← For sessions list
  - ["sessions", sessionId]  ← For specific session page ✅
    ↓
✅ Session page query invalidated
    ↓
✅ Page refetches data
    ↓
✅ Response displayed!
```

## React Query Key Hierarchy

```
["sessions"]                          ← Sessions list query
    ↓
["sessions", "abc123"]               ← Specific session query
    ↓
["sessions", "abc123", "messages"]   ← Session messages (if we had this)
```

**Key Insight**: Invalidating `["sessions"]` does NOT automatically invalidate `["sessions", "abc123"]` in React Query. You must invalidate both explicitly!

## The Fix in Code

```typescript
// BEFORE (only invalidated parent)
await queryClient.invalidateQueries({ queryKey: ["sessions"] });

// AFTER (invalidates both parent and specific child)
await Promise.all([
  queryClient.invalidateQueries({ queryKey: ["sessions"] }),
  queryClient.invalidateQueries({ queryKey: ["sessions", sessionId] }),
]);
```

## Why First Message Worked

The first message worked because:
1. It creates a NEW session
2. The mutation's `onSuccess` explicitly invalidates the specific session
3. It also navigates to the new session page

But subsequent messages:
1. Use the SAME session
2. Rely on SSE events to trigger refetch
3. SSE handler was only invalidating `["sessions"]`
4. So the session page never refetched ❌

## Verification

Check browser console for this log after sending a message:
```
[SSE] Invalidated queries for session: L2hvbWUvY2F1dGlvdXMtc2VhLy4uLg==
```

If you see this, the fix is working! ✅
