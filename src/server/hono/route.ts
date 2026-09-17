import { zValidator } from "@hono/zod-validator";
import { getCookie, setCookie } from "hono/cookie";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { configSchema } from "../config/config";
import { AuthService } from "../service/auth/authService";
import {
  createDirectory,
  createFile,
  deleteFileOrDirectory,
  getFileTree,
  readFile,
  renameFileOrDirectory,
  writeFile,
} from "../service/editor/fileOperations";
import { getEventBus } from "../service/events/EventBus";
import { getFileWatcher } from "../service/events/fileWatcher";
import { sseEventResponse } from "../service/events/sseEventResponse";
import { getFileCompletion } from "../service/file-completion/getFileCompletion";
import { getBranches } from "../service/git/getBranches";
import { getCommits } from "../service/git/getCommits";
import { getDiff } from "../service/git/getDiff";
import { getMcpList } from "../service/mcp/getMcpList";
import { getAgents } from "../service/opencode/getAgents";
import { getModels } from "../service/opencode/getModels";
import { readSessionHeader } from "../service/opencode/sessionFiles";
import { OpencodeTaskController } from "../service/opencode/taskController";
import { createProject } from "../service/project/createProject";
import { getProject } from "../service/project/getProject";
import { getProjects } from "../service/project/getProjects";
import { getSession } from "../service/session/getSession";
import { getSessions } from "../service/session/getSessions";
import { decodeSessionId } from "../service/session/id";
import type { HonoAppType } from "./app";
import {
  authMiddleware,
  requireAdmin,
  requireAuth,
} from "./middleware/auth.middleware";
import { configMiddleware } from "./middleware/config.middleware";

