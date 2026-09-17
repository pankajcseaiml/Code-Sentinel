import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

import type { ParsedCommand } from "../parseCommandXml";
import { opencodeMessagesRootPath, opencodePartsRootPath } from "../paths";
import type {
  CodexConversationEntry,
  CodexMessage,
  CodexMetaEvent,
  CodexReasoning,
  CodexSessionMeta,
  CodexSessionTurn,
  CodexToolCall,
  CodexToolResult,
  SessionMeta,
} from "../types";

type OpencodeSessionFile = {
  id?: unknown;
  version?: unknown;
  directory?: unknown;
  title?: unknown;
  time?: {
    created?: unknown;
    updated?: unknown;
  };
};

type OpencodeMessageFile = {
  id?: unknown;
  role?: unknown;
  time?: {
    created?: unknown;
    completed?: unknown;
  };
};

type OpencodePartFile = {
  id?: unknown;
  type?: unknown;
  text?: unknown;
  synthetic?: unknown;
  sessionID?: unknown;
  messageID?: unknown;
  callID?: unknown;
  tool?: unknown;
  state?: unknown;
  snapshot?: unknown;
  hash?: unknown;
  files?: unknown;
  metadata?: unknown;
  time?: {
    start?: unknown;
    end?: unknown;
  };
};

type LoadedMessage = {
  message: {
    id: string;
    role: string;
    time: Record<string, unknown>;
    raw: OpencodeMessageFile;
  };
  parts: OpencodePartFile[];
};

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

const safeJsonStringify = (value: unknown) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    console.warn("Failed to stringify JSON value", error);
    return String(value);
  }
};

const readJsonFile = async <T>(path: string): Promise<T | null> => {
  try {
    const content = await readFile(path, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    console.warn(`Failed to parse JSON for ${path}`, error);
    return null;
  }
};

const loadMessageParts = async (
  messageId: string,
): Promise<OpencodePartFile[]> => {
  const partsDir = join(opencodePartsRootPath, messageId);
  let entries: string[] = [];
  try {
    entries = await readdir(partsDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Failed to read parts directory ${partsDir}`, error);
    }
    return [];
  }

  const parts: OpencodePartFile[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const partPath = join(partsDir, entry);
    const parsed = await readJsonFile<OpencodePartFile>(partPath);
    if (parsed) {
      parts.push(parsed);
    }
  }

  const orderValue = (part: OpencodePartFile) => {
    const start = toDate((part.time as { start?: unknown } | undefined)?.start);
    const end = toDate((part.time as { end?: unknown } | undefined)?.end);
    return start?.getTime() ?? end?.getTime() ?? Number.MAX_SAFE_INTEGER;
  };

  parts.sort((a, b) => orderValue(a) - orderValue(b));
  return parts;
};

const getMessageCreated = (message: LoadedMessage["message"]) => {
  const time = message.raw.time as { created?: unknown } | undefined;
  return toDate(time?.created);
};

const loadMessages = async (sessionId: string): Promise<LoadedMessage[]> => {
  const messagesDir = join(opencodeMessagesRootPath, sessionId);
  let entries: string[] = [];
  try {
    entries = await readdir(messagesDir);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Failed to read messages directory ${messagesDir}`, error);
    }
    return [];
  }

  const messages: LoadedMessage[] = [];
  for (const entry of entries) {
    if (!entry.endsWith(".json")) continue;
    const messagePath = join(messagesDir, entry);
    const parsed = await readJsonFile<OpencodeMessageFile>(messagePath);
    if (
      !parsed ||
      typeof parsed.id !== "string" ||
      typeof parsed.role !== "string"
    ) {
      continue;
    }
    const withDefaults: LoadedMessage["message"] = {
      id: parsed.id as string,
      role: parsed.role as string,
      time: (parsed.time ?? {}) as Record<string, unknown>,
      raw: parsed,
    };
    const parts = await loadMessageParts(parsed.id);
    messages.push({ message: withDefaults, parts });
  }

  messages.sort((a, b) => {
    const aTime = getMessageCreated(a.message)?.getTime() ?? 0;
    const bTime = getMessageCreated(b.message)?.getTime() ?? 0;
    return aTime - bTime;
  });

  return messages;
};

const combineTextParts = (parts: OpencodePartFile[]) => {
  const texts: string[] = [];
  for (const part of parts) {
    if (part.type === "text" && typeof part.text === "string") {
      texts.push(part.text.trim());
    }
  }
  return texts.join("\n\n").trim();
};

