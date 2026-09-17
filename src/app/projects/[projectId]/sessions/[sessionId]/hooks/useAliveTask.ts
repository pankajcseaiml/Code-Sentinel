import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { honoClient } from "../../../../../../lib/api/client";
import { aliveTasksAtom } from "../store/aliveTasksAtom";

export const useAliveTask = (
  sessionPathId: string,
  sessionUuid?: string | null,
) => {
  const [aliveTasks, setAliveTasks] = useAtom(aliveTasksAtom);

  useQuery({
    queryKey: ["aliveTasks"],
    queryFn: async () => {
      const response = await honoClient.api.tasks.alive.$get({});

      if (!response.ok) {
        throw new Error(response.statusText);
      }

      const data = await response.json();
      setAliveTasks(data.aliveTasks);
      return response.json();
    },
    refetchOnReconnect: true,
  });

  const taskInfo = useMemo(() => {
    const aliveTask = aliveTasks.find((task) => {
      if (sessionUuid && task.sessionUuid === sessionUuid) {
        return true;
      }
      return task.sessionId === sessionPathId;
    });

    const status = aliveTask?.status;
    return {
      aliveTask,
      isRunningTask: status === "running",
      isPausedTask: status === "waiting",
    } as const;
  }, [aliveTasks, sessionPathId, sessionUuid]);

  return taskInfo;
};
