import { honoClient } from "./client";

export const createProject = async (projectName: string) => {
  const response = await honoClient.api.projects.$post({
    json: {
      projectName,
    },
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error("error" in data ? data.error : "Failed to create project");
  }

  return response.json();
};
