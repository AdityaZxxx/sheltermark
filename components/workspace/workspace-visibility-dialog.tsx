import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";

interface WorkspaceVisibilityDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  mode: "public" | "private";
}

export function WorkspaceVisibilityDialog({
  isOpen,
  onOpenChange,
  onConfirm,
  mode,
}: WorkspaceVisibilityDialogProps) {
  const isPublic = mode === "public";

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isPublic ? "Make Public" : "Make Private"}</DialogTitle>
          <DialogDescription>
            {isPublic
              ? "Make this workspace public to share it with others."
              : "Are you sure you want to make this workspace private? It will no longer be accessible via the public link."}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex flex-row justify-end ">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onConfirm}>
            {isPublic ? "Make Public" : "Make Private"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
