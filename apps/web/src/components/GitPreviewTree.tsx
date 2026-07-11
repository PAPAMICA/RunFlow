"use client";

import { useMemo, useState } from "react";
import { ChevronRight, File, Folder } from "lucide-react";
import { GitPreviewFile } from "@/lib/api";
import { cn } from "@/lib/utils";

interface TreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: TreeNode[];
}

function buildTree(files: GitPreviewFile[]): TreeNode[] {
  const root: TreeNode[] = [];
  const dirs = new Map<string, TreeNode>();

  const sorted = [...files].sort((a, b) => a.path.localeCompare(b.path));
  for (const file of sorted) {
    const parts = file.path.split("/");
    let current = root;
    let currentPath = "";

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isLast = i === parts.length - 1;
      currentPath = currentPath ? `${currentPath}/${part}` : part;

      if (isLast && !file.is_directory) {
        current.push({ name: part, path: file.path, isDirectory: false, children: [] });
        continue;
      }

      let node = dirs.get(currentPath);
      if (!node) {
        node = { name: part, path: currentPath, isDirectory: true, children: [] };
        dirs.set(currentPath, node);
        current.push(node);
      }
      current = node.children;
    }
  }
  return root;
}

function TreeItem({
  node,
  depth,
  onSelect,
  selectedPath,
}: {
  node: TreeNode;
  depth: number;
  onSelect?: (path: string) => void;
  selectedPath?: string;
}) {
  const [open, setOpen] = useState(depth < 1);
  const isSelected = selectedPath === node.path;

  if (!node.isDirectory) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(node.path)}
        className={cn(
          "flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-xs font-mono transition-colors",
          isSelected ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-card-hover hover:text-foreground"
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <File className="h-3.5 w-3.5 shrink-0" />
        {node.name}
      </button>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1 rounded-md px-2 py-1 text-left text-xs text-foreground hover:bg-card-hover transition-colors"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", open && "rotate-90")} />
        <Folder className="h-3.5 w-3.5 shrink-0 text-primary/80" />
        {node.name}
      </button>
      {open &&
        node.children.map((child) => (
          <TreeItem
            key={child.path}
            node={child}
            depth={depth + 1}
            onSelect={onSelect}
            selectedPath={selectedPath}
          />
        ))}
    </div>
  );
}

export interface GitPreviewTreeProps {
  files: GitPreviewFile[];
  onSelectEntrypoint?: (path: string) => void;
  selectedPath?: string;
  className?: string;
}

export function GitPreviewTree({ files, onSelectEntrypoint, selectedPath, className }: GitPreviewTreeProps) {
  const tree = useMemo(() => buildTree(files), [files]);

  if (!files.length) {
    return (
      <p className={cn("text-xs text-muted-foreground p-3", className)}>
        Aucun fichier — synchronisez le dépôt Git.
      </p>
    );
  }

  return (
    <div className={cn("max-h-64 overflow-y-auto rounded-xl border border-border bg-card/40 p-2", className)}>
      {tree.map((node) => (
        <TreeItem
          key={node.path}
          node={node}
          depth={0}
          onSelect={onSelectEntrypoint}
          selectedPath={selectedPath}
        />
      ))}
    </div>
  );
}
