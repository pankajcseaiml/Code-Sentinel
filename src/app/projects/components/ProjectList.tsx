"use client";

import {
  ArrowUpDown,
  FolderIcon,
  LayoutGridIcon,
  ListIcon,
  LockIcon,
  MessageSquareIcon,
} from "lucide-react";
import Link from "next/link";
import type { FC } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import type { Project } from "../../../server/service/types";
import { useProjects } from "../hooks/useProjects";

type SortKey = "lastModified" | "name" | "messageCount";
type SortOrder = "asc" | "desc";
type ViewMode = "grid" | "list";

export const ProjectList: FC = () => {
  const { data: projects, isLoading } = useProjects();
  const { isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("lastModified");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");

  const filteredProjects = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = normalizedQuery
      ? projects.filter((project) => {
          const name = project.meta.workspaceName ?? project.workspacePath;
          const path = project.meta.workspacePath ?? "";
          return (
            name.toLowerCase().includes(normalizedQuery) ||
            path.toLowerCase().includes(normalizedQuery)
          );
        })
      : projects;

    const sorted = [...filtered].sort((a, b) => {
      const direction = sortOrder === "asc" ? 1 : -1;

      const getName = (project: Project) =>
        (
          project.meta.workspaceName ??
          project.workspacePath ??
          ""
        ).toLowerCase();

      if (sortKey === "name") {
        return direction * getName(a).localeCompare(getName(b));
      }

      if (sortKey === "messageCount") {
        const aCount = a.meta.sessionCount ?? 0;
        const bCount = b.meta.sessionCount ?? 0;
        return direction * (aCount - bCount);
      }

      const aTime = a.meta.lastSessionAt
        ? new Date(a.meta.lastSessionAt).getTime()
        : 0;
      const bTime = b.meta.lastSessionAt
        ? new Date(b.meta.lastSessionAt).getTime()
        : 0;
      return direction * (aTime - bTime);
    });

    return sorted;
  }, [projects, searchQuery, sortKey, sortOrder]);

  const handleToggleSortOrder = () => {
    setSortOrder((current) => (current === "asc" ? "desc" : "asc"));
  };

  // Show loading state
  if (isAuthLoading || isLoading) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="animate-pulse flex flex-col items-center">
            <div className="w-12 h-12 bg-gray-300 rounded-full mb-4" />
            <div className="h-4 w-32 bg-gray-300 rounded mb-2" />
            <div className="h-3 w-48 bg-gray-300 rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show login required message if not authenticated
  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <LockIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Authentication Required</h3>
          <p className="text-muted-foreground text-center max-w-md">
            You must be logged in to view your projects. Please log in or create
            an account to access your projects.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <FolderIcon className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No projects found</h3>
          <p className="text-muted-foreground text-center max-w-md">
            No Opencode sessions found in your
            ~/.local/share/opencode/storage/session directory. Run an Opencode
            conversation to populate this list.
          </p>
        </CardContent>
      </Card>
    );
  }

  const isFilteredResultEmpty = filteredProjects.length === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
            }}
            placeholder="Filter by project name or path"
            className="w-full sm:max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Select
              value={sortKey}
              onValueChange={(value) => {
                setSortKey(value as SortKey);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="lastModified">Last modified</SelectItem>
                <SelectItem value="name">Project name</SelectItem>
                <SelectItem value="messageCount">Message count</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleToggleSortOrder}
              aria-label={`Toggle sort order (${sortOrder})`}
            >
              <ArrowUpDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 self-start">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("grid")}
            aria-label="Grid view"
          >
            <LayoutGridIcon className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="icon"
            onClick={() => setViewMode("list")}
            aria-label="List view"
          >
            <ListIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {isFilteredResultEmpty ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No projects match the current filters.
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <Card
              key={project.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FolderIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="truncate leading-normal">
                    {project.meta.workspaceName ?? project.workspacePath}
                  </span>
                </CardTitle>
                <CardDescription>{project.meta.workspacePath}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Last modified:{" "}
                  {project.meta.lastSessionAt
                    ? new Date(project.meta.lastSessionAt).toLocaleString()
                    : ""}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <MessageSquareIcon className="h-3 w-3" />
                  {project.meta.sessionCount}
                </p>
              </CardContent>
              <CardContent className="pt-0">
                <Button asChild className="w-full">
                  <Link href={`/projects/${encodeURIComponent(project.id)}`}>
                    View Sessions
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border text-sm">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Project</th>
                <th className="px-4 py-3 text-left font-medium">Path</th>
                <th className="px-4 py-3 text-left font-medium">
                  Last modified
                </th>
                <th className="px-4 py-3 text-left font-medium">Messages</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredProjects.map((project) => {
                const lastModified = project.meta.lastSessionAt
                  ? new Date(project.meta.lastSessionAt).toLocaleString()
                  : "";

                return (
                  <tr key={project.id} className="hover:bg-muted/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={cn("rounded-md border p-2")}>
                          <FolderIcon className="h-4 w-4" />
                        </div>
                        <span className="font-medium">
                          {project.meta.workspaceName ?? project.workspacePath}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                      {project.meta.workspacePath}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {lastModified}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      <div className="inline-flex items-center gap-1">
                        <MessageSquareIcon className="h-3 w-3" />
                        {project.meta.sessionCount}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button asChild size="sm">
                        <Link
                          href={`/projects/${encodeURIComponent(project.id)}`}
                        >
                          View Sessions
                        </Link>
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
