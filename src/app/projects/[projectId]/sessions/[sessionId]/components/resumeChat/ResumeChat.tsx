import { type FC, useEffect, useState } from "react";
import { AgentSelector } from "../../../../../../../components/AgentSelector";
import { ModelSelector } from "../../../../../../../components/ModelSelector";
import { useConfig } from "../../../../../../hooks/useConfig";
import {
  ChatInput,
  useResumeChatMutation,
} from "../../../../components/chatForm";

export const ResumeChat: FC<{
  projectId: string;
  sessionId: string;
  isPausedTask: boolean;
  isRunningTask: boolean;
}> = ({ projectId, sessionId, isPausedTask, isRunningTask }) => {
  const [selectedModel, setSelectedModel] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedModel") || undefined;
    }
    return undefined;
  });
  const [selectedAgent, setSelectedAgent] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("selectedAgent") || undefined;
    }
    return undefined;
  });

  // Track if user has explicitly changed selections in this session
  const [hasChangedModel, setHasChangedModel] = useState(false);
  const [hasChangedAgent, setHasChangedAgent] = useState(false);

  const resumeChat = useResumeChatMutation(projectId, sessionId);
  const { config } = useConfig();

  // Persist selections to localStorage
  useEffect(() => {
    if (selectedModel) {
      localStorage.setItem("selectedModel", selectedModel);
    } else {
      localStorage.removeItem("selectedModel");
    }
  }, [selectedModel]);

  useEffect(() => {
    if (selectedAgent) {
      localStorage.setItem("selectedAgent", selectedAgent);
    } else {
      localStorage.removeItem("selectedAgent");
    }
  }, [selectedAgent]);

  const handleModelChange = (value: string) => {
    setSelectedModel(value);
    setHasChangedModel(true);
  };

  const handleAgentChange = (value: string) => {
    setSelectedAgent(value);
    setHasChangedAgent(true);
  };

  const handleSubmit = async (message: string) => {
    // Only send model/agent if explicitly changed by user in this session
    // This prevents creating a new session when just continuing the conversation
    await resumeChat.mutateAsync({
      message,
      model: hasChangedModel ? selectedModel : undefined,
      agent: hasChangedAgent ? selectedAgent : undefined,
    });

    // Reset change flags after submission
    setHasChangedModel(false);
    setHasChangedAgent(false);
  };

  const getButtonText = () => {
    if (isPausedTask || isRunningTask) {
      return "Send";
    }
    return "Resume";
  };

  const getPlaceholder = () => {
    const isEnterSend = config?.enterKeyBehavior === "enter-send";
    if (isEnterSend) {
      return "Type your message... (Start with / for commands, Enter to send)";
    }
    return "Type your message... (Start with / for commands, Shift+Enter to send)";
  };

  return (
    <div className="border-t border-border/50 bg-muted/20 p-4 mt-6 space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Model</div>
          <ModelSelector
            value={selectedModel}
            onValueChange={handleModelChange}
            disabled={resumeChat.isPending}
          />
        </div>
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted-foreground">Agent</div>
          <AgentSelector
            value={selectedAgent}
            onValueChange={handleAgentChange}
            disabled={resumeChat.isPending}
            projectId={projectId}
          />
        </div>
      </div>
      <ChatInput
        projectId={projectId}
        onSubmit={handleSubmit}
        isPending={resumeChat.isPending}
        error={resumeChat.error}
        placeholder={getPlaceholder()}
        buttonText={getButtonText()}
        minHeight="min-h-[100px]"
        containerClassName="space-y-2"
        buttonSize="default"
      />
    </div>
  );
};
