"use client";

import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileIcon,
  FolderIcon,
  FolderOpenIcon,
} from "lucide-react";
import { type FC, useState } from "react";
import { cn } from "@/lib/utils";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface FileTreeProps {
  files: FileNode[];
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  onLoadChildren?: (path: string) => Promise<FileNode[]>;
}

export const FileTree: FC<FileTreeProps> = ({
  files,
  onFileSelect,
  selectedFile,
  onLoadChildren,
}) => {
  return (
    <div className="text-sm">
      {files.map((file) => (
        <FileTreeNode
          key={file.path}
          node={file}
          onFileSelect={onFileSelect}
          selectedFile={selectedFile}
          onLoadChildren={onLoadChildren}
          level={0}
        />
      ))}
    </div>
  );
};

interface FileTreeNodeProps {
  node: FileNode;
  onFileSelect: (path: string) => void;
  selectedFile: string | null;
  onLoadChildren?: (path: string) => Promise<FileNode[]>;
  level: number;
}

const FileTreeNode: FC<FileTreeNodeProps> = ({
  node,
  onFileSelect,
  selectedFile,
  onLoadChildren,
  level,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [children, setChildren] = useState<FileNode[]>(node.children || []);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    if (node.type === "directory") {
      if (!isExpanded && onLoadChildren && children.length === 0) {
        setIsLoading(true);
        try {
          const loadedChildren = await onLoadChildren(node.path);
          setChildren(loadedChildren);
        } catch (error) {
          console.error("Failed to load children:", error);
        } finally {
          setIsLoading(false);
        }
      }
      setIsExpanded(!isExpanded);
    } else {
      onFileSelect(node.path);
    }
  };

  const isSelected = selectedFile === node.path;

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-sidebar-accent rounded-sm transition-colors w-full text-left",
          isSelected && "bg-sidebar-accent text-sidebar-accent-foreground",
        )}
        style={{ paddingLeft: `${level * 12 + 8}px` }}
      >
        {node.type === "directory" && (
          <span className="flex-shrink-0">
            {isExpanded ? (
              <ChevronDownIcon className="w-4 h-4" />
            ) : (
              <ChevronRightIcon className="w-4 h-4" />
            )}
          </span>
        )}
        <span className="flex-shrink-0">
          {node.type === "directory" ? (
            isExpanded ? (
              <FolderOpenIcon className="w-4 h-4 text-blue-500" />
            ) : (
              <FolderIcon className="w-4 h-4 text-blue-500" />
            )
          ) : (
            <FileIcon className="w-4 h-4 text-gray-500" />
          )}
        </span>
        <span className="truncate flex-1">{node.name}</span>
        {isLoading && (
          <span className="text-xs text-muted-foreground">Loading...</span>
        )}
      </button>
      {node.type === "directory" && isExpanded && children.length > 0 && (
        <div>
          {children.map((child) => (
            <FileTreeNode
              key={child.path}
              node={child}
              onFileSelect={onFileSelect}
              selectedFile={selectedFile}
              onLoadChildren={onLoadChildren}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
};
