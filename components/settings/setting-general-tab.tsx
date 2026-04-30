"use client";

import {
  DownloadSimpleIcon,
  EnvelopeIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import type { User } from "@supabase/supabase-js";
import { useForm, useStore } from "@tanstack/react-form";
import { useState } from "react";
import { toast } from "sonner";
import { deleteAvatar, uploadAvatar } from "~/app/action/setting";
import { AvatarUpload } from "~/components/settings/avatar-upload";
import { SettingsDialogFooter } from "~/components/settings/setting-dialog-footer";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useProfile } from "~/hooks/use-profile";
import { useWorkspaces } from "~/hooks/use-workspaces";
import { updateProfileSchema } from "~/lib/schemas/profile";
import { getPastelColor } from "~/lib/utils";

interface SettingsGeneralTabProps {
  user: User;
  onCancel: () => void;
  onOpenExportDialog: () => void;
  onOpenImportDialog: () => void;
  onOpenDeleteAlert?: () => void;
}

export function SettingsGeneralTab({
  user,
  onCancel,
  onOpenExportDialog,
  onOpenImportDialog,
  onOpenDeleteAlert,
}: SettingsGeneralTabProps) {
  const { profile, updateProfile } = useProfile();
  const { workspaces, setDefaultWorkspace, isSettingDefault } = useWorkspaces();
  const defaultName = profile?.name || "";

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

      if (!result.success) {
        toast.error(result.error);
        throw new Error(result.error);
      }

      const avatarUrl = result.data?.avatarUrl ?? null;
      if (avatarUrl) {
        setAvatarUrl(avatarUrl);
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

      if (!result.success) {
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
      name: defaultName,
    },
    validators: {
      onSubmit: updateProfileSchema,
    },
    onSubmit: async ({ value }) => {
      updateProfile({ name: value.name });
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
          <form.Field name="name">
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
          name="name"
          validators={{
            onBlur: updateProfileSchema.shape.name,
          }}
        >
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError}>
                <FieldLabel>
                  Name <span className="text-destructive">*</span>
                </FieldLabel>
                <Input
                  id="name"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={hasError}
                  disabled={field.form.state.isSubmitting}
                  placeholder="Enter your name"
                />
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <Field>
          <FieldLabel>Email</FieldLabel>
          <div className="relative">
            <Input
              id="email"
              type="email"
              value={user.email || ""}
              disabled
              className="bg-muted pl-10"
            />
            <EnvelopeIcon
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <FieldDescription>Email cannot be changed.</FieldDescription>
        </Field>

        <Field>
          <FieldLabel>Default Workspace</FieldLabel>
          <Select
            value={
              workspaces.find((ws) => ws.is_default)?.id ||
              workspaces[0]?.id ||
              ""
            }
            onValueChange={(value) => value && setDefaultWorkspace(value)}
            disabled={isSettingDefault}
          >
            <SelectTrigger>
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: getPastelColor(
                        workspaces.find((ws) => ws.is_default)?.id ||
                          workspaces[0]?.id,
                      ),
                    }}
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
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: getPastelColor(ws.id) }}
                    />
                    <span className="truncate">{ws.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="pt-4 border-t border-border">
          <FieldLabel className="pb-2">Import & Export</FieldLabel>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenImportDialog}
              className="flex-1 gap-2"
            >
              <UploadSimpleIcon className="size-4" />
              Import
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onOpenExportDialog}
              className="flex-1 gap-2"
            >
              <DownloadSimpleIcon className="size-4" />
              Export
            </Button>
          </div>
        </div>

        <div className="pt-4 border-t border-border">
          <FieldLabel className="pb-2">Danger Zone</FieldLabel>
          <p className="text-xs text-muted-foreground pb-3">
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </p>
          <Button
            variant="destructive"
            size="sm"
            className="mt-4"
            onClick={onOpenDeleteAlert}
          >
            <TrashIcon className="size-4" />
            Delete Account
          </Button>
        </div>
      </FieldGroup>

      <SettingsDialogFooter
        isSubmitting={isSubmitting}
        isDirty={isDirty}
        onCancel={onCancel}
      />
    </form>
  );
}
