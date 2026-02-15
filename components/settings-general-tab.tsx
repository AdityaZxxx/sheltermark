"use client";

import type { User } from "@supabase/supabase-js";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import {
  deleteAvatar,
  updateProfile,
  uploadAvatar,
} from "~/app/action/setting";
import { AvatarUpload } from "~/components/avatar-upload";
import { SettingsDialogFooter } from "~/components/settings-dialog-footer";
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

  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    (user.user_metadata.avatar_url as string) || null,
  );

  const handleAvatarUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const result = await uploadAvatar(formData);

      if (result.error) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      if (result.avatarUrl) {
        setAvatarUrl(result.avatarUrl);
        toast.success("Avatar uploaded successfully");
      }
    } catch {
      toast.error("Failed to upload avatar");
      throw new Error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleAvatarRemove = async () => {
    setIsUploading(true);
    try {
      const result = await deleteAvatar();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      setAvatarUrl(null);
      toast.success("Avatar removed successfully");
    } catch {
      toast.error("Failed to remove avatar");
    } finally {
      setIsUploading(false);
    }
  };

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
      <FieldGroup>
        <div className="flex justify-center pb-4 border-b border-border">
          <AvatarUpload
            currentAvatarUrl={avatarUrl}
            fullName={fullName}
            onUpload={handleAvatarUpload}
            onRemove={handleAvatarRemove}
            isUploading={isUploading}
          />
        </div>

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

        <SettingsDialogFooter
          isSubmitting={isSubmitting}
          isDirty={isDirty}
          onCancel={onCancel}
        />
      </FieldGroup>
    </form>
  );
}
