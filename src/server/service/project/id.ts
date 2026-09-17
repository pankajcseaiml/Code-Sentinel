import { createHash } from "node:crypto";
import { listOpencodeSessionRecords } from "../opencode/sessionFiles";

export const encodeProjectId = (fullPath: string) => {
  // Use SHA-1 hash to match Opencode's project ID calculation
  return createHash("sha1").update(fullPath).digest("hex");
};

export const decodeProjectId = async (id: string): Promise<string> => {
  // SHA-1 hash is not reversible, so we need to find the workspace path from session records
  const records = await listOpencodeSessionRecords();

  for (const record of records) {
    if (record.workspacePath && encodeProjectId(record.workspacePath) === id) {
      return record.workspacePath;
    }
  }

  throw new Error(`Project not found for ID: ${id}`);
};
