import { parseOpencodeSession } from "../opencode/parseSession";
import { readSessionHeader } from "../opencode/sessionFiles";
import { decodeProjectId } from "../project/id";
import type { SessionDetail } from "../types";
import { decodeSessionId } from "./id";

export const getSession = async (
  projectId: string,
  sessionId: string,
): Promise<{
  session: SessionDetail;
}> => {
  const workspacePath = await decodeProjectId(projectId);
  const sessionPath = decodeSessionId(sessionId);

  const header = await readSessionHeader(sessionPath);
  if (header?.workspacePath && header.workspacePath !== workspacePath) {
    throw new Error("Session does not belong to the requested project");
  }

  const parsed = await parseOpencodeSession(sessionPath);

  const sessionDetail: SessionDetail = {
    id: sessionId,
    sessionUuid: parsed.sessionUuid ?? header?.sessionUuid ?? null,
    jsonlFilePath: sessionPath,
    meta: parsed.summary,
    entries: parsed.entries,
    turns: parsed.turns,
    metaEvents: parsed.metaEvents,
    sessionMeta: parsed.sessionMeta,
  };

  return {
    session: sessionDetail,
  };
};
