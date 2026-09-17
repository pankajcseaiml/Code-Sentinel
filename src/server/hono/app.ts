import { Hono } from "hono";
import type { Config } from "../config/config";
import type { UserPublic } from "../db/types";

export type HonoContext = {
  Variables: {
    config: Config;
    user?: UserPublic;
  };
};

export const honoApp = new Hono<HonoContext>().basePath("/api");

export type HonoAppType = typeof honoApp;
