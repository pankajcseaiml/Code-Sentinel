import { Loader2 } from "lucide-react";
import type { FC } from "react";
import { useAgents } from "../app/hooks/useModelsAndAgents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface AgentSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  projectId?: string;
}

export const AgentSelector: FC<AgentSelectorProps> = ({
  value,
  onValueChange,
  disabled,
  projectId,
}) => {
  const { data: agents, isLoading, error } = useAgents(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading agents...
      </div>
    );
  }

  if (error || !agents || agents.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {error ? "Failed to load agents" : "No agents available"}
      </div>
    );
  }

  const selectedAgent = agents.find((agent) => agent.name === value);

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        {selectedAgent ? (
          <span className="text-sm">{selectedAgent.name}</span>
        ) : (
          <SelectValue placeholder="Select an agent (optional)" />
        )}
      </SelectTrigger>
      <SelectContent>
        {agents.map((agent) => (
          <SelectItem key={agent.name} value={agent.name}>
            <div className="flex flex-col items-start gap-0.5">
              <div className="font-medium">{agent.name}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {agent.description}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
