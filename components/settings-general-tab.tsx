"use client";

import type { User } from "@supabase/supabase-js";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAvatar, uploadAvatar } from "~/app/action/setting";
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
import { useProfile } from "~/hooks/use-profile";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { updateProfileSchema } from "~/lib/schemas";
import { getPastelColor } from "../lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

interface SettingsGeneralTabProps {
  user: User;
  onCancel: () => void;
}

export function SettingsGeneralTab({
  user,
  onCancel,
}: SettingsGeneralTabProps) {
  const { profile, updateProfile } = useProfile();
  const { workspaces, setDefaultWorkspace, isSettingDefault } = useWorkspaces();
  const defaultFullName = profile?.full_name || "";

  const [isUploading, setIsUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    profile?.avatar_url || null,
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
        throw new Error(result.error);
      }

      setAvatarUrl(null);
      toast.success("Avatar removed successfully");
    } catch (error) {
      // biome-ignore lint/complexity/noUselessCatch: Error already toasted, re-throw to propagate to caller
      throw error;
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
      updateProfile({ full_name: value.full_name });
      onCancel();
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isDirty = useStore(form.store, (state) => state.isDirty);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex flex-col"
    >
      <FieldGroup>
        <div className="flex justify-center pb-4 border-b border-border">
          <form.Field name="full_name">
            {(field) => (
              <AvatarUpload
                currentAvatarUrl={avatarUrl}
                fullName={field.state.value}
                onUpload={handleAvatarUpload}
                onRemove={handleAvatarRemove}
                isUploading={isUploading}
              />
            )}
          </form.Field>
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
                  disabled={field.form.state.isSubmitting}
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

        <Field>
          <FieldLabel>Default Workspace</FieldLabel>
          <Select
            value={
              workspaces.find((ws) => ws.is_default)?.id || workspaces[0]?.id
            }
            onValueChange={(value) => setDefaultWorkspace(value)}
            disabled={isSettingDefault}
          >
            <SelectTrigger>
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${getPastelColor(workspaces.find((ws) => ws.is_default)?.id || workspaces[0]?.id)}`}
                  />
                  <span className="truncate">
                    {workspaces.find((ws) => ws.is_default)?.name ||
                      workspaces[0]?.name}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={ws.id}>
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-2 h-2 rounded-full ${getPastelColor(ws.id)}`}
                    />
                    <span className="truncate">{ws.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </FieldGroup>

      <SettingsDialogFooter
        isSubmitting={isSubmitting}
        isDirty={isDirty}
        onCancel={onCancel}
      />
    </form>
  );
}
