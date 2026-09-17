import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface OpencodeModel {
  provider: string;
  model: string;
  displayName: string;
}

/**
 * Fetches the list of available models from opencode CLI
 */
export async function getModels(): Promise<OpencodeModel[]> {
  try {
    const { stdout, stderr } = await execAsync("opencode models", {
      timeout: 10000,
    });

    if (stderr) {
      console.warn("opencode models stderr:", stderr);
    }

    // Parse plain text output from opencode models command
    // Format is: provider/model-name (one per line)
    const lines = stdout.trim().split("\n");
    const models: OpencodeModel[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Split by first slash to get provider and model
      const slashIndex = trimmed.indexOf("/");
      if (slashIndex === -1) {
        console.warn("Invalid model format (no slash):", trimmed);
        continue;
      }

      const provider = trimmed.substring(0, slashIndex);
      const model = trimmed.substring(slashIndex + 1);

      models.push({
        provider,
        model,
        displayName: trimmed, // Use full provider/model as display name
      });
    }

    return models;
  } catch (error) {
    console.error("Failed to get models from opencode:", error);
    return [];
  }
}
