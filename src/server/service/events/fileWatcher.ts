import {
  existsSync,
  type FSWatcher,
  type WatchEventType,
  watch,
} from "node:fs";
import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  findSessionRecordByUuid,
  getCachedSessionRecord,
  readSessionHeader,
} from "../opencode/sessionFiles";
import {
  opencodeMessagesRootPath,
  opencodePartsRootPath,
  opencodeSessionsRootPath,
} from "../paths";
import { encodeProjectId } from "../project/id";
import { encodeSessionId } from "../session/id";
import { type EventBus, getEventBus } from "./EventBus";

export class FileWatcherService {
  private watcher: FSWatcher | null = null;
  private projectWatchers: Map<string, FSWatcher> = new Map();
  private messageWatcher: FSWatcher | null = null;
  private partWatcher: FSWatcher | null = null;
  private eventBus: EventBus;

  constructor() {
    this.eventBus = getEventBus();
  }

  private emitSessionEvents(
    projectId: string | null,
    sessionId: string,
    eventType: WatchEventType,
  ) {
    this.eventBus.emit("project_changed", {
      type: "project_changed",
      data: {
        fileEventType: eventType,
        projectId,
      },
    });

    this.eventBus.emit("session_changed", {
      type: "session_changed",
      data: {
        projectId,
        sessionId,
        fileEventType: eventType,
      },
    });
  }

  private async resolveSessionIdentifiers(sessionUuid: string | null) {
    if (!sessionUuid) {
      return null;
    }

    try {
      const record = await findSessionRecordByUuid(sessionUuid);
      if (!record) {
        return null;
      }

      const sessionId = encodeSessionId(record.filePath);
      const projectId = record.workspacePath
        ? encodeProjectId(record.workspacePath)
        : null;

      return {
        projectId,
        sessionId,
      } as const;
    } catch (error) {
      console.warn("Failed to resolve session identifiers", error);
      return null;
    }
  }

  public startWatching(): void {
    if (this.watcher) {
      return;
    }

    try {
      console.log("Starting file watcher on:", opencodeSessionsRootPath);
      this.watcher = watch(
        opencodeSessionsRootPath,
        { persistent: false, recursive: true },
        async (eventType, filename) => {
          if (!filename || !filename.endsWith(".json")) return;

          const absolutePath = join(opencodeSessionsRootPath, filename);
          let projectId: string | null = null;

          if (existsSync(absolutePath)) {
            const header = await readSessionHeader(absolutePath);
            if (header?.workspacePath) {
              projectId = encodeProjectId(header.workspacePath);
            }
          }

          if (!projectId) {
            const cached = getCachedSessionRecord(absolutePath);
            if (cached?.workspacePath) {
              projectId = encodeProjectId(cached.workspacePath);
            }
          }

          const sessionId = encodeSessionId(absolutePath);
          this.emitSessionEvents(projectId, sessionId, eventType);
        },
      );
      console.log("File watcher initialization completed");

      if (existsSync(opencodeMessagesRootPath) && !this.messageWatcher) {
        this.messageWatcher = watch(
          opencodeMessagesRootPath,
          { persistent: false, recursive: true },
          async (eventType, filename) => {
            if (!filename || !filename.endsWith(".json")) return;

            const absolutePath = join(opencodeMessagesRootPath, filename);
            const sessionUuid = basename(dirname(absolutePath));
            const identifiers =
              await this.resolveSessionIdentifiers(sessionUuid);
            if (!identifiers) {
              return;
            }

            this.emitSessionEvents(
              identifiers.projectId,
              identifiers.sessionId,
              eventType,
            );
          },
        );
      }

      if (existsSync(opencodePartsRootPath) && !this.partWatcher) {
        this.partWatcher = watch(
          opencodePartsRootPath,
          { persistent: false, recursive: true },
          async (eventType, filename) => {
            if (!filename || !filename.endsWith(".json")) return;

            const absolutePath = join(opencodePartsRootPath, filename);
            if (!existsSync(absolutePath)) {
              return;
            }

            let sessionUuid: string | null = null;
            try {
              const raw = await readFile(absolutePath, "utf-8");
              const parsed = JSON.parse(raw) as { sessionID?: unknown };
              if (typeof parsed.sessionID === "string") {
                sessionUuid = parsed.sessionID;
              }
            } catch (error) {
              console.warn("Failed to read part file", absolutePath, error);
            }

            const identifiers =
              await this.resolveSessionIdentifiers(sessionUuid);
            if (!identifiers) {
              return;
            }

            this.emitSessionEvents(
              identifiers.projectId,
              identifiers.sessionId,
              eventType,
            );
          },
        );
      }
    } catch (error) {
      console.error("Failed to start file watching:", error);
    }
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }

    if (this.messageWatcher) {
      this.messageWatcher.close();
      this.messageWatcher = null;
    }

    if (this.partWatcher) {
      this.partWatcher.close();
      this.partWatcher = null;
    }

    for (const [, watcher] of this.projectWatchers) {
      watcher.close();
    }
    this.projectWatchers.clear();
  }
}

// シングルトンインスタンス
let watcherInstance: FileWatcherService | null = null;

export const getFileWatcher = (): FileWatcherService => {
  if (!watcherInstance) {
    console.log("Creating new FileWatcher instance");
    watcherInstance = new FileWatcherService();
  }
  return watcherInstance;
};
