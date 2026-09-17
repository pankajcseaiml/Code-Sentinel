import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { honoClient } from "../../../../../lib/api/client";

export const useNewChatMutation = (
  projectId: string,
  onSuccess?: () => void,
) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: {
      message: string;
      model?: string;
      agent?: string;
    }) => {
      const response = await honoClient.api.projects[":projectId"][
        "new-session"
      ].$post(
        {
          param: { projectId },
          json: {
            message: options.message,
            model: options.model,
            agent: options.agent,
          },
        },
        {
          init: {
            signal: AbortSignal.timeout(120 * 1000),
          },
        },
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = (await response.json()) as {
        sessionId: string;
        sessionUuid: string | null;
        userMessageId: string;
      };
      return data;
    },
    onSuccess: async (data) => {
      onSuccess?.();
      await queryClient.invalidateQueries({ queryKey: ["sessions"] });
      router.push(
        `/projects/${projectId}/sessions/${data.sessionId}#message-${data.userMessageId}`,
      );
    },
  });
};

export const useResumeChatMutation = (projectId: string, sessionId: string) => {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (options: {
      message: string;
      model?: string;
      agent?: string;
    }) => {
      const response = await honoClient.api.projects[":projectId"].sessions[
        ":sessionId"
      ].resume.$post(
        {
          param: { projectId, sessionId },
          json: {
            resumeMessage: options.message,
            model: options.model,
            agent: options.agent,
          },
        },
        {
          init: {
            signal: AbortSignal.timeout(120 * 1000),
          },
        },
      );

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = (await response.json()) as {
        sessionId: string;
        sessionUuid: string | null;
        userMessageId: string;
      };
      return data;
    },
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({
          queryKey: ["sessions", data.sessionId],
        }),
      ]);

      if (sessionId !== data.sessionId) {
        router.push(
          `/projects/${projectId}/sessions/${data.sessionId}#message-${data.userMessageId}`,
        );
      }
    },
  });
};
