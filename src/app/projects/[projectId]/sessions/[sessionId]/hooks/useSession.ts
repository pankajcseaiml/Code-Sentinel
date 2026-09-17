import { useSessionQuery } from "./useSessionQuery";

export const useSession = (projectId: string, sessionId: string) => {
  const query = useSessionQuery(projectId, sessionId);

  return {
    session: query.data.session,
    entries: query.data.session.entries,
    turns: query.data.session.turns,
    metaEvents: query.data.session.metaEvents,
    sessionMeta: query.data.session.sessionMeta,
  };
};
