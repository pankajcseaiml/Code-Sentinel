import { useQuery } from "@tanstack/react-query";
import { honoClient } from "../../../lib/api/client";
import type { Project } from "../../../server/service/types";

type ProjectResponse = {
  id: string;
  workspacePath: string;
  meta: {
    workspaceName: string;
    workspacePath: string;
    lastSessionAt: string | null;
    sessionCount: number;
  };
};

export const projetsQueryConfig = {
  queryKey: ["projects"],
  queryFn: async () => {
    const response = await honoClient.api.projects.$get();

    if (!response.ok) {
      if (response.status === 401) {
        return [];
      }
      throw new Error("Failed to fetch projects");
    }

    const { projects } = (await response.json()) as {
      projects: ProjectResponse[];
    };

    return projects.map((project) => {
      return {
        ...project,
        meta: {
          ...project.meta,
          lastSessionAt:
            project.meta.lastSessionAt !== null
              ? new Date(project.meta.lastSessionAt)
              : null,
        },
      } satisfies Project;
    });
  },
} as const;

export const useProjects = () => {
  return useQuery({
    queryKey: projetsQueryConfig.queryKey,
    queryFn: projetsQueryConfig.queryFn,
    initialData: [],
  });
};
