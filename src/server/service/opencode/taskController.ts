import { spawn } from "node:child_process";
import readline from "node:readline";
import prexit from "prexit";
import { ulid } from "ulid";

import { type EventBus, getEventBus } from "../events/EventBus";
import { encodeSessionId } from "../session/id";
import {
  findLatestSessionForWorkspace,
  findSessionRecordByUuid,
} from "./sessionFiles";
import type {
  OpencodeTask,
  OpencodeTaskStatus,
  SerializableAliveTask,
} from "./taskTypes";

type StartSessionOptions = {
  cwd: string;
  projectId: string;
  sessionUuid?: string;
  sessionPathId?: string;
  model?: string;
  agent?: string;
};

type LaunchOptions = {
  message: string;
  requestId: string;
  cwd: string;
  projectId: string;
  sessionUuid?: string;
  sessionPathId?: string;
  model?: string;
  agent?: string;
};

export class OpencodeTaskController {
  private tasks: OpencodeTask[] = [];
  private eventBus: EventBus;

  constructor() {
    this.eventBus = getEventBus();

    prexit(() => {
      for (const task of this.tasks) {
        if (task.process) {
          try {
            task.process.kill("SIGTERM");
          } catch (error) {
            console.warn("Failed to terminate Opencode task", error);
          }
        }
      }
    });
  }

  public get aliveTasks(): OpencodeTask[] {
    return this.tasks.filter(
      (task) => task.status === "running" || task.status === "waiting",
    );
  }

  public getSerializableAliveTasks(): SerializableAliveTask[] {
    return this.aliveTasks.map((task) => this.serializeTask(task));
  }

  private findTask(
    sessionUuid?: string,
    sessionPathId?: string,
  ): OpencodeTask | null {
    if (sessionUuid) {
      const match = this.tasks.find((task) => task.sessionUuid === sessionUuid);
      if (match) {
        return match;
      }
    }
    if (sessionPathId) {
      const match = this.tasks.find(
        (task) => task.sessionPathId === sessionPathId,
      );
      if (match) {
        return match;
      }
    }
    return null;
  }

  public async startOrContinueTask(
    currentSession: StartSessionOptions,
    message: string,
  ): Promise<SerializableAliveTask> {
    const requestId = ulid();
    const existing = this.findTask(
      currentSession.sessionUuid,
      currentSession.sessionPathId,
    );

    if (!existing) {
      const task: OpencodeTask = {
        id: ulid(),
        projectId: currentSession.projectId,
        cwd: currentSession.cwd,
        status: "running",
        sessionUuid: currentSession.sessionUuid ?? null,
        sessionPathId: currentSession.sessionPathId ?? null,
        userMessageId: requestId,
        process: null,
        queue: [],
      };
      this.tasks.push(task);
      return await this.launchProcess(task, {
        message,
        requestId,
        cwd: currentSession.cwd,
        projectId: currentSession.projectId,
        sessionUuid: currentSession.sessionUuid,
        sessionPathId: currentSession.sessionPathId,
        model: currentSession.model,
        agent: currentSession.agent,
      });
    }

    if (existing.status === "running") {
      return await new Promise<SerializableAliveTask>((resolve, reject) => {
        existing.queue.push({ message, requestId, resolve, reject });
        this.emitTaskChange();
      });
    }

    return await this.launchProcess(existing, {
      message,
      requestId,
      cwd: existing.cwd,
      projectId: existing.projectId,
      sessionUuid: existing.sessionUuid ?? currentSession.sessionUuid,
      sessionPathId: existing.sessionPathId ?? currentSession.sessionPathId,
      model: currentSession.model,
      agent: currentSession.agent,
    });
  }

  public abortTask(sessionPathId: string) {
    const task = this.findTask(undefined, sessionPathId);
    if (!task) {
      throw new Error("Alive Opencode task not found");
    }

    if (task.process) {
      try {
        task.process.kill("SIGTERM");
      } catch (error) {
        console.warn("Failed to abort Opencode task", error);
      }
    }

    task.process = null;
    task.status = "failed";
    this.rejectQueuedMessages(task, new Error("Task aborted"));
    this.emitTaskChange();
    this.pruneTaskIfInactive(task);
  }

