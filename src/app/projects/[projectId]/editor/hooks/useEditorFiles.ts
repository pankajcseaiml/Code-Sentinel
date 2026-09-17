import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FileNode } from "../components/FileTree";

interface FileTreeResponse {
  files: FileNode[];
  basePath: string;
}

interface FileContentResponse {
  content: string;
  path: string;
}

export const useEditorFiles = (projectId: string, path?: string) => {
  return useQuery({
    queryKey: ["editor-files", projectId, path],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (path) {
        params.set("path", path);
      }
      const response = await fetch(
        `/api/projects/${projectId}/editor/files?${params}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch files");
      }
      return response.json() as Promise<FileTreeResponse>;
    },
  });
};

export const useFileContent = (projectId: string, filePath: string | null) => {
  return useQuery({
    queryKey: ["file-content", projectId, filePath],
    queryFn: async () => {
      if (!filePath) {
        return null;
      }
      const params = new URLSearchParams({ path: filePath });
      const response = await fetch(
        `/api/projects/${projectId}/editor/file-content?${params}`,
      );
      if (!response.ok) {
        throw new Error("Failed to fetch file content");
      }
      return response.json() as Promise<FileContentResponse>;
    },
    enabled: !!filePath,
  });
};

export const useSaveFile = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      path,
      content,
    }: {
      path: string;
      content: string;
    }) => {
      const response = await fetch(
        `/api/projects/${projectId}/editor/file-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path, content }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to save file");
      }
      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["file-content", projectId, variables.path],
      });
    },
  });
};

export const useCreateFile = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      const response = await fetch(
        `/api/projects/${projectId}/editor/create-file`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to create file");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["editor-files", projectId],
      });
    },
  });
};

export const useCreateDirectory = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      const response = await fetch(
        `/api/projects/${projectId}/editor/create-directory`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ path }),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to create directory");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["editor-files", projectId],
      });
    },
  });
};

export const useDeleteFile = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ path }: { path: string }) => {
      const response = await fetch(`/api/projects/${projectId}/editor/delete`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ path }),
      });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["editor-files", projectId],
      });
    },
  });
};

export const useRenameFile = (projectId: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      oldPath,
      newPath,
    }: {
      oldPath: string;
      newPath: string;
    }) => {
      const response = await fetch(`/api/projects/${projectId}/editor/rename`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ oldPath, newPath }),
      });
      if (!response.ok) {
        throw new Error("Failed to rename");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["editor-files", projectId],
      });
    },
  });
};
