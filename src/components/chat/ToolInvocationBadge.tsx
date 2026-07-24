"use client";

import type { ToolInvocation } from "ai";
import { Loader2 } from "lucide-react";

interface ToolInvocationBadgeProps {
  toolInvocation: ToolInvocation;
}

function getFileName(path?: string): string | undefined {
  if (!path) return undefined;
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] || undefined;
}

function getLabel(toolInvocation: ToolInvocation, isDone: boolean): string {
  const { toolName, args } = toolInvocation;
  const command = args?.command as string | undefined;

  if (toolName === "str_replace_editor") {
    const fileName = getFileName(args?.path) || "a file";

    switch (command) {
      case "create":
        return isDone ? `Created ${fileName}` : `Creating ${fileName}`;
      case "str_replace":
      case "insert":
        return isDone ? `Edited ${fileName}` : `Editing ${fileName}`;
      case "view":
        return isDone ? `Viewed ${fileName}` : `Viewing ${fileName}`;
      case "undo_edit":
        return isDone ? `Reverted ${fileName}` : `Reverting ${fileName}`;
      default:
        return isDone ? `Updated ${fileName}` : `Updating ${fileName}`;
    }
  }

  if (toolName === "file_manager") {
    switch (command) {
      case "rename": {
        const from = getFileName(args?.path) || "a file";
        const to = getFileName(args?.new_path) || "a new location";
        return isDone
          ? `Renamed ${from} to ${to}`
          : `Renaming ${from} to ${to}`;
      }
      case "delete": {
        const fileName = getFileName(args?.path) || "a file";
        return isDone ? `Deleted ${fileName}` : `Deleting ${fileName}`;
      }
      default:
        return toolName;
    }
  }

  return toolName;
}

export function ToolInvocationBadge({
  toolInvocation,
}: ToolInvocationBadgeProps) {
  const isDone = toolInvocation.state === "result" && !!toolInvocation.result;
  const label = getLabel(toolInvocation, isDone);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isDone ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