const extractReasonings = (
  parts: OpencodePartFile[],
  timestamp: string | null,
): CodexReasoning[] => {
  const items: CodexReasoning[] = [];
  for (const part of parts) {
    if (part.type !== "reasoning") continue;
    const text = typeof part.text === "string" ? part.text : null;
    items.push({
      id:
        typeof part.id === "string" ? part.id : `reasoning-${items.length + 1}`,
      summary: null,
      text,
      timestamp,
      encrypted: false,
    });
  }
  return items;
};

const extractToolData = (
  parts: OpencodePartFile[],
  timestamp: string | null,
): {
  calls: CodexToolCall[];
  results: CodexToolResult[];
  entries: CodexConversationEntry[];
} => {
  const calls: CodexToolCall[] = [];
  const results: CodexToolResult[] = [];
  const entries: CodexConversationEntry[] = [];

  for (const part of parts) {
    if (part.type !== "tool") continue;
    const id =
      typeof part.id === "string" ? part.id : `tool-${calls.length + 1}`;
    const callId = typeof part.callID === "string" ? part.callID : null;
    const toolName = typeof part.tool === "string" ? part.tool : "tool";
    const state = part.state as
      | {
          status?: string;
          input?: unknown;
          output?: unknown;
          error?: unknown;
        }
      | undefined;

    const call: CodexToolCall = {
      id,
      name: toolName,
      arguments: state?.input ? safeJsonStringify(state.input) : null,
      callId,
      timestamp,
    };
    calls.push(call);
    entries.push({
      type: "tool-call",
      id,
      name: toolName,
      arguments: call.arguments,
      callId,
      timestamp,
    });

    if (state?.status === "completed" || state?.status === "error") {
      const outputPayload =
        state.status === "error" ? state.error : state.output;
      const result: CodexToolResult = {
        id: `${id}-result`,
        callId,
        output: outputPayload ? safeJsonStringify(outputPayload) : null,
        timestamp,
      };
      results.push(result);
      entries.push({
        type: "tool-result",
        id: result.id,
        callId: result.callId,
        output: result.output,
        timestamp: result.timestamp,
      });
    }
  }

  return { calls, results, entries };
};

const extractSystemEntries = (
  parts: OpencodePartFile[],
  timestamp: string | null,
): CodexConversationEntry[] => {
  const entries: CodexConversationEntry[] = [];
  for (const part of parts) {
    if (
      part.type === "text" ||
      part.type === "reasoning" ||
      part.type === "tool"
    ) {
      continue;
    }
    const subtype = typeof part.type === "string" ? part.type : "unknown";
    entries.push({
      type: "system",
      id:
        typeof part.id === "string" ? part.id : `system-${entries.length + 1}`,
      timestamp,
      subtype,
      text: safeJsonStringify(part),
    });
  }
  return entries;
};

export type ParsedOpencodeSession = {
  entries: CodexConversationEntry[];
  turns: CodexSessionTurn[];
  metaEvents: CodexMetaEvent[];
  sessionMeta: CodexSessionMeta;
  summary: SessionMeta;
  sessionUuid: string | null;
};

