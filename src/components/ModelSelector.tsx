import { Loader2 } from "lucide-react";
import type { FC } from "react";
import { type Model, useModels } from "../app/hooks/useModelsAndAgents";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface ModelSelectorProps {
  value?: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export const ModelSelector: FC<ModelSelectorProps> = ({
  value,
  onValueChange,
  disabled,
}) => {
  const { data: models, isLoading, error } = useModels();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading models...
      </div>
    );
  }

  if (error || !models || models.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        {error ? "Failed to load models" : "No models available"}
      </div>
    );
  }

  // Group models by provider
  const modelsByProvider = models.reduce(
    (acc, model) => {
      if (!acc[model.provider]) {
        acc[model.provider] = [];
      }
      acc[model.provider]?.push(model);
      return acc;
    },
    {} as Record<string, Model[]>,
  );

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger>
        <SelectValue placeholder="Select a model (optional)" />
      </SelectTrigger>
      <SelectContent>
        {Object.entries(modelsByProvider).map(([provider, providerModels]) => (
          <div key={provider}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              {provider}
            </div>
            {providerModels.map((model) => (
              <SelectItem
                key={`${model.provider}/${model.model}`}
                value={`${model.provider}/${model.model}`}
              >
                {model.displayName}
              </SelectItem>
            ))}
          </div>
        ))}
      </SelectContent>
    </Select>
  );
};
