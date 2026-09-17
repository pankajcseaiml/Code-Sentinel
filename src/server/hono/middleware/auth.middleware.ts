import { getCookie } from "hono/cookie";
import { createMiddleware } from "hono/factory";
import { AuthService } from "../../service/auth/authService";
import type { HonoContext } from "../app";

export const authMiddleware = createMiddleware<HonoContext>(async (c, next) => {
  let token = getCookie(c, "auth-token");

  if (!token) {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
  }

  if (token) {
    const user = await AuthService.verifyToken(token);
    if (user) {
      c.set("user", user);
    }
  }

  await next();
});

export const requireAuth = createMiddleware<HonoContext>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  await next();
  return;
});

export const requireAdmin = createMiddleware<HonoContext>(async (c, next) => {
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Authentication required" }, 401);
  }

  if (!user.is_admin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  await next();
  return;
});