  private async launchProcess(
    task: OpencodeTask,
    options: LaunchOptions,
  ): Promise<SerializableAliveTask> {
    task.status = "running";
    task.userMessageId = options.requestId;
    if (options.sessionUuid) {
      task.sessionUuid = options.sessionUuid;
    }
    if (options.sessionPathId) {
      task.sessionPathId = options.sessionPathId;
    }
    this.emitTaskChange();

    return await new Promise<SerializableAliveTask>((resolve, reject) => {
      let resolved = false;
      const processStart = Date.now();

      const resolveIfPossible = () => {
        if (!resolved && task.sessionUuid && task.sessionPathId) {
          resolved = true;
          resolve(this.serializeTask(task));
        }
      };

      const rejectOnce = (error: unknown) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      };

      const args = ["run", "--format", "json"];

      if (options.agent) {
        args.push("--agent", options.agent);
      }

      if (options.model) {
        args.push("--model", options.model);
      }

      if (options.sessionUuid) {
        args.push("--session", options.sessionUuid);
      }

      args.push(options.message);

      console.log(
        `[TaskController] Launching opencode with args:`,
        args.slice(0, -1),
        `message: "${options.message.substring(0, 50)}${options.message.length > 50 ? "..." : ""}"`,
      );

      const child = spawn("opencode", args, {
        cwd: options.cwd,
        env: { ...process.env },
        stdio: ["ignore", "pipe", "pipe"],
      });

      task.process = child;

      const rl = readline.createInterface({ input: child.stdout });

      const updateStatus = (status: OpencodeTaskStatus) => {
        if (task.status !== status) {
          task.status = status;
          this.emitTaskChange();
        }
      };

      const ensureSessionPath = (attempt = 0) => {
        if (task.sessionPathId && task.sessionUuid) {
          resolveIfPossible();
          return;
        }

        const assignRecord = (
          record:
            | Awaited<ReturnType<typeof findSessionRecordByUuid>>
            | Awaited<ReturnType<typeof findLatestSessionForWorkspace>>
            | null,
        ) => {
          if (!record) {
            if (task.process && attempt < 10) {
              setTimeout(() => ensureSessionPath(attempt + 1), 500);
            }
            return;
          }
          if (!task.sessionPathId) {
            task.sessionPathId = encodeSessionId(record.filePath);
          }
          if (!task.sessionUuid && record.sessionUuid) {
            task.sessionUuid = record.sessionUuid;
          }
          this.emitTaskChange();
          resolveIfPossible();
        };

        if (task.sessionUuid) {
          void findSessionRecordByUuid(task.sessionUuid).then((record) => {
            if (record) {
              assignRecord(record);
              return;
            }
            void findLatestSessionForWorkspace(task.cwd, processStart).then(
              assignRecord,
            );
          });
        } else {
          void findLatestSessionForWorkspace(task.cwd, processStart).then(
            assignRecord,
          );
        }
      };

      if (options.sessionUuid) {
        task.sessionUuid = options.sessionUuid;
        ensureSessionPath();
      }

      if (!options.sessionUuid) {
        ensureSessionPath();
      }

      rl.on("line", (line) => {
        const trimmed = line.trim();
        if (trimmed.length === 0) {
          return;
        }
        console.log(`[TaskController] opencode stdout:`, trimmed);
        try {
          const parsed = JSON.parse(trimmed) as {
            type?: string;
            sessionID?: unknown;
          };
          if (typeof parsed.sessionID === "string") {
            task.sessionUuid = parsed.sessionID;
            this.emitTaskChange();
            ensureSessionPath();
          }
        } catch (error) {
          console.warn("Failed to parse opencode output", { error, line });
        }
      });

      child.stderr.on("data", (data) => {
        console.error("[TaskController] opencode stderr:", data.toString());
      });

      child.on("exit", (code) => {
        console.log(
          `[TaskController] opencode process exited with code ${code}, sessionUuid: ${task.sessionUuid}`,
        );
        rl.close();
        task.process = null;
        if (task.status === "running") {
          updateStatus(code === 0 ? "completed" : "failed");
        }
        if (task.status === "failed") {
          this.rejectQueuedMessages(task, new Error("Opencode task failed"));
        }

        ensureSessionPath();

        if (task.queue.length > 0) {
          const next = task.queue.shift();
          if (!next) {
            this.emitTaskChange();
            this.pruneTaskIfInactive(task);
            resolveIfPossible();
            return;
          }
          this.launchProcess(task, {
            message: next.message,
            requestId: next.requestId,
            cwd: task.cwd,
            projectId: task.projectId,
            sessionUuid: task.sessionUuid ?? options.sessionUuid,
            sessionPathId: task.sessionPathId ?? options.sessionPathId,
          })
            .then(next.resolve)
            .catch(next.reject);
          return;
        }

        if (task.status === "waiting") {
          this.emitTaskChange();
          resolveIfPossible();
          return;
        }

        this.emitTaskChange();
        this.pruneTaskIfInactive(task);
        resolveIfPossible();
      });

      child.on("error", (error) => {
        rl.close();
        task.process = null;
        updateStatus("failed");
        this.emitTaskChange();
        this.pruneTaskIfInactive(task);
        rejectOnce(error);
      });

      rl.on("close", () => {
        resolveIfPossible();
      });
    });
  }

  private pruneTaskIfInactive(task: OpencodeTask) {
    if (task.status === "waiting") {
      return;
    }
    if (task.queue.length > 0) {
      return;
    }
    this.tasks = this.tasks.filter((candidate) => candidate.id !== task.id);
  }

  private rejectQueuedMessages(task: OpencodeTask, reason: Error) {
    while (task.queue.length > 0) {
      const queued = task.queue.shift();
      if (queued) {
        queued.reject(reason);
      }
    }
  }

  private serializeTask(task: OpencodeTask): SerializableAliveTask {
    return {
      id: task.id,
      status: task.status,
      sessionId: task.sessionPathId,
      sessionUuid: task.sessionUuid,
      userMessageId: task.userMessageId,
    };
  }

  private emitTaskChange() {
    this.eventBus.emit("task_changed", {
      type: "task_changed",
      data: this.getSerializableAliveTasks(),
    });
  }
}
