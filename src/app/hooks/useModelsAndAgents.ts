import { useQuery } from "@tanstack/react-query";
import { honoClient } from "../../lib/api/client";

export interface Model {
  provider: string;
  model: string;
  displayName: string;
}

export interface Agent {
  name: string;
  description: string;
  mode: "primary" | "subagent" | "all";
}

export const useModels = () => {
  return useQuery({
    queryKey: ["opencode", "models"],
    queryFn: async () => {
      const response = await honoClient.api.opencode.models.$get();
      if (!response.ok) {
        throw new Error("Failed to fetch models");
      }
      const data = await response.json();
      return data.models as Model[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};

export const useAgents = (projectId?: string) => {
  return useQuery({
    queryKey: ["opencode", "agents", projectId],
    queryFn: async () => {
      const response = await honoClient.api.opencode.agents.$get({
        query: projectId ? { projectId } : {},
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agents");
      }
      const data = await response.json();
      return data.agents as Agent[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
};
