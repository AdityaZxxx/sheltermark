import { SpinnerIcon } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";
import { DialogFooter } from "~/components/ui/dialog";

interface SettingsDialogFooterProps {
  isSubmitting: boolean;
  isDirty: boolean;
  isDisabled?: boolean;
  onCancel: () => void;
}

export function SettingsDialogFooter({
  isSubmitting,
  isDirty,
  isDisabled = false,
  onCancel,
}: SettingsDialogFooterProps) {
  return (
    <DialogFooter className="mt-6 pt-4 border-t shrink-0 sticky bottom-0 bg-background">
      <Button
        type="button"
        variant="outline"
        onClick={onCancel}
        disabled={isSubmitting}
      >
        Cancel
      </Button>
      <Button type="submit" disabled={isSubmitting || !isDirty || isDisabled}>
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
