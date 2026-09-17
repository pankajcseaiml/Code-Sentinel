import fs from "node:fs/promises";
import path from "node:path";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

/**
 * Get the file tree structure for a given directory
 */
export async function getFileTree(dirPath: string): Promise<FileNode[]> {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const nodes: FileNode[] = [];

    for (const entry of entries) {
      // Skip hidden files and common directories to ignore
      if (
        entry.name.startsWith(".") ||
        entry.name === "node_modules" ||
        entry.name === "dist" ||
        entry.name === "build"
      ) {
        continue;
      }

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = fullPath.replace(dirPath, "").replace(/^\//, "");

      if (entry.isDirectory()) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
        });
      } else if (entry.isFile()) {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }

    // Sort: directories first, then files, both alphabetically
    return nodes.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name);
      }
      return a.type === "directory" ? -1 : 1;
    });
  } catch (error) {
    console.error("Error reading directory:", error);
    throw new Error(`Failed to read directory: ${dirPath}`);
  }
}

/**
 * Read file content
 */
export async function readFile(filePath: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return content;
  } catch (error) {
    console.error("Error reading file:", error);
    throw new Error(`Failed to read file: ${filePath}`);
  }
}

/**
 * Write file content
 */
export async function writeFile(
  filePath: string,
  content: string,
): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    await fs.writeFile(filePath, content, "utf-8");
  } catch (error) {
    console.error("Error writing file:", error);
    throw new Error(`Failed to write file: ${filePath}`);
  }
}

/**
 * Create a new file
 */
export async function createFile(filePath: string): Promise<void> {
  try {
    // Ensure directory exists
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });

    // Create empty file
    await fs.writeFile(filePath, "", "utf-8");
  } catch (error) {
    console.error("Error creating file:", error);
    throw new Error(`Failed to create file: ${filePath}`);
  }
}

/**
 * Create a new directory
 */
export async function createDirectory(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    console.error("Error creating directory:", error);
    throw new Error(`Failed to create directory: ${dirPath}`);
  }
}

/**
 * Delete a file or directory
 */
export async function deleteFileOrDirectory(targetPath: string): Promise<void> {
  try {
    const stat = await fs.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.rm(targetPath, { recursive: true });
    } else {
      await fs.unlink(targetPath);
    }
  } catch (error) {
    console.error("Error deleting:", error);
    throw new Error(`Failed to delete: ${targetPath}`);
  }
}

/**
 * Rename a file or directory
 */
export async function renameFileOrDirectory(
  oldPath: string,
  newPath: string,
): Promise<void> {
  try {
    await fs.rename(oldPath, newPath);
  } catch (error) {
    console.error("Error renaming:", error);
    throw new Error(`Failed to rename from ${oldPath} to ${newPath}`);
  }
}
