import { type FC, useEffect, useState } from "react";
import { AgentSelector } from "../../../../../components/AgentSelector";
import { ModelSelector } from "../../../../../components/ModelSelector";
import { useConfig } from "../../../../hooks/useConfig";
import { ChatInput, useNewChatMutation } from "../chatForm";

export const NewChat: FC<{
  projectId: string;
  onSuccess?: () => void;
}> = ({ projectId, onSuccess }) => {
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
  const startNewChat = useNewChatMutation(projectId, onSuccess);
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

  const handleSubmit = async (message: string) => {
    await startNewChat.mutateAsync({
      message,
      model: selectedModel,
      agent: selectedAgent,
    });
  };

  const getPlaceholder = () => {
    const isEnterSend = config?.enterKeyBehavior === "enter-send";
    if (isEnterSend) {
      return "Type your message here... (Start with / for commands, @ for files, Enter to send)";
    }
    return "Type your message here... (Start with / for commands, @ for files, Shift+Enter to send)";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Model</div>
          <ModelSelector
            value={selectedModel}
            onValueChange={setSelectedModel}
            disabled={startNewChat.isPending}
          />
        </div>
        <div className="space-y-2">
          <div className="text-sm font-medium text-foreground">Agent</div>
          <AgentSelector
            value={selectedAgent}
            onValueChange={setSelectedAgent}
            disabled={startNewChat.isPending}
            projectId={projectId}
          />
        </div>
      </div>
      <ChatInput
        projectId={projectId}
        onSubmit={handleSubmit}
        isPending={startNewChat.isPending}
        error={startNewChat.error}
        placeholder={getPlaceholder()}
        buttonText="Start Chat"
        minHeight="min-h-[200px]"
        containerClassName="space-y-4"
      />
    </div>
  );
};
