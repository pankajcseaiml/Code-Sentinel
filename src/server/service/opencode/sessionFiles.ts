import type { Dirent } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import { basename, join } from "node:path";

import { opencodeSessionsRootPath } from "../paths";
import { getHistoryTimestamps } from "./history";

export type OpencodeSessionHeader = {
  sessionUuid: string | null;
  workspacePath: string | null;
  startedAt: string | null;
  instructions: string | null;
};

export type OpencodeSessionRecord = OpencodeSessionHeader & {
  filePath: string;
  lastModifiedAt: Date | null;
};

type OpencodeSessionFile = {
  id?: unknown;
  directory?: unknown;
  title?: unknown;
  time?: {
    created?: unknown;
    updated?: unknown;
  };
};

const sessionCache = new Map<string, OpencodeSessionRecord>();

const isSessionFile = (name: string) => name.endsWith(".json");

const toISOString = (value: unknown): string | null => {
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return null;
};

const toDate = (value: unknown): Date | null => {
  if (typeof value === "number") {
    return new Date(value);
  }
  if (typeof value === "string") {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
};

const readSessionFile = async (
  filePath: string,
): Promise<OpencodeSessionFile | null> => {
  try {
    const content = await readFile(filePath, "utf-8");
    const parsed = JSON.parse(content) as OpencodeSessionFile;
    return parsed;
  } catch (error) {
    console.warn(`Failed to read session file ${filePath}`, error);
    return null;
  }
};

export const readSessionHeader = async (
  filePath: string,
): Promise<OpencodeSessionHeader | null> => {
  const parsed = await readSessionFile(filePath);
  if (!parsed) {
    return null;
  }

  return {
    sessionUuid: typeof parsed.id === "string" ? parsed.id : null,
    workspacePath:
      typeof parsed.directory === "string" ? parsed.directory : null,
    startedAt: toISOString(parsed.time?.created) ?? null,
    instructions: typeof parsed.title === "string" ? parsed.title : null,
  } satisfies OpencodeSessionHeader;
};

export const listOpencodeSessionRecords = async (): Promise<
  OpencodeSessionRecord[]
> => {
  const root = opencodeSessionsRootPath;
  const records: OpencodeSessionRecord[] = [];
  const sessionUuidMap = new Map<string, OpencodeSessionRecord>();

  const stack: string[] = [root];

  while (stack.length > 0) {
    const current = stack.pop();
    if (!current) continue;

    let dirents: Dirent[];
    try {
      dirents = (await readdir(current, {
        withFileTypes: true,
      })) as unknown as Dirent[];
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      console.warn(`Failed to read directory ${current}`, error);
      continue;
    }

    for (const dirent of dirents) {
      const entryName = dirent.name.toString();
      const fullPath = join(current, entryName);

      if (dirent.isDirectory()) {
        stack.push(fullPath);
        continue;
      }

      if (!dirent.isFile() || !isSessionFile(entryName)) {
        continue;
      }

      const parsed = await readSessionFile(fullPath);
      if (!parsed) {
        continue;
      }

      const header: OpencodeSessionHeader = {
        sessionUuid: typeof parsed.id === "string" ? parsed.id : null,
        workspacePath:
          typeof parsed.directory === "string" ? parsed.directory : null,
        startedAt: toISOString(parsed.time?.created) ?? null,
        instructions: typeof parsed.title === "string" ? parsed.title : null,
      };

      let fileStats: Awaited<ReturnType<typeof stat>> | null = null;
      try {
        fileStats = await stat(fullPath);
      } catch (error) {
        console.warn(`Failed to stat session file ${fullPath}`, error);
      }

      const lastModified =
        toDate(parsed.time?.updated) ?? fileStats?.mtime ?? null;

      const record: OpencodeSessionRecord = {
        ...header,
        filePath: fullPath,
        lastModifiedAt: lastModified,
      };
      records.push(record);
      sessionCache.set(fullPath, record);
      if (record.sessionUuid) {
        sessionUuidMap.set(record.sessionUuid, record);
      }
    }
  }

  const historyTimestamps = await getHistoryTimestamps();
  for (const [sessionUuid, timestamp] of historyTimestamps.entries()) {
    const record = sessionUuidMap.get(sessionUuid);
    if (!record) {
      continue;
    }
    if (!record.lastModifiedAt || timestamp > record.lastModifiedAt) {
      record.lastModifiedAt = timestamp;
    }
  }

  return records;
};

export const listSessionsForWorkspace = async (workspacePath: string) => {
  const records = await listOpencodeSessionRecords();
  return records.filter((record) => record.workspacePath === workspacePath);
};

export const getWorkspaceName = (workspacePath: string) => {
  return basename(workspacePath);
};

export const findSessionRecordByUuid = async (
  sessionUuid: string,
): Promise<OpencodeSessionRecord | null> => {
  for (const record of sessionCache.values()) {
    if (record.sessionUuid === sessionUuid) {
      return record;
    }
  }

  const records = await listOpencodeSessionRecords();
  for (const record of records) {
    if (record.sessionUuid === sessionUuid) {
      return record;
    }
  }

  return null;
};

export const findLatestSessionForWorkspace = async (
  workspacePath: string,
  afterTimestamp?: number,
): Promise<OpencodeSessionRecord | null> => {
  const records = await listOpencodeSessionRecords();
  const filtered = records.filter((record) => {
    if (record.workspacePath !== workspacePath) {
      return false;
    }
    if (!afterTimestamp) {
      return true;
    }
    const modified = record.lastModifiedAt?.getTime() ?? 0;
    return modified >= afterTimestamp - 2000;
  });

  if (filtered.length === 0) {
    return null;
  }

  filtered.sort((a, b) => {
    const aTime = a.lastModifiedAt?.getTime() ?? 0;
    const bTime = b.lastModifiedAt?.getTime() ?? 0;
    return bTime - aTime;
  });

  return filtered.at(0) ?? null;
};

export const getCachedSessionRecord = (filePath: string) => {
  return sessionCache.get(filePath) ?? null;
};
