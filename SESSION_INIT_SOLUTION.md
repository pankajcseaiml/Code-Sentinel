# Session Initialization Solution

## Problem
When creating a new project through the web UI, the folder was created but the project didn't appear in the "My Projects" list. This was because the web UI only displays projects that have OpenCode sessions in `~/.local/share/opencode/storage/`.

## Solution
Added automatic OpenCode session initialization during project creation, so new projects immediately appear in the project list.

## Implementation

### 1. Backend Changes

**`src/server/service/project/createProject.ts`**
- Added optional `initializeSession` parameter (default: `false`)
- Added `initializeOpencodeSession()` function that:
  - Spawns `opencode run --format json "Initialize this project"` in the new directory
  - Has a 30-second timeout to prevent hanging
  - Handles errors gracefully (project creation succeeds even if initialization fails)

**`src/server/hono/route.ts`**
- Updated POST `/projects` endpoint to accept `initializeSession: boolean` in request body
- Passes parameter to `createProject()` service function

### 2. Frontend Changes

**`src/lib/api/projects.ts`**
- Updated `createProject()` function to accept `initializeSession` parameter

**`src/app/projects/components/CreateProjectDialog.tsx`**
- Added checkbox component for "Start OpenCode session (recommended)"
- Checkbox is checked by default
- Shows helpful description when enabled
- Passes `initializeSession` value to API

### 3. UI Flow

1. User clicks "Create New Project"
2. Enters project name
3. Sees checkbox "Start OpenCode session (recommended)" ✅ (checked by default)
4. Optional description: "This will run OpenCode to initialize the project and make it appear in your project list immediately."
5. Clicks "Create Project"
6. Backend creates folder AND starts OpenCode session
7. Project appears in list immediately

## Key Benefits

✅ **Immediate visibility**: Projects appear in the list right away
✅ **User choice**: Can disable if they want to initialize manually later
✅ **Graceful degradation**: If OpenCode fails, project is still created
✅ **Clear UX**: Helpful description explains what happens
✅ **Automatic**: No need to manually run `cd` and `opencode` commands

## Technical Flow

```
User submits form
    ↓
POST /api/projects { projectName, initializeSession: true }
    ↓
createProject(name, true)
    ↓
1. Create directory: /home/cautious-sea/Projects/CS-Projects/ProjectName
    ↓
2. spawn("opencode", ["run", "--format", "json", "Initialize this project"])
    ↓
3. OpenCode creates session in ~/.local/share/opencode/storage/
    ↓
4. Web UI's SSE connection detects new session
    ↓
5. Project list refreshes automatically
    ↓
✅ Project appears in "My Projects"
```

## Error Handling

- **Invalid project name**: Rejected before directory creation
- **Duplicate project**: Detected and error returned
- **Directory creation fails**: Error thrown, no session attempted
- **OpenCode spawn fails**: Warning logged, project still created successfully
- **OpenCode timeout**: Process killed after 30s, project still exists
- **OpenCode exits with error**: Warning logged, project still exists

## Configuration

Currently hardcoded values:
- Base directory: `/home/cautious-sea/Projects/CS-Projects`
- Initialization prompt: `"Initialize this project"`
- Timeout: 30 seconds

These could be made configurable in future versions.

## Testing

To test the feature:

1. Start dev server: `pnpm dev`
2. Navigate to http://localhost:3400
3. Click "Create New Project"
4. Enter name (e.g., "Test-Project-123")
5. Ensure checkbox is checked
6. Click "Create Project"
7. Wait a few seconds for OpenCode to initialize
8. Project should appear in the list

To test without initialization:
1. Uncheck "Start OpenCode session"
2. Create project
3. Project won't appear until you manually run OpenCode in that directory

## Files Modified/Created

**Created:**
- `src/server/service/project/createProject.ts` - Service with session init logic
- `src/lib/api/projects.ts` - Frontend API wrapper
- `src/app/projects/components/CreateProjectDialog.tsx` - UI dialog component

**Modified:**
- `src/server/hono/route.ts` - Added POST /projects endpoint
- `src/app/projects/page.tsx` - Added CreateProjectDialog button
- `FEATURE_CREATE_PROJECT.md` - Updated documentation

**Dependencies Added:**
- shadcn/ui components: Dialog, Button, Input, Label, Checkbox

## Notes

- OpenCode must be installed and available in PATH
- Requires proper OpenCode configuration (API keys, etc.)
- Uses same environment as the web server process
- Session initialization runs in background (async)
- User sees immediate feedback even while OpenCode is running
