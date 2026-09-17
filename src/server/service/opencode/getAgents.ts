import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import JSON5 from "json5";

export interface OpencodeAgent {
  name: string;
  description: string;
  mode: "primary" | "subagent" | "all";
}

interface OpencodeConfig {
  agent?: Record<
    string,
    {
      description?: string;
      mode?: "primary" | "subagent" | "all";
      prompt?: string;
      model?: string;
      tools?: Record<string, boolean>;
    }
  >;
}

/**
 * Fetches the list of available agents from opencode config files
 * Reads opencode.jsonc or opencode.json from the project directory
 */
export async function getAgents(cwd?: string): Promise<OpencodeAgent[]> {
  try {
    const agents: OpencodeAgent[] = [];

    // Default agents that are always available
    const defaultAgents: OpencodeAgent[] = [
      {
        name: "build",
        description: "Primary agent for building and modifying code",
        mode: "primary",
      },
      {
        name: "plan",
        description: "Agent for planning and analyzing without making changes",
        mode: "primary",
      },
    ];

    // If no cwd provided, return defaults
    if (!cwd) {
      return defaultAgents;
    }

    // Try to read opencode.jsonc or opencode.json
    const configPaths = [
      join(cwd, "opencode.jsonc"),
      join(cwd, "opencode.json"),
    ];

    let config: OpencodeConfig | null = null;

    for (const configPath of configPaths) {
      if (existsSync(configPath)) {
        try {
          const content = await readFile(configPath, "utf-8");
          // Use JSON5 to parse JSONC (supports comments and trailing commas)
          config = JSON5.parse(content) as OpencodeConfig;
          break;
        } catch (error) {
          console.warn(`Failed to parse ${configPath}:`, error);
        }
      }
    }

    // If config found and has agents, parse them
    if (config?.agent) {
      for (const [name, agentConfig] of Object.entries(config.agent)) {
        agents.push({
          name,
          description: agentConfig.description || `Custom agent: ${name}`,
          mode: agentConfig.mode || "all",
        });
      }
    }

    // If custom agents found, return them along with defaults
    // Otherwise just return defaults
    if (agents.length > 0) {
      // Merge custom agents with defaults, avoiding duplicates
      const agentMap = new Map<string, OpencodeAgent>();

      // Add custom agents first
      for (const agent of agents) {
        agentMap.set(agent.name, agent);
      }

      // Add defaults only if not already present
      for (const agent of defaultAgents) {
        if (!agentMap.has(agent.name)) {
          agentMap.set(agent.name, agent);
        }
      }

      return Array.from(agentMap.values());
    }

    return defaultAgents;
  } catch (error) {
    console.error("Failed to get agents from opencode:", error);
    return [
      {
        name: "build",
        description: "Primary agent for building and modifying code",
        mode: "primary",
      },
    ];
  }
}
