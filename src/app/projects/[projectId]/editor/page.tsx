"use client";

import { SaveIcon, XIcon } from "lucide-react";
import { use, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./components/CodeEditor";
import type { FileNode } from "./components/FileTree";
import { FileTree } from "./components/FileTree";
import {
  useEditorFiles,
  useFileContent,
  useSaveFile,
} from "./hooks/useEditorFiles";

interface OpenFile {
  path: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export default function EditorPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = use(params);
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const { data: filesData, isLoading: isLoadingFiles } =
    useEditorFiles(projectId);
  const { data: fileContentData } = useFileContent(projectId, selectedFile);
  const saveFileMutation = useSaveFile(projectId);

  // Load file content when selected
  useEffect(() => {
    if (fileContentData && selectedFile) {
      const existingFile = openFiles.find((f) => f.path === selectedFile);
      if (!existingFile) {
        const language = getLanguageFromPath(selectedFile);
        setOpenFiles((prev) => [
          ...prev,
          {
            path: selectedFile,
            content: fileContentData.content,
            isDirty: false,
            language,
          },
        ]);
        setActiveFilePath(selectedFile);
      } else {
        setActiveFilePath(selectedFile);
      }
    }
  }, [fileContentData, selectedFile, openFiles]);

  const handleFileSelect = (path: string) => {
    setSelectedFile(path);
  };

  const handleLoadChildren = useCallback(
    async (path: string): Promise<FileNode[]> => {
      const params = new URLSearchParams({ path });
      const response = await fetch(
        `/api/projects/${projectId}/editor/files?${params}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load children");
      }
      const data = await response.json();
      return data.files;
    },
    [projectId],
  );

  const handleEditorChange = (value: string | undefined) => {
    if (activeFilePath && value !== undefined) {
      setOpenFiles((prev) =>
        prev.map((f) =>
          f.path === activeFilePath
            ? { ...f, content: value, isDirty: true }
            : f,
        ),
      );
    }
  };

  const handleSaveFile = async (path: string) => {
    const file = openFiles.find((f) => f.path === path);
    if (!file) return;

    try {
      await saveFileMutation.mutateAsync({
        path: file.path,
        content: file.content,
      });
      setOpenFiles((prev) =>
        prev.map((f) => (f.path === path ? { ...f, isDirty: false } : f)),
      );
      toast.success("File saved successfully");
    } catch (error) {
      console.error("Failed to save file:", error);
      toast.error("Failed to save file");
    }
  };

  const handleCloseFile = (path: string) => {
    setOpenFiles((prev) => prev.filter((f) => f.path !== path));
    if (activeFilePath === path) {
      const remainingFiles = openFiles.filter((f) => f.path !== path);
      setActiveFilePath(
        remainingFiles.length > 0 ? (remainingFiles[0]?.path ?? null) : null,
      );
    }
  };

  const activeFile = openFiles.find((f) => f.path === activeFilePath);

  if (isLoadingFiles) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-muted-foreground">Loading files...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* File Tree Sidebar */}
      <div className="w-64 border-r border-border bg-sidebar overflow-y-auto">
        <div className="p-3 border-b border-border">
          <h2 className="font-semibold text-sm">Explorer</h2>
        </div>
        <div className="p-2">
          {filesData?.files && (
            <FileTree
              files={filesData.files}
              onFileSelect={handleFileSelect}
              selectedFile={selectedFile}
              onLoadChildren={handleLoadChildren}
            />
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tabs */}
        {openFiles.length > 0 && (
          <div className="flex items-center border-b border-border bg-sidebar/50 overflow-x-auto">
            {openFiles.map((file) => (
              <div
                key={file.path}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 border-r border-border cursor-pointer hover:bg-sidebar-accent transition-colors min-w-0",
                  activeFilePath === file.path &&
                    "bg-background text-foreground",
                )}
                onClick={() => setActiveFilePath(file.path)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setActiveFilePath(file.path);
                  }
                }}
                role="tab"
                tabIndex={0}
                aria-selected={activeFilePath === file.path}
              >
                <span className="text-sm truncate flex-1">
                  {file.path.split("/").pop()}
                  {file.isDirty && " •"}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseFile(file.path);
                  }}
                  className="hover:bg-sidebar-accent rounded p-0.5"
                  aria-label={`Close ${file.path}`}
                >
                  <XIcon className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 relative">
          {activeFile ? (
            <>
              <div className="absolute top-2 right-2 z-10">
                <Button
                  size="sm"
                  onClick={() => handleSaveFile(activeFile.path)}
                  disabled={!activeFile.isDirty || saveFileMutation.isPending}
                >
                  <SaveIcon className="w-4 h-4 mr-2" />
                  {saveFileMutation.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
              <CodeEditor
                value={activeFile.content}
                onChange={handleEditorChange}
                language={activeFile.language}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <p className="text-lg mb-2">No file open</p>
                <p className="text-sm">
                  Select a file from the explorer to start editing
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getLanguageFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    json: "json",
    html: "html",
    css: "css",
    scss: "scss",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    go: "go",
    rs: "rust",
    md: "markdown",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
    sh: "shell",
    sql: "sql",
  };
  return languageMap[ext || ""] || "plaintext";
}
