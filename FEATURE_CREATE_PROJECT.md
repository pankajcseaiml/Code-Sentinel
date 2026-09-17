# Create New Project Feature

## Overview
This feature adds the ability to create new projects directly from the OpenCode Viewer web UI. When you create a project, a new folder is created in `/home/cautious-sea/Projects/CS-Projects/` with the specified project name.

## Components Added

### Backend

1. **Service Function** (`src/server/service/project/createProject.ts`)
   - Sanitizes project names to prevent directory traversal attacks
   - Creates project directories in `/home/cautious-sea/Projects/CS-Projects/`
   - Validates project name format
   - Checks for duplicate projects

2. **API Endpoint** (`src/server/hono/route.ts`)
   - POST `/projects` - Creates a new project
   - Accepts: `{ projectName: string }`
   - Returns: `{ workspacePath: string }` or error
   - Status codes: 201 (success), 400 (validation error), 500 (server error)

### Frontend

1. **API Client** (`src/lib/api/projects.ts`)
   - `createProject(projectName: string)` - Wrapper function for the API call
   - Handles response parsing and error messages

2. **UI Component** (`src/app/projects/components/CreateProjectDialog.tsx`)
   - Dialog with form for entering project name
   - Form validation and error handling
   - Loading states during project creation
   - Automatically refreshes project list on success
   - Uses shadcn/ui components (Dialog, Button, Input, Label)

3. **Integration** (`src/app/projects/page.tsx`)
   - Added "Create New Project" button to projects page header
   - Button opens the CreateProjectDialog

## How to Use

1. **Start the development server:**
   ```bash
   pnpm dev
   ```

2. **Navigate to the projects page** (http://localhost:3400)

3. **Click "Create New Project" button** in the top-right corner

4. **Enter a project name** (e.g., "My-New-Project")
   - Allowed characters: letters, numbers, hyphens, underscores, and spaces
   - Special characters are automatically removed

5. **Click "Create Project"**
   - An empty folder will be created at `/home/cautious-sea/Projects/CS-Projects/<ProjectName>`
   - The folder will be created but won't appear in the project list yet
   - Use the "New Chat" button from the projects page to start an OpenCode session in this folder
   - Once you start a session, the project will appear in your project list

## Example Usage

Creating a project named "Code-Sentinel" will create:
```
/home/cautious-sea/Projects/CS-Projects/Code-Sentinel/
```

## Technical Details

### Simple Folder Creation
- The feature only creates an empty directory - no files, no git, no session
- This ensures clean project setup without unwanted initialization
- Projects appear in the list only after you manually start an OpenCode session

### Security
- Project names are sanitized to prevent directory traversal
- Only alphanumeric characters, hyphens, underscores, and spaces are allowed
- Duplicate project names are rejected
- OpenCode subprocess runs with same environment as server

### Error Handling
- Invalid project names (empty or all special characters) are rejected
- Duplicate projects are detected and reported
- File system errors are caught and displayed to the user
- Session initialization failures are logged but don't fail project creation

### UI/UX
- Dialog uses React's `useId()` hook for accessible form labels
- Simple single-input form for project name
- Clear description explaining the workflow
- Loading state disables form during creation
- Error messages displayed inline in the dialog
- Form resets when dialog is closed
- Success automatically closes dialog

## Future Enhancements

Potential improvements for this feature:
1. Allow customizing the base directory for projects
2. Add project templates (e.g., Node.js, Python, etc.)
3. Initialize git repository on project creation
4. Create initial project structure (folders, files)
5. Add project description/metadata fields
6. Add project templates (with optional initial files)
7. Integration with "New Chat" to automatically switch to new project
8. Quick action to open project folder in file explorer
