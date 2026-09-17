import { homedir } from "node:os";
import { resolve } from "node:path";

const env = process.env as NodeJS.ProcessEnv;
const XDG_DATA_HOME = "XDG_DATA_HOME" as const;
const OPENCODE_STORAGE_ROOT = "OPENCODE_STORAGE_ROOT" as const;

const xdgDataHome = env[XDG_DATA_HOME] ?? resolve(homedir(), ".local", "share");

const defaultDataRoot = resolve(xdgDataHome, "opencode");

const storageRootFromEnv = env[OPENCODE_STORAGE_ROOT]
  ? resolve(env[OPENCODE_STORAGE_ROOT] as string)
  : resolve(defaultDataRoot, "storage");

export const opencodeStorageRootPath = storageRootFromEnv;
export const opencodeSessionsRootPath = resolve(
  opencodeStorageRootPath,
  "session",
);
export const opencodeMessagesRootPath = resolve(
  opencodeStorageRootPath,
  "message",
);
export const opencodePartsRootPath = resolve(opencodeStorageRootPath, "part");
