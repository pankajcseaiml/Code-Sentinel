import { stat } from "node:fs/promises";
import { summarizeOpencodeSession } from "../opencode/parseSession";
import type { SessionMeta } from "../types";

export const getSessionMeta = async (
  jsonlFilePath: string,
): Promise<SessionMeta> => {
  const summary = await summarizeOpencodeSession(jsonlFilePath);

  let lastModifiedAt = summary.lastModifiedAt;
  let startedAt = summary.startedAt;

  if (!lastModifiedAt || !startedAt) {
    try {
      const stats = await stat(jsonlFilePath);
      if (!lastModifiedAt) {
        lastModifiedAt = stats.mtime.toISOString();
      }
      if (!startedAt) {
        startedAt = stats.birthtime.toISOString();
      }
    } catch (error) {
      console.warn(`Failed to stat session file ${jsonlFilePath}`, error);
    }
  }

  return {
    messageCount: summary.messageCount,
    firstCommand: summary.firstCommand,
    lastModifiedAt,
    startedAt,
  } satisfies SessionMeta;
};
