/**
 * 工作区下拉选择器，基于 SelectField 封装。
 */
import { FolderOpen } from "lucide-react";
import type { Workspace } from "@agent-console/contracts";
import { SelectField } from "../ui/SelectField";

interface WorkspaceSelectProps {
  workspaces: Workspace[];
  value: string;
  onValueChange: (value: string) => void;
  label: string;
  size?: "sm" | "md";
  className?: string;
}

export function WorkspaceSelect({
  workspaces,
  value,
  onValueChange,
  label,
  size = "md",
  className = "",
}: WorkspaceSelectProps) {
  const options = [
    { value: "all", label: "全部工作区" },
    ...workspaces.map((workspace) => ({
      value: workspace.id,
      label: workspace.name,
    })),
  ];

  return (
    <SelectField
      value={value}
      onValueChange={onValueChange}
      options={options}
      label={label}
      size={size}
      className={className}
      icon={<FolderOpen className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />}
    />
  );
}
