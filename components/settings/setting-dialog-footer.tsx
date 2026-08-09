import { SpinnerIcon } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

interface SettingsDialogFooterProps {
  isSubmitting: boolean;
  isDirty: boolean;
  isDisabled?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

export function SettingsDialogFooter({
  isSubmitting,
  isDirty,
  isDisabled = false,
  onCancel,
  onSubmit,
}: SettingsDialogFooterProps) {
  return (
    <DialogFooter className="shrink-0 border-t bg-background px-4 py-3 flex-row justify-end">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || !isDirty || isDisabled}
      >
        {isSubmitting ? (
          <>
            <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          "Save"
        )}
      </Button>
    </DialogFooter>
  );
}
