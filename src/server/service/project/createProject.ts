import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const CS_PROJECTS_BASE = "/home/cautious-sea/Projects/CS-Projects";
const CS_AGENTS_TEMPLATE = "/home/cautious-sea/Projects/CS-Agents";

export const createProject = async (
  projectName: string,
): Promise<{ workspacePath: string }> => {
  // Sanitize project name to prevent directory traversal
  const sanitizedName = projectName.replace(/[^a-zA-Z0-9-_\s]/g, "");

  if (!sanitizedName || sanitizedName.trim().length === 0) {
    throw new Error("Invalid project name");
  }

  const workspacePath = join(CS_PROJECTS_BASE, sanitizedName.trim());

  // Check if directory already exists
  if (existsSync(workspacePath)) {
    throw new Error(`Project "${sanitizedName}" already exists`);
  }

  // Create the project directory
  try {
    await mkdir(workspacePath, { recursive: true });
  } catch (error) {
    throw new Error(
      `Failed to create project directory: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  // Copy template files from CS-Agents to the new project
  if (existsSync(CS_AGENTS_TEMPLATE)) {
    try {
      await cp(CS_AGENTS_TEMPLATE, workspacePath, {
        recursive: true,
        force: false,
        errorOnExist: false,
      });
    } catch (error) {
      console.warn(
        "Failed to copy template files from CS-Agents:",
        error instanceof Error ? error.message : "Unknown error",
      );
      // Don't throw - project was created successfully, just missing templates
    }
  } else {
    console.warn(`Template directory not found: ${CS_AGENTS_TEMPLATE}`);
  }

  // Initialize empty session to register the project
  try {
    await initializeEmptySession(workspacePath, sanitizedName.trim());
  } catch (error) {
    console.warn("Project created but failed to initialize session:", error);
    // Don't throw - project was created successfully
  }

  return { workspacePath };
};

/**
 * Initialize an empty session by running a minimal command
 * Uses 'opencode run' with the project name to create session, then aborts immediately
 */
function initializeEmptySession(
  workspacePath: string,
  projectName: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    // Run opencode with project name to create session
    // We'll abort it immediately after session is created
    const child = spawn("opencode", ["run", "--format", "json", projectName], {
      cwd: workspacePath,
      env: { ...process.env },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let sessionCreated = false;
    let sessionId: string | null = null;

    // Kill the process after session is detected
    const killTimeout = setTimeout(() => {
      child.kill("SIGTERM");
      if (sessionCreated) {
        resolve();
      } else {
        reject(new Error("OpenCode session creation timed out"));
      }
    }, 15000); // 15 second timeout

    child.stdout?.on("data", (data) => {
      const output = data.toString();
      try {
        // Outputs JSON lines with session info
        const lines = output.split("\n").filter((line: string) => line.trim());
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.sessionID || parsed.type === "session") {
              sessionId = parsed.sessionID || sessionId;
              sessionCreated = true;
              // Session detected, abort immediately
              clearTimeout(killTimeout);
              child.kill("SIGTERM");
              resolve();
              return;
            }
          } catch {
            // Not JSON, continue
          }
        }
      } catch (_error) {
        // Continue processing
      }
    });

    child.stderr?.on("data", (data) => {
      console.log("Session stderr:", data.toString());
    });

    child.on("error", (error) => {
      clearTimeout(killTimeout);
      reject(new Error(`Failed to spawn opencode: ${error.message}`));
    });

    child.on("close", (code) => {
      clearTimeout(killTimeout);
      if (sessionCreated) {
        resolve();
      } else if (code === 0 || code === null || code === 143) {
        // SIGTERM exit code or normal exit
        resolve(); // Consider it successful even if we didn't detect the session
      } else {
        reject(
          new Error(
            `Process exited with code ${code} before session was created`,
          ),
        );
      }
    });
  });
}
