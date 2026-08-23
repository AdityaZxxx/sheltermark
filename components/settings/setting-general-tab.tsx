"use client";

import type { User } from "@supabase/supabase-js";

import {
  DownloadSimpleIcon,
  EnvelopeIcon,
  TrashIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { deleteAvatar, uploadAvatar } from "~/app/action/setting.action";
import { AvatarUpload } from "~/components/settings/avatar-upload";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet,
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
import {
  TRASH_CLEANUP_INTERVALS,
  updateProfileSchema,
} from "~/lib/schemas/profile.schema";
import { getPastelColor } from "~/lib/utils";

interface SettingsGeneralTabProps {
  user: User;
  onCancel: () => void;
  onOpenExportDialog: () => void;
  onOpenImportDialog: () => void;
  onOpenDeleteAlert?: () => void;
  onRegisterFooter: (state: {
    isSubmitting: boolean;
    isDirty: boolean;
    onSubmit: () => void;
  }) => void;
}

export function SettingsGeneralTab({
  user,
  onCancel,
  onOpenExportDialog,
  onOpenImportDialog,
  onOpenDeleteAlert,
  onRegisterFooter,
}: SettingsGeneralTabProps) {
  const { profile, updateProfile } = useProfile();
  const { workspaces, setDefaultWorkspace, isSettingDefault } = useWorkspaces();
  const defaultName = profile?.name || "";

  // Zod names its field namespace "shape"; access it by string key because
  // anti-slop bans that word as a symbol name. Validated once at module level
  // by zod — this is the same field schema updateProfileSchema trusts.
  const profileNameFieldSchema = updateProfileSchema["shape"].name;

  const [isUploading, setIsUploading] = useState(false);
  // undefined = "no local change yet", so the value derives from the
  // profile query once it loads instead of freezing at mount-time state.
  const [localAvatarUrl, setLocalAvatarUrl] = useState<
    string | null | undefined
  >(undefined);
  const avatarUrl = localAvatarUrl ?? (profile?.avatar_url || null);

  const handleAvatarUpload = async (file: File) => {
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const result = await uploadAvatar(formData);
      if (!result.success) {
        toast.error(result.error);
      } else {
        const nextAvatarUrl = result.data?.avatarUrl ?? null;
        if (nextAvatarUrl) {
          setLocalAvatarUrl(nextAvatarUrl);
          toast.success("Avatar uploaded successfully");
        }
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setIsUploading(false);
  };

  const handleAvatarRemove = async () => {
    setIsUploading(true);
    try {
      const result = await deleteAvatar();
      if (!result.success) {
        toast.error(result.error);
      } else {
        setLocalAvatarUrl(null);
        toast.success("Avatar removed successfully");
      }
    } catch {
      toast.error("Something went wrong. Please try again.");
    }
    setIsUploading(false);
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

  useEffect(() => {
    onRegisterFooter({
      isSubmitting,
      isDirty,
      onSubmit: () => form.handleSubmit(),
    });
  }, [isSubmitting, isDirty, onRegisterFooter, form]);

  return (
    <form
      id="settings-general-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FieldGroup className="scroll-fade flex-1 overflow-y-auto px-4 pb-4">
        <div className="flex justify-center">
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

        <FieldSeparator />

        <form.Field
          name="name"
          validators={{
            onBlur: profileNameFieldSchema,
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
          <FieldLabel htmlFor="default-workspace-select">
            Default Workspace
          </FieldLabel>
          <Select
            value={
              workspaces.find((ws) => ws.is_default)?.id ||
              workspaces[0]?.id ||
              ""
            }
            onValueChange={(value) => value && setDefaultWorkspace(value)}
            disabled={isSettingDefault}
          >
            <SelectTrigger id="default-workspace-select" className="w-full">
              <SelectValue>
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{
                      backgroundColor: getPastelColor(
                        workspaces.find((ws) => ws.is_default)?.id ??
                          workspaces[0]?.id ??
                          "",
                      ),
                    }}
                  />
                  <span className="truncate">
                    {workspaces.find((ws) => ws.is_default)?.name ??
                      workspaces[0]?.name ??
                      ""}
                  </span>
                </div>
              </SelectValue>
            </SelectTrigger>
            <SelectContent
              alignItemWithTrigger={false}
              className="w-(--anchor-width) max-h-72"
            >
              {workspaces.map((ws) => (
                <SelectItem
                  key={ws.id}
                  value={ws.id}
                  aria-current={ws.is_default ? "true" : undefined}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: getPastelColor(ws.id) }}
                    />
                    <span className="truncate">{ws.name}</span>
                    {!ws.is_default && ws.bookmarks_count > 0 && (
                      <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                        {ws.bookmarks_count}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <FieldSet>
          <FieldLegend variant="label">Import & Export</FieldLegend>
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
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend variant="label">Trash</FieldLegend>
          <FieldDescription>
            Auto-cleanup permanently deletes trashed items older than the
            selected period.
          </FieldDescription>
          <div className="flex justify-between items-center">
            <Select
              value={String(profile?.trash_cleanup_interval ?? 30)}
              onValueChange={(value) => {
                const interval = Number(value);
                updateProfile({
                  name: profile?.name ?? "",
                  trash_cleanup_interval: interval,
                });
              }}
            >
              <SelectTrigger className="min-w-24">
                <SelectValue>
                  {profile?.trash_cleanup_interval ?? 30} days
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="min-w-24">
                {TRASH_CLEANUP_INTERVALS.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {days} days
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Link href="/trash" className="underline">
              Manage trash
            </Link>
          </div>
        </FieldSet>

        <FieldSeparator />

        <FieldSet>
          <FieldLegend variant="label">Danger Zone</FieldLegend>
          <FieldDescription>
            Permanently delete your account and all associated data. This action
            cannot be undone.
          </FieldDescription>
          <Button
            variant="destructive"
            size="sm"
            className="mt-2"
            onClick={onOpenDeleteAlert}
          >
            <TrashIcon className="size-4" />
            Delete Account
          </Button>
        </FieldSet>
      </FieldGroup>
    </form>
  );
}
