"use client";

import { SpinnerIcon } from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { useForm, useStore } from "@tanstack/react-form";
import { toast } from "sonner";
import { updateProfile } from "~/app/action/setting";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { updateProfileSchema } from "~/lib/schemas";

interface SettingsGeneralTabProps {
  user: User;
  onCancel: () => void;
}

export function SettingsGeneralTab({
  user,
  onCancel,
}: SettingsGeneralTabProps) {
  const defaultFullName = (user.user_metadata.full_name as string) || "";

  const form = useForm({
    defaultValues: {
      full_name: defaultFullName,
    },
    validators: {
      onSubmit: updateProfileSchema,
    },
    onSubmit: async ({ value }) => {
      const result = await updateProfile({ full_name: value.full_name });
      if (result?.error) {
        toast.error(result.error);
      } else {
        toast.success("Profile updated successfully");
        onCancel();
      }
    },
  });

  const fullName = useStore(
    form.store,
    (state) => state.values.full_name,
  ) as string;
  const isDirty = fullName !== defaultFullName;
  const isSubmitting = form.state.isSubmitting;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-0 space-y-4">
        <form.Field
          name="full_name"
          validators={{
            onBlur: updateProfileSchema.shape.full_name,
          }}
        >
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError}>
                <FieldLabel>
                  Full Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="full-name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={hasError}
                  disabled={isSubmitting}
                  placeholder="Enter your full name"
                />
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <Input
            id="email"
            type="email"
            value={user.email || ""}
            disabled
            className="bg-muted"
          />
          <FieldDescription>Email cannot be changed.</FieldDescription>
        </Field>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting || !isDirty}>
            {isSubmitting ? (
              <>
                <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
