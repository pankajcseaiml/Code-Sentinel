import type { UserPublic } from "../../server/db/types";

export interface AdminStats {
  totalUsers: number;
  recentUsers: UserPublic[];
  weeklySignups: number;
}

export const getAllUsers = async (): Promise<UserPublic[]> => {
  const response = await fetch("/api/admin/users", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch users");
  }

  const data = await response.json();
  return data.users;
};

export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await fetch("/api/admin/stats", {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error("Failed to fetch admin stats");
  }

  return response.json();
};
