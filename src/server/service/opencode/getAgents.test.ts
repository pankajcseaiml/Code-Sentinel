import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getAgents } from "./getAgents";

describe("getAgents", () => {
  let tempDir: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "opencode-test-"));
    const configPath = join(tempDir, "opencode.jsonc");
    const configContent = `{
      // Sample opencode config with comments
      "agent": {
        "ux-expert": {
          "description": "Use for UI/UX design, wireframes, prototypes, front-end specifications, and user experience optimization",
          "mode": "all"
        },
        "sm": { "description": "Scrum Master", "mode": "all" },
        "qa": { "description": "QA", "mode": "all" },
        "po": { "description": "PO", "mode": "all" },
        "pm": { "description": "PM", "mode": "all" },
        "dev": { "description": "Dev", "mode": "all" },
        "architect": { "description": "Architect", "mode": "all" },
        "analyst": { "description": "Analyst", "mode": "all" },
      }
    }`;
    writeFileSync(configPath, configContent, "utf-8");
  });

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("should return default agents when no cwd is provided", async () => {
    const agents = await getAgents();
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.name)).toContain("build");
    expect(agents.map((a) => a.name)).toContain("plan");
  });

  it("should return custom agents from opencode.jsonc when cwd is provided", async () => {
    const agents = await getAgents(tempDir);

    // Should have custom agents plus defaults if not overridden
    expect(agents.length).toBeGreaterThan(2);

    // Check for some custom agents
    const agentNames = agents.map((a) => a.name);
    expect(agentNames).toContain("ux-expert");
    expect(agentNames).toContain("sm");
    expect(agentNames).toContain("qa");
    expect(agentNames).toContain("po");
    expect(agentNames).toContain("pm");
    expect(agentNames).toContain("dev");
    expect(agentNames).toContain("architect");
    expect(agentNames).toContain("analyst");

    // Verify agent structure
    const uxExpert = agents.find((a) => a.name === "ux-expert");
    expect(uxExpert).toBeDefined();
    expect(uxExpert?.description).toBe(
      "Use for UI/UX design, wireframes, prototypes, front-end specifications, and user experience optimization",
    );
    expect(uxExpert?.mode).toBe("all");
  });

  it("should return default agents when config file doesn't exist", async () => {
    const nonExistentPath = join(
      tmpdir(),
      `non-existent-project-dir-${Date.now()}`,
    );
    const agents = await getAgents(nonExistentPath);
    expect(agents).toHaveLength(2);
    expect(agents.map((a) => a.name)).toContain("build");
    expect(agents.map((a) => a.name)).toContain("plan");
  });
});
