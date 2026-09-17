# Testing Guide: Response Display Fixes

## Quick Start

1. **Start the development server:**
   ```bash
   pnpm dev
   ```

2. **Open two windows:**
   - Browser: http://localhost:3400
   - Terminal: Watch the server logs

## Test Scenarios

### Scenario 1: First Message (Should Work)
1. Navigate to a project
2. Click "New Chat" or select an existing session
3. Send a message: "Hello, can you help me?"
4. **Expected**: Response appears normally

### Scenario 2: Second Message (Previously Broken)
1. After the first message completes, send another: "What files are in this project?"
2. **Watch for in terminal:**
   ```
   [TaskController] Launching opencode with args: [ 'run', '--format', 'json', '--session', '<uuid>' ]
   [TaskController] opencode stdout: {...}
   [TaskController] opencode process exited with code 0, sessionUuid: <uuid>
   ```
3. **Watch for in browser console:**
   ```
   [SSE] Session changed event received: { projectId: '...', sessionId: '...', fileEventType: 'change' }
   [SSE] Invalidated queries for session: L2hvbWUvY2F1dGlvdXMtc2VhLy4uLg==
   ```
4. **Expected**: Response appears (text, reasoning, or "Task completed successfully")

### Scenario 3: Tool-Only Response
1. Send a message that triggers tools: "Read the README.md file"
2. **Expected**: 
   - Tool calls are displayed (collapsed cards)
   - If no text response: Either reasoning is shown OR "Task completed successfully" message

### Scenario 4: Multiple Rapid Messages
1. Send 3 messages quickly in succession
2. **Expected**: All messages are queued and processed in order
3. **Watch terminal for**: Queue processing logs

## What to Look For

### ✅ Success Indicators

**In Browser:**
- Responses appear for all messages
- "Codex is processing..." shows while working
- Tool calls are visible and expandable
- Reasoning or completion indicator shows when no text

**In Terminal:**
- `[TaskController] Launching opencode` for each message
- `opencode process exited with code 0` for successful completion
- No error messages in stderr

**In Browser Console:**
- `[SSE] Session changed event received` after each response
- No JavaScript errors

### ❌ Problem Indicators

**Response Not Showing:**
- Check if `[SSE] Session changed event received` appears
  - If NO: File watcher issue
  - If YES: Check if query invalidation is working

**"Task completed" but no response:**
- Check terminal for `Assistant message X has no text but contains...`
  - If present: Reasoning should be displayed
  - If not present: Check opencode storage files

**Errors in terminal:**
- `opencode run error:` - Check opencode CLI installation
- `Failed to parse opencode output` - Check opencode version compatibility

## Manual Verification

### Check Storage Files
```bash
# Navigate to opencode storage
cd ~/.local/share/opencode/storage/

# List sessions
ls -la session/

# Check messages for a session (replace <uuid> with actual session UUID)
ls -la message/<uuid>/

# Check parts for a message (replace <messageId> with actual message ID)
ls -la part/<messageId>/
```

### Test Opencode CLI Directly
```bash
# Navigate to your project
cd /path/to/your/project

# Run opencode directly
opencode run --format json "test message"

# Continue a session
opencode run --format json --session <uuid> "follow-up message"
```

## Common Issues & Solutions

### Issue: Second message doesn't show response
**Solution**: Check the logs - the response might be there but not displayed
- Look for reasoning in the turn data
- Verify file watcher is emitting events
- Check if query invalidation is working

### Issue: "Task completed successfully" shows but you expected text
**Solution**: This is normal when the agent only uses tools
- The agent performed actions without providing commentary
- Tool calls should be visible above the completion message
- You can expand tool calls to see what was done

### Issue: No responses at all
**Solution**: Check opencode CLI
```bash
which opencode  # Verify it's installed
opencode --version  # Check version
```

### Issue: Responses are delayed
**Solution**: This is normal for complex requests
- The agent is thinking and using tools
- Watch the "Codex is processing..." indicator
- Check terminal logs to see progress

## Expected Log Output

### Successful Message Flow
```
[Terminal]
[TaskController] Launching opencode with args: [ 'run', '--format', 'json', '--session', 'abc-123' ] message: "What files are in this project?..."
[TaskController] opencode stdout: {"type":"session","sessionID":"abc-123"}
[TaskController] opencode process exited with code 0, sessionUuid: abc-123

[Browser Console]
data {event: 'session_changed', data: {...}, id: '...'}
[SSE] Session changed event received: {projectId: 'xyz', sessionId: 'def-456', fileEventType: 'change'}
[SSE] Invalidated queries for session: def-456
```

**Key Change**: You should now see `[SSE] Invalidated queries for session` which confirms the specific session query is being refreshed. This was the missing piece that caused subsequent messages not to display.

## Need More Help?

If issues persist after following this guide:
1. Capture full logs from both terminal and browser console
2. Check the `FIX_EMPTY_RESPONSES.md` debugging guide
3. Verify opencode CLI works standalone
4. Check file permissions on `~/.local/share/opencode/storage/`
