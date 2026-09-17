"use client";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type {
  CodexSessionTurn,
  CodexToolCall,
  CodexToolResult,
} from "@/server/service/types";

const formatTimestamp = (timestamp: string | null) => {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return timestamp;
  }
};

const formatText = (value: string | null | undefined) => {
  if (!value) return "";
  return value.trim();
};

const UserMessage = ({
  text,
  timestamp,
}: {
  text: string;
  timestamp: string | null;
}) => {
  return (
    <Card className="p-1 max-w-4xl bg-gray-50/50 dark:bg-gray-900/20 border-gray-200/50 dark:border-gray-800/50">
      <CardContent className="p-2">
        <pre className="whitespace-pre-wrap break-words text-sm font-mono">
          {text}
        </pre>
        {timestamp && (
          <div className="text-xs text-muted-foreground mt-2">
            {formatTimestamp(timestamp)}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AssistantMessage = ({
  text,
  timestamp,
}: {
  text: string;
  timestamp: string | null;
}) => {
  return (
    <div className="max-w-4xl">
      <pre className="whitespace-pre-wrap break-words text-sm font-mono">
        {text}
      </pre>
      {timestamp && (
        <div className="text-xs text-muted-foreground mt-2">
          {formatTimestamp(timestamp)}
        </div>
      )}
    </div>
  );
};

const pairToolCalls = (turn: CodexSessionTurn) => {
  const resultByCallId = new Map<string, CodexToolResult>();
  for (const result of turn.toolResults) {
    if (result.callId) {
      resultByCallId.set(result.callId, result);
    }
  }

  const paired: Array<{ call: CodexToolCall; result?: CodexToolResult }> =
    turn.toolCalls.map((call) => {
      const result = call.callId ? resultByCallId.get(call.callId) : undefined;
      if (call.callId && result) {
        resultByCallId.delete(call.callId);
      }
      return { call, result };
    });

  // Any leftover results without a matching call
  for (const result of turn.toolResults) {
    if (result.callId && resultByCallId.has(result.callId)) {
      paired.push({
        call: {
          id: `${result.id}-orphan`,
          name: "(unknown)",
          arguments: null,
          callId: result.callId,
          timestamp: result.timestamp,
        },
        result,
      });
      resultByCallId.delete(result.callId);
    }
  }

  return paired;
};

const formatToolName = (name: string) => {
  // Remove tool_ prefix if it exists
  const cleanName = name.replace(/^tool_/, "");
  // Convert snake_case to Title Case
  return cleanName
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const JsonViewer = ({ data }: { data: string | null }) => {
  if (!data) return <span className="text-muted-foreground">null</span>;

  try {
    const parsed = JSON.parse(data);
    return (
      <pre className="text-xs font-mono overflow-x-auto">
        {JSON.stringify(parsed, null, 2)}
      </pre>
    );
  } catch {
    // If it's not valid JSON, display as is
    return <pre className="text-xs font-mono overflow-x-auto">{data}</pre>;
  }
};

const ToolCallCard = ({
  call,
  result,
}: {
  call: CodexToolCall;
  result?: CodexToolResult;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [isResultOpen, setIsResultOpen] = useState(false);

  useEffect(() => {
    if (!isExpanded) {
      setIsInputOpen(false);
      setIsResultOpen(false);
    }
  }, [isExpanded]);

  return (
    <Card className="p-1 max-w-4xl bg-blue-50/50 dark:bg-blue-950/10 border-blue-200/50 dark:border-blue-800/50">
      <CardContent className="px-4 !py-2">
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          className="flex w-full items-center gap-2 text-sm font-medium text-blue-700 hover:text-blue-900 dark:text-blue-300 dark:hover:text-blue-200 transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          <span>Tool Use</span>
          <Badge
            variant="secondary"
            className="text-xs text-blue-600 dark:text-blue-400 bg-transparent border-blue-200 dark:border-blue-800"
          >
            {formatToolName(call.name)}
          </Badge>
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-3 text-xs">
            <div className="text-muted-foreground">
              Tool execution with ID: toolu_
              {call.callId?.substring(0, 20) || "unknown"}...
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsInputOpen((prev) => !prev)}
                className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1"
              >
                {isInputOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Input Parameters
              </button>
              {isInputOpen && (
                <div className="mt-2 pl-4">
                  <JsonViewer data={call.arguments} />
                </div>
              )}
            </div>

            <div className="pt-1">
              <button
                type="button"
                onClick={() => setIsResultOpen((prev) => !prev)}
                className="flex items-center gap-1 font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left py-1"
              >
                {isResultOpen ? (
                  <ChevronDown className="h-3 w-3" />
                ) : (
                  <ChevronRight className="h-3 w-3" />
                )}
                Tool Result
              </button>
              {isResultOpen && (
                <div className="mt-2 pl-4">
                  {result ? (
                    <JsonViewer data={result.output} />
                  ) : (
                    <span className="text-muted-foreground">
                      No result available
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export const ConversationList = ({ turns }: { turns: CodexSessionTurn[] }) => {
  if (turns.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        No conversation entries yet. Send a message to Codex to begin.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {turns.map((turn) => {
        const toolPairs = pairToolCalls(turn);

        return (
          <section key={turn.id} className="flex flex-col gap-3">
            {turn.userMessage ? (
              <UserMessage
                text={formatText(turn.userMessage.text)}
                timestamp={turn.userMessage.timestamp}
              />
            ) : null}

            {/* Display reasoning if no assistant messages are present */}
            {turn.assistantMessages.length === 0 &&
            turn.reasonings.length > 0 ? (
              <div className="flex flex-col gap-4">
                {turn.reasonings.map((reasoning) => (
                  <AssistantMessage
                    key={reasoning.id}
                    text={formatText(reasoning.text)}
                    timestamp={reasoning.timestamp}
                  />
                ))}
              </div>
            ) : null}

            {toolPairs.map(({ call, result }) => (
              <ToolCallCard
                key={`${call.id}-${result?.id ?? "result"}`}
                call={call}
                result={result}
              />
            ))}

            {turn.assistantMessages.length > 0 ? (
              <div className="flex flex-col gap-4">
                {turn.assistantMessages.map((message) => (
                  <AssistantMessage
                    key={message.id}
                    text={formatText(message.text)}
                    timestamp={message.timestamp}
                  />
                ))}
              </div>
            ) : null}

            {/* Show a completion indicator if there are tool calls but no messages or reasoning */}
            {turn.assistantMessages.length === 0 &&
            turn.reasonings.length === 0 &&
            toolPairs.length > 0 ? (
              <div className="text-sm text-muted-foreground italic">
                Task completed successfully
              </div>
            ) : null}
          </section>
        );
      })}
    </div>
  );
};
