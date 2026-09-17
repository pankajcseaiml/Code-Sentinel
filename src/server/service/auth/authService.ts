import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getPool } from "../../db/config";
import type {
  AuthResponse,
  RecentUserStats,
  User,
  UserPublic,
  UserSession,
} from "../../db/types";

// biome-ignore lint/complexity/useLiteralKeys: TypeScript restriction
const JWT_SECRET = process.env["JWT_SECRET"] || "super-secret-jwt-key";
// biome-ignore lint/complexity/useLiteralKeys: TypeScript restriction
const JWT_EXPIRES_IN = process.env["JWT_EXPIRES_IN"] || "7d";

export class AuthService {
  private static toPublicUser(user: User): UserPublic {
    return {
      id: user.id,
      email: user.email,
      full_name: user.full_name,
      is_admin: user.is_admin,
      created_at: user.created_at,
    };
  }

  static async signup(
    email: string,
    password: string,
    fullName: string,
  ): Promise<AuthResponse> {
    const pool = getPool();

    // Check if user already exists
    const existingUser = await pool.query<User>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    if (existingUser.rows.length > 0) {
      throw new Error("User with this email already exists");
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const result = await pool.query<User>(
      `INSERT INTO users (email, password_hash, full_name, is_admin) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [email, passwordHash, fullName, false],
    );

    const user = result.rows[0];
    if (!user) {
      throw new Error("Failed to create user");
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Store session
    await pool.query(
      `INSERT INTO user_sessions (user_id, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt],
    );

    return {
      user: AuthService.toPublicUser(user),
      token,
    };
  }

  static async login(email: string, password: string): Promise<AuthResponse> {
    const pool = getPool();

    // Find user
    const result = await pool.query<User>(
      "SELECT * FROM users WHERE email = $1",
      [email],
    );

    if (result.rows.length === 0) {
      throw new Error("Invalid email or password");
    }

    const user = result.rows[0];
    if (!user) {
      throw new Error("Invalid email or password");
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error("Invalid email or password");
    }

    // Generate JWT token
    const token = jwt.sign({ userId: user.id, email: user.email }, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days from now

    // Store session
    await pool.query(
      `INSERT INTO user_sessions (user_id, token, expires_at) 
       VALUES ($1, $2, $3)`,
      [user.id, token, expiresAt],
    );

    return {
      user: AuthService.toPublicUser(user),
      token,
    };
  }

  static async logout(token: string): Promise<void> {
    const pool = getPool();
    await pool.query("DELETE FROM user_sessions WHERE token = $1", [token]);
  }

  static async verifyToken(token: string): Promise<UserPublic | null> {
    try {
      const pool = getPool();

      // Verify JWT
      const decoded = jwt.verify(token, JWT_SECRET) as {
        userId: number;
        email: string;
      };

      // Check if session exists and is not expired
      const sessionResult = await pool.query<UserSession>(
        `SELECT * FROM user_sessions 
         WHERE token = $1 AND expires_at > NOW()`,
        [token],
      );

      if (sessionResult.rows.length === 0) {
        return null;
      }

      // Get user data
      const userResult = await pool.query<User>(
        "SELECT * FROM users WHERE id = $1",
        [decoded.userId],
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      const user = userResult.rows[0];
      if (!user) {
        return null;
      }
      return AuthService.toPublicUser(user);
    } catch (error) {
      console.error("Token verification error:", error);
      return null;
    }
  }

  static async getAllUsers(): Promise<UserPublic[]> {
    const pool = getPool();
    const result = await pool.query<User>(
      "SELECT * FROM users ORDER BY created_at DESC",
    );
    return result.rows.map(AuthService.toPublicUser);
  }

  static async getRecentUserStats(): Promise<RecentUserStats> {
    const pool = getPool();

    // Get total users
    const totalResult = await pool.query<{ count: string }>(
      "SELECT COUNT(*) as count FROM users",
    );
    const totalUsers = Number.parseInt(totalResult.rows[0]?.count || "0", 10);

    // Get users from last 7 days
    const recentResult = await pool.query<User>(
      `SELECT * FROM users 
       WHERE created_at >= NOW() - INTERVAL '7 days' 
       ORDER BY created_at DESC`,
    );
    const recentUsers = recentResult.rows.map(AuthService.toPublicUser);
    const weeklySignups = recentUsers.length;

    return {
      totalUsers,
      recentUsers,
      weeklySignups,
    };
  }

  static async getUserById(userId: number): Promise<UserPublic | null> {
    const pool = getPool();
    const result = await pool.query<User>("SELECT * FROM users WHERE id = $1", [
      userId,
    ]);

    const user = result.rows[0];
    if (!user) {
      return null;
    }

    return AuthService.toPublicUser(user);
  }
}