export const routes = (app: HonoAppType) => {
  const taskController = new OpencodeTaskController();

  return (
    app
      // middleware
      .use(configMiddleware)
      .use(authMiddleware)

      // Authentication routes
      .post(
        "/auth/signup",
        zValidator(
          "json",
          z.object({
            email: z.string().email("Invalid email format"),
            password: z
              .string()
              .min(6, "Password must be at least 6 characters"),
            fullName: z.string().min(1, "Full name is required"),
          }),
        ),
        async (c) => {
          try {
            const { email, password, fullName } = c.req.valid("json");
            const result = await AuthService.signup(email, password, fullName);

            // Set HTTP-only cookie
            setCookie(c, "auth-token", result.token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 7, // 7 days
              path: "/",
            });

            return c.json(result);
          } catch (error) {
            console.error("Signup error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to create account" }, 500);
          }
        },
      )

      .post(
        "/auth/login",
        zValidator(
          "json",
          z.object({
            email: z.string().email("Invalid email format"),
            password: z.string().min(1, "Password is required"),
          }),
        ),
        async (c) => {
          try {
            const { email, password } = c.req.valid("json");
            const result = await AuthService.login(email, password);

            // Set HTTP-only cookie
            setCookie(c, "auth-token", result.token, {
              httpOnly: true,
              secure: process.env.NODE_ENV === "production",
              sameSite: "lax",
              maxAge: 60 * 60 * 24 * 7, // 7 days
              path: "/",
            });

            return c.json(result);
          } catch (error) {
            console.error("Login error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 401);
            }
            return c.json({ error: "Login failed" }, 500);
          }
        },
      )

      .post("/auth/logout", async (c) => {
        const token = getCookie(c, "auth-token");
        if (token) {
          await AuthService.logout(token);
        }

        // Clear cookie
        setCookie(c, "auth-token", "", {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 0,
          path: "/",
        });

        return c.json({ message: "Logged out successfully" });
      })

      .get("/auth/me", requireAuth, async (c) => {
        const user = c.get("user");
        return c.json({ user });
      })

      // Admin routes
      .get("/admin/users", requireAdmin, async (c) => {
        const users = await AuthService.getAllUsers();
        return c.json({ users });
      })

      .get("/admin/stats", requireAdmin, async (c) => {
        const stats = await AuthService.getRecentUserStats();
        return c.json(stats);
      })

      // routes
      .get("/config", async (c) => {
        return c.json({
          config: c.get("config"),
        });
      })

      .put("/config", zValidator("json", configSchema), async (c) => {
        const { ...config } = c.req.valid("json");

        setCookie(c, "ccv-config", JSON.stringify(config));

        return c.json({
          config,
        });
      })

      .get("/projects", requireAuth, async (c) => {
        const { projects } = await getProjects();
        return c.json({ projects });
      })

      .post(
        "/projects",
        requireAuth,
        zValidator(
          "json",
          z.object({
            projectName: z.string().min(1, "Project name is required"),
          }),
        ),
        async (c) => {
          try {
            const { projectName } = c.req.valid("json");
            const { workspacePath } = await createProject(projectName);
            return c.json({ workspacePath }, 201);
          } catch (error) {
            console.error("Create project error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to create project" }, 500);
          }
        },
      )

      .get("/projects/:projectId", async (c) => {
        const { projectId } = c.req.param();

        const [{ project }, { sessions }] = await Promise.all([
          getProject(projectId),
          getSessions(projectId).then(({ sessions }) => {
            let filteredSessions = sessions;

            // Filter sessions based on hideNoUserMessageSession setting
            if (c.get("config").hideNoUserMessageSession) {
              filteredSessions = filteredSessions.filter((session) => {
                return session.meta.firstCommand !== null;
              });
            }

            // Unify sessions with same title if unifySameTitleSession is enabled
            if (c.get("config").unifySameTitleSession) {
              const sessionMap = new Map<
                string,
                (typeof filteredSessions)[0]
              >();

              for (const session of filteredSessions) {
                // Generate title for comparison
                const title =
                  session.meta.firstCommand !== null
                    ? (() => {
                        const cmd = session.meta.firstCommand;
                        switch (cmd.kind) {
                          case "command":
                            return cmd.commandArgs === undefined
                              ? cmd.commandName
                              : `${cmd.commandName} ${cmd.commandArgs}`;
                          case "local-command":
                            return cmd.stdout;
                          case "text":
                            return cmd.content;
                          default:
                            return session.id;
                        }
                      })()
                    : session.id;

                const existingSession = sessionMap.get(title);
                if (existingSession) {
                  // Keep the session with the latest modification date
                  if (
                    session.meta.lastModifiedAt &&
                    existingSession.meta.lastModifiedAt
                  ) {
                    if (
                      new Date(session.meta.lastModifiedAt) >
                      new Date(existingSession.meta.lastModifiedAt)
                    ) {
                      sessionMap.set(title, session);
                    }
                  } else if (
                    session.meta.lastModifiedAt &&
                    !existingSession.meta.lastModifiedAt
                  ) {
                    sessionMap.set(title, session);
                  }
                  // If no modification dates, keep the existing one
                } else {
                  sessionMap.set(title, session);
                }
              }

              filteredSessions = Array.from(sessionMap.values());
            }

            return {
              sessions: filteredSessions,
            };
          }),
        ] as const);

        return c.json({ project, sessions });
      })

      .get("/projects/:projectId/sessions/:sessionId", async (c) => {
        const { projectId, sessionId } = c.req.param();
        const { session } = await getSession(projectId, sessionId);
        return c.json({ session });
      })

      .get(
        "/projects/:projectId/file-completion",
        zValidator(
          "query",
          z.object({
            basePath: z.string().optional().default("/"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { basePath } = c.req.valid("query");

          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const result = await getFileCompletion(
              project.meta.workspacePath,
              basePath,
            );
            return c.json(result);
          } catch (error) {
            console.error("File completion error:", error);
            return c.json({ error: "Failed to get file completion" }, 500);
          }
        },
      )

      .get("/projects/:projectId/git/branches", async (c) => {
        const { projectId } = c.req.param();
        const { project } = await getProject(projectId);

        if (!project.meta.workspacePath) {
          return c.json({ error: "Project path not found" }, 400);
        }

        try {
          const result = await getBranches(project.meta.workspacePath);
          return c.json(result);
        } catch (error) {
          console.error("Get branches error:", error);
          if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
          }
          return c.json({ error: "Failed to get branches" }, 500);
        }
      })

      .get("/projects/:projectId/git/commits", async (c) => {
        const { projectId } = c.req.param();
        const { project } = await getProject(projectId);

        if (!project.meta.workspacePath) {
          return c.json({ error: "Project path not found" }, 400);
        }

        try {
          const result = await getCommits(project.meta.workspacePath);
          return c.json(result);
        } catch (error) {
          console.error("Get commits error:", error);
          if (error instanceof Error) {
            return c.json({ error: error.message }, 400);
          }
          return c.json({ error: "Failed to get commits" }, 500);
        }
      })

      .post(
        "/projects/:projectId/git/diff",
        zValidator(
          "json",
          z.object({
            fromRef: z.string().min(1, "fromRef is required"),
            toRef: z.string().min(1, "toRef is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { fromRef, toRef } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const result = await getDiff(
              project.meta.workspacePath,
              fromRef,
              toRef,
            );
            return c.json(result);
          } catch (error) {
            console.error("Get diff error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to get diff" }, 500);
          }
        },
      )

      .get("/mcp/list", async (c) => {
        const { servers } = await getMcpList();
        return c.json({ servers });
      })

      .get("/opencode/models", async (c) => {
        const models = await getModels();
        return c.json({ models });
      })

      .get("/opencode/agents", async (c) => {
        const projectId = c.req.query("projectId");
        let workspacePath: string | undefined;

        // If projectId is provided, get the workspace path
        if (projectId) {
          try {
            const { project } = await getProject(projectId);
            workspacePath = project.meta.workspacePath;
          } catch (error) {
            console.warn(
              `Failed to get project workspace for agents: ${error}`,
            );
          }
        }

        const agents = await getAgents(workspacePath);
        return c.json({ agents });
      })

      .post(
        "/projects/:projectId/new-session",
        zValidator(
          "json",
          z.object({
            message: z.string(),
            model: z.string().optional(),
            agent: z.string().optional(),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { message, model, agent } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          // For new sessions, don't pass sessionUuid/sessionPathId
          // This ensures a fresh session is created with the selected agent
          // The --agent flag only works when creating a new session, not continuing one
          const task = await taskController.startOrContinueTask(
            {
              projectId,
              cwd: project.meta.workspacePath,
              model,
              agent,
              // Explicitly don't pass sessionUuid or sessionPathId for new sessions
            },
            message,
          );

          return c.json({
            taskId: task.id,
            sessionId: task.sessionId,
            sessionUuid: task.sessionUuid,
            userMessageId: task.userMessageId,
          });
        },
      )

      .post(
        "/projects/:projectId/sessions/:sessionId/resume",
        zValidator(
          "json",
          z.object({
            resumeMessage: z.string(),
            model: z.string().optional(),
            agent: z.string().optional(),
          }),
        ),
        async (c) => {
          const { projectId, sessionId } = c.req.param();
          const { resumeMessage, model, agent } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          const sessionPath = decodeSessionId(sessionId);
          const header = await readSessionHeader(sessionPath);

          if (!header?.sessionUuid) {
            return c.json({ error: "Session UUID not found" }, 400);
          }

          // If an agent is explicitly selected, create a new session instead of continuing
          // This is because sessions are bound to the agent they were created with
          // and the --agent flag is ignored when using --session to continue
          const task = await taskController.startOrContinueTask(
            {
              projectId,
              // Only pass session info if NO agent is selected
              // This allows continuing with the same agent, or starting fresh with a new one
              sessionPathId: agent ? undefined : sessionId,
              sessionUuid: agent ? undefined : header.sessionUuid,
              cwd: project.meta.workspacePath,
              model,
              agent,
            },
            resumeMessage,
          );

          return c.json({
            taskId: task.id,
            sessionId: task.sessionId,
            sessionUuid: task.sessionUuid,
            userMessageId: task.userMessageId,
          });
        },
      )

      .get("/tasks/alive", async (c) => {
        return c.json({
          aliveTasks: taskController.getSerializableAliveTasks(),
        });
      })

      .post(
        "/tasks/abort",
        zValidator("json", z.object({ sessionId: z.string() })),
        async (c) => {
          const { sessionId } = c.req.valid("json");
          taskController.abortTask(sessionId);
          return c.json({ message: "Task aborted" });
        },
      )

      .get("/events/state_changes", async (c) => {
        return streamSSE(
          c,
          async (stream) => {
            const fileWatcher = getFileWatcher();
            const eventBus = getEventBus();

            let isConnected = true;

            // ハートビート設定
            const heartbeat = setInterval(() => {
              if (isConnected) {
                eventBus.emit("heartbeat", {
                  type: "heartbeat",
                });
              }
            }, 30 * 1000);

            // connection handling
            const abortController = new AbortController();
            let connectionResolve: ((value: undefined) => void) | undefined;
            const connectionPromise = new Promise<undefined>((resolve) => {
              connectionResolve = resolve;
            });

            const onConnectionClosed = () => {
              isConnected = false;
              connectionResolve?.(undefined);
              abortController.abort();
              clearInterval(heartbeat);
            };

            // 接続終了時のクリーンアップ
            stream.onAbort(() => {
              console.log("SSE connection aborted");
              onConnectionClosed();
            });

            // イベントリスナーを登録
            console.log("Registering SSE event listeners");
            eventBus.on("connected", async (event) => {
              if (!isConnected) {
                return;
              }
              await stream.writeSSE(sseEventResponse(event)).catch(() => {
                onConnectionClosed();
              });
            });

            eventBus.on("heartbeat", async (event) => {
              if (!isConnected) {
                return;
              }
              await stream.writeSSE(sseEventResponse(event)).catch(() => {
                onConnectionClosed();
              });
            });

            eventBus.on("project_changed", async (event) => {
              if (!isConnected) {
                return;
              }

              await stream.writeSSE(sseEventResponse(event)).catch(() => {
                console.warn("Failed to write SSE event");
                onConnectionClosed();
              });
            });

            eventBus.on("session_changed", async (event) => {
              if (!isConnected) {
                return;
              }

              await stream.writeSSE(sseEventResponse(event)).catch(() => {
                onConnectionClosed();
              });
            });

            eventBus.on("task_changed", async (event) => {
              if (!isConnected) {
                return;
              }

              await stream.writeSSE(sseEventResponse(event)).catch(() => {
                onConnectionClosed();
              });
            });

            // 初期接続確認メッセージ
            eventBus.emit("connected", {
              type: "connected",
              message: "SSE connection established",
            });

            fileWatcher.startWatching();

            await connectionPromise;
          },
          async (err, stream) => {
            console.error("Streaming error:", err);
            await stream.write("エラーが発生しました。");
          },
        );
      })

      // Code Editor File Operations
      .get(
        "/projects/:projectId/editor/files",
        zValidator(
          "query",
          z.object({
            path: z.string().optional().default(""),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { path: relativePath } = c.req.valid("query");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullPath = relativePath
              ? `${project.meta.workspacePath}/${relativePath}`
              : project.meta.workspacePath;
            const files = await getFileTree(fullPath);
            return c.json({ files, basePath: project.meta.workspacePath });
          } catch (error) {
            console.error("Get file tree error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to get file tree" }, 500);
          }
        },
      )

      .get(
        "/projects/:projectId/editor/file-content",
        zValidator(
          "query",
          z.object({
            path: z.string().min(1, "File path is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { path: relativePath } = c.req.valid("query");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullPath = `${project.meta.workspacePath}/${relativePath}`;
            const content = await readFile(fullPath);
            return c.json({ content, path: relativePath });
          } catch (error) {
            console.error("Read file error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to read file" }, 500);
          }
        },
      )

      .post(
        "/projects/:projectId/editor/file-content",
        zValidator(
          "json",
          z.object({
            path: z.string().min(1, "File path is required"),
            content: z.string(),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { path: relativePath, content } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullPath = `${project.meta.workspacePath}/${relativePath}`;
            await writeFile(fullPath, content);
            return c.json({ success: true, path: relativePath });
          } catch (error) {
            console.error("Write file error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to write file" }, 500);
          }
        },
      )

      .post(
        "/projects/:projectId/editor/create-file",
        zValidator(
          "json",
          z.object({
            path: z.string().min(1, "File path is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { path: relativePath } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullPath = `${project.meta.workspacePath}/${relativePath}`;
            await createFile(fullPath);
            return c.json({ success: true, path: relativePath });
          } catch (error) {
            console.error("Create file error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to create file" }, 500);
          }
        },
      )

      .post(
        "/projects/:projectId/editor/create-directory",
        zValidator(
          "json",
          z.object({
            path: z.string().min(1, "Directory path is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { path: relativePath } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullPath = `${project.meta.workspacePath}/${relativePath}`;
            await createDirectory(fullPath);
            return c.json({ success: true, path: relativePath });
          } catch (error) {
            console.error("Create directory error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to create directory" }, 500);
          }
        },
      )

      .delete(
        "/projects/:projectId/editor/delete",
        zValidator(
          "json",
          z.object({
            path: z.string().min(1, "Path is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { path: relativePath } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullPath = `${project.meta.workspacePath}/${relativePath}`;
            await deleteFileOrDirectory(fullPath);
            return c.json({ success: true, path: relativePath });
          } catch (error) {
            console.error("Delete error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to delete" }, 500);
          }
        },
      )

      .post(
        "/projects/:projectId/editor/rename",
        zValidator(
          "json",
          z.object({
            oldPath: z.string().min(1, "Old path is required"),
            newPath: z.string().min(1, "New path is required"),
          }),
        ),
        async (c) => {
          const { projectId } = c.req.param();
          const { oldPath, newPath } = c.req.valid("json");
          const { project } = await getProject(projectId);

          if (!project.meta.workspacePath) {
            return c.json({ error: "Project path not found" }, 400);
          }

          try {
            const fullOldPath = `${project.meta.workspacePath}/${oldPath}`;
            const fullNewPath = `${project.meta.workspacePath}/${newPath}`;
            await renameFileOrDirectory(fullOldPath, fullNewPath);
            return c.json({ success: true, oldPath, newPath });
          } catch (error) {
            console.error("Rename error:", error);
            if (error instanceof Error) {
              return c.json({ error: error.message }, 400);
            }
            return c.json({ error: "Failed to rename" }, 500);
          }
        },
      )
  );
};

export type RouteType = ReturnType<typeof routes>;