export const parseOpencodeSession = async (
  sessionPath: string,
): Promise<ParsedOpencodeSession> => {
  const sessionFile = await readJsonFile<OpencodeSessionFile>(sessionPath);
  const sessionUuid =
    sessionFile && typeof sessionFile.id === "string" ? sessionFile.id : null;

  const messages = sessionUuid ? await loadMessages(sessionUuid) : [];

  const entries: CodexConversationEntry[] = [];
  const turns: CodexSessionTurn[] = [];
  const metaEvents: CodexMetaEvent[] = [];

  const ensureTurn = () => {
    const turn: CodexSessionTurn = {
      id: `turn-${turns.length + 1}`,
      userMessage: null,
      assistantMessages: [],
      reasonings: [],
      toolCalls: [],
      toolResults: [],
      metaEvents: [],
    };
    turns.push(turn);
    return turn;
  };

  let currentTurn: CodexSessionTurn | null = null;
  let messageCount = 0;
  let firstCommand: ParsedCommand | null = null;

  for (const { message, parts } of messages) {
    messageCount += 1;
    const timestamp = getMessageCreated(message)?.toISOString() ?? null;

    if (message.role === "user") {
      const text = combineTextParts(parts);
      if (!currentTurn || currentTurn.userMessage !== null) {
        currentTurn = ensureTurn();
      }
      const userEntry: CodexConversationEntry = {
        type: "user",
        id: message.id,
        timestamp,
        text,
        source: "response_item",
      };
      entries.push(userEntry);

      const userMessage: CodexMessage = {
        id: message.id,
        text,
        timestamp,
        source: "response_item",
      };
      currentTurn.userMessage = userMessage;

      if (!firstCommand && text.length > 0) {
        firstCommand = {
          kind: "text",
          content: text,
        };
      }
      continue;
    }

    if (!currentTurn) {
      currentTurn = ensureTurn();
    }

    const text = combineTextParts(parts);
    if (text.length > 0) {
      const assistantEntry: CodexConversationEntry = {
        type: "assistant",
        id: message.id,
        timestamp,
        text,
        source: "response_item",
      };
      entries.push(assistantEntry);

      const assistantMessage: CodexMessage = {
        id: message.id,
        text,
        timestamp,
        source: "response_item",
      };
      currentTurn.assistantMessages.push(assistantMessage);
    }

    const reasonings = extractReasonings(parts, timestamp);
    for (const reasoning of reasonings) {
      currentTurn.reasonings.push(reasoning);
      entries.push({
        type: "assistant-reasoning",
        id: reasoning.id,
        timestamp: reasoning.timestamp,
        summary: reasoning.summary,
        text: reasoning.text,
        encrypted: reasoning.encrypted,
      });
    }

    const toolData = extractToolData(parts, timestamp);
    currentTurn.toolCalls.push(...toolData.calls);
    currentTurn.toolResults.push(...toolData.results);
    entries.push(...toolData.entries);

    // Log when assistant message has no text but has other content
    if (
      text.length === 0 &&
      (reasonings.length > 0 || toolData.calls.length > 0)
    ) {
      console.log(
        `Assistant message ${message.id} has no text but contains ${reasonings.length} reasonings and ${toolData.calls.length} tool calls`,
      );
    }

    const systemEntries = extractSystemEntries(parts, timestamp);
    entries.push(...systemEntries);
  }

  const sessionMeta: CodexSessionMeta = {
    sessionUuid,
    cwd:
      sessionFile && typeof sessionFile.directory === "string"
        ? sessionFile.directory
        : null,
    instructions:
      sessionFile && typeof sessionFile.title === "string"
        ? sessionFile.title
        : null,
    originator: null,
    cliVersion:
      sessionFile && typeof sessionFile.version === "string"
        ? sessionFile.version
        : null,
    timestamp: toISOString(sessionFile?.time?.created) ?? null,
  };

  const summary: SessionMeta = {
    messageCount,
    firstCommand,
    lastModifiedAt: toISOString(sessionFile?.time?.updated),
    startedAt: toISOString(sessionFile?.time?.created),
  };

  return {
    entries,
    turns,
    metaEvents,
    sessionMeta,
    summary,
    sessionUuid,
  } satisfies ParsedOpencodeSession;
};

export const summarizeOpencodeSession = async (
  sessionPath: string,
): Promise<SessionMeta> => {
  const sessionFile = await readJsonFile<OpencodeSessionFile>(sessionPath);
  const sessionUuid =
    sessionFile && typeof sessionFile.id === "string" ? sessionFile.id : null;

  let messageCount = 0;
  let firstCommand: ParsedCommand | null = null;

  if (sessionUuid) {
    const messagesDir = join(opencodeMessagesRootPath, sessionUuid);
    let entries: string[] = [];
    try {
      entries = await readdir(messagesDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        console.warn(`Failed to read messages directory ${messagesDir}`, error);
      }
      entries = [];
    }

    const candidateFiles = entries
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => join(messagesDir, entry));

    const messageStats = await Promise.all(
      candidateFiles.map(async (filePath) => {
        const parsed = await readJsonFile<OpencodeMessageFile>(filePath);
        const created = toDate(parsed?.time?.created)?.getTime() ?? 0;
        return { filePath, parsed, created };
      }),
    );

    messageStats.sort((a, b) => a.created - b.created);

    messageCount = messageStats.length;

    for (const { parsed } of messageStats) {
      if (!parsed || parsed.role !== "user" || typeof parsed.id !== "string") {
        continue;
      }
      const parts = await loadMessageParts(parsed.id);
      const text = combineTextParts(parts);
      if (text.length > 0) {
        firstCommand = {
          kind: "text",
          content: text,
        };
        break;
      }
    }
  }

  return {
    messageCount,
    firstCommand,
    lastModifiedAt: toISOString(sessionFile?.time?.updated),
    startedAt: toISOString(sessionFile?.time?.created),
  } satisfies SessionMeta;
};
