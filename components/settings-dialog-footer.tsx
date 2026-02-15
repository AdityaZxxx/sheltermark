import { SpinnerIcon } from "@phosphor-icons/react";
import { Button } from "~/components/ui/button";

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
    <div className="flex justify-end gap-2 mt-4">
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
    </div>
  );
}
