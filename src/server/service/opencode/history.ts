export type OpencodeHistoryEntry = {
  sessionId: string;
  timestamp: Date | null;
  text: string | null;
};

export const getHistoryTimestamps = async (): Promise<Map<string, Date>> => {
  return new Map();
};

export const readLatestHistoryEntry =
  async (): Promise<OpencodeHistoryEntry | null> => {
    return null;
  };
