import type { ChildProcess } from "node:child_process";

export type OpencodeTaskStatus = "running" | "waiting" | "completed" | "failed";

export type QueuedMessage = {
  requestId: string;
  message: string;
  resolve: (value: SerializableAliveTask) => void;
  reject: (reason?: unknown) => void;
};

export type OpencodeTask = {
  id: string;
  projectId: string;
  cwd: string;
  status: OpencodeTaskStatus;
  sessionUuid: string | null;
  sessionPathId: string | null;
  userMessageId: string;
  process: ChildProcess | null;
  queue: QueuedMessage[];
};

export type SerializableAliveTask = {
  id: string;
  status: OpencodeTaskStatus;
  sessionId: string | null;
  sessionUuid: string | null;
  userMessageId: string;
};
