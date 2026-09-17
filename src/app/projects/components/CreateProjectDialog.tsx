"use client";

import { useQueryClient } from "@tanstack/react-query";
import { PlusIcon } from "lucide-react";
import { type FC, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { createProject } from "@/lib/api/projects";

export const CreateProjectDialog: FC = () => {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!projectName.trim()) {
      setError("Project name is required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await createProject(projectName.trim());

      // Invalidate projects query to refetch the list
      await queryClient.invalidateQueries({ queryKey: ["projects"] });

      // Close dialog and reset form
      setOpen(false);
      setProjectName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen && !isAuthenticated) {
      toast.error("You must be logged in to create a project");
      return;
    }
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setProjectName("");
      setError(null);
    }
  };

  const handleButtonClick = () => {
    if (!isAuthenticated) {
      toast.error("You must be logged in to create a project");
      return;
    }
    setOpen(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button onClick={handleButtonClick}>
        <PlusIcon className="w-4 h-4 mr-2" />
        Create New Project
      </Button>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Enter a name for your new project. An empty folder will be created
              in /home/cautious-sea/Projects/CS-Projects with a ContexML session
              initialized. The project will appear in your list and all
              generated code will be stored there.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor={inputId}>Project Name</Label>
              <Input
                id={inputId}
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g., My AI Project"
                disabled={isLoading}
                autoComplete="off"
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
