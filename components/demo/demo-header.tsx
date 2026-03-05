import type { Workspace } from "~/types/workspace.types";
import { DemoWorkspaceMenu } from "./demo-workspace-menu";

interface DemoHeaderProps {
  workspaces: Workspace[];
  currentWorkspaceId: string;
  onSelectWorkspace: (id: string) => void;
}

export function DemoHeader({
  workspaces,
  currentWorkspaceId,
  onSelectWorkspace,
}: DemoHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b px-4 md:px-6 py-4 mx-auto w-full">
      <div className="flex items-center gap-4">
        <DemoWorkspaceMenu
          workspaces={workspaces}
          currentWorkspaceId={currentWorkspaceId}
          onSelectWorkspace={onSelectWorkspace}
        />
      </div>
    </header>
  );
}
