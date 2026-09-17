export interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string;
  is_admin: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface UserSession {
  id: number;
  user_id: number;
  token: string;
  expires_at: Date;
  created_at: Date;
}

export interface UserPublic {
  id: number;
  email: string;
  full_name: string;
  is_admin: boolean;
  created_at: Date;
}

export interface AuthResponse {
  user: UserPublic;
  token: string;
}

export interface RecentUserStats {
  totalUsers: number;
  recentUsers: UserPublic[];
  weeklySignups: number;
}
