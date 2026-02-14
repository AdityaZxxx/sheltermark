"use client";

import { CheckIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  checkUsernameAvailability,
  updatePublicProfile,
} from "~/app/action/setting";
import { Button } from "~/components/ui/button";
import {
  Field,
  FieldContent,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Switch } from "~/components/ui/switch";
import { useDebounce } from "~/hooks/use-debounce";
import { usernameSchema } from "~/lib/schemas";
import { Textarea } from "./ui/textarea";

interface ProfileData {
  username: string | null;
  bio: string | null;
  github_url: string | null;
  x_url: string | null;
  website_url: string | null;
  is_public: boolean;
}

interface SettingsProfileTabProps {
  profile: ProfileData | null;
  onCancel: () => void;
}

function extractUsername(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/^\//, "") || "";
  } catch {
    return url.replace(/^https?:\/\/(www\.)?(github\.com|x\.com)\//, "");
  }
}

function extractWebsite(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return parsed.hostname + path;
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  }
}

export function SettingsProfileTab({
  profile,
  onCancel,
}: SettingsProfileTabProps) {
  const initialValues = profile
    ? {
        username: profile.username || "",
        bio: profile.bio || "",
        github_username: extractUsername(profile.github_url),
        x_username: extractUsername(profile.x_url),
        website: extractWebsite(profile.website_url),
        is_public: profile.is_public ?? false,
      }
    : {
        username: "",
        bio: "",
        github_username: "",
        x_username: "",
        website: "",
        is_public: false,
      };

  // Username availability state
  const [usernameStatus, setUsernameStatus] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const originalUsername = profile?.username || "";

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      const result = await updatePublicProfile({
        username: value.username,
        is_public: value.is_public,
        bio: value.bio,
        github_username: value.github_username,
        x_username: value.x_username,
        website: value.website,
        current_username: originalUsername,
      });

      if (result?.error) {
        if (result.error.includes("unique constraint")) {
          toast.error("This username is already taken. Please choose another.");
        } else {
          toast.error(result.error);
        }
      } else {
        toast.success("Profile updated successfully");
        onCancel();
      }
    },
  });

  // Reactive dirty check using useStore
  const formValues = useStore(form.store, (state) => state.values);
  const isDirty = useMemo(() => {
    if (!profile) return false;
    return (
      formValues.username !== initialValues.username ||
      formValues.bio !== initialValues.bio ||
      formValues.github_username !== initialValues.github_username ||
      formValues.x_username !== initialValues.x_username ||
      formValues.website !== initialValues.website ||
      formValues.is_public !== initialValues.is_public
    );
  }, [formValues, initialValues, profile]);

  const isSubmitting = form.state.isSubmitting;

  // Get current username for debounced checking - use useStore for reactivity
  const usernameValue =
    useStore(form.store, (state) => state.values.username) || "";
  const debouncedUsername = useDebounce(usernameValue.trim(), 500);

  // Check username availability
  useEffect(() => {
    if (
      !debouncedUsername ||
      debouncedUsername.length < 3 ||
      debouncedUsername === originalUsername
    ) {
      setUsernameStatus("idle");
      return;
    }

    const isValidFormat = /^[a-zA-Z0-9_]+$/.test(debouncedUsername);
    if (!isValidFormat) {
      setUsernameStatus("idle");
      return;
    }

    const checkAvailability = async () => {
      setUsernameStatus("checking");

      const result = await checkUsernameAvailability({
        username: debouncedUsername,
        current_username: originalUsername,
      });

      if (result.error) {
        setUsernameStatus("idle");
      } else if (result.available) {
        setUsernameStatus("available");
      } else {
        setUsernameStatus("taken");
      }
    };

    checkAvailability();
  }, [debouncedUsername, originalUsername]);

  // Helper to render username status icon
  const renderUsernameStatusIcon = () => {
    switch (usernameStatus) {
      case "checking":
        return (
          <SpinnerIcon className="h-4 w-4 animate-spin text-muted-foreground" />
        );
      case "available":
        return <CheckIcon className="h-4 w-4 text-green-500" weight="bold" />;
      case "taken":
        return <XIcon className="h-4 w-4 text-destructive" weight="bold" />;
      default:
        return <CheckIcon className="h-4 w-4 text-green-500" weight="bold" />;
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
    >
      <FieldGroup className="gap-0 space-y-4">
        <form.Field name="is_public">
          {(field) => (
            <Field className="" orientation="horizontal">
              <FieldContent>
                <FieldLabel className="font-medium">Public Profile</FieldLabel>
              </FieldContent>
              <Switch
                checked={field.state.value}
                onCheckedChange={field.handleChange}
                disabled={isSubmitting}
              />
            </Field>
          )}
        </form.Field>

        <form.Field
          name="username"
          validators={{
            onBlur: usernameSchema,
          }}
        >
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError || usernameStatus === "taken"}>
                <FieldLabel>
                  Username <span className="text-destructive">*</span>
                </FieldLabel>
                <div className="relative">
                  <Input
                    id="username"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => {
                      // Force lowercase and only allow a-z, 0-9, _
                      const filtered = e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9_]/g, "");
                      field.handleChange(filtered);
                    }}
                    disabled={isSubmitting}
                    placeholder="username"
                    className="pr-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center">
                    {renderUsernameStatusIcon()}
                  </div>
                </div>
                {hasError && <FieldError errors={field.state.meta.errors} />}
                {usernameStatus === "taken" && !hasError && (
                  <FieldError
                    errors={[{ message: "This username is already taken" }]}
                  />
                )}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="bio">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError}>
                <FieldLabel>Bio</FieldLabel>
                <Textarea
                  id="bio"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => {
                    const value = e.target.value.slice(0, 160);
                    field.handleChange(value);
                  }}
                  disabled={isSubmitting}
                  placeholder="Short bio about you"
                  className="min-h-20 w-full max-w-full resize-y overflow-x-hidden"
                />
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="github_username">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError}>
                <FieldLabel>GitHub</FieldLabel>
                <Input
                  id="github"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Username"
                />
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="x_username">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError}>
                <FieldLabel>X (Twitter)</FieldLabel>
                <Input
                  id="x"
                  name={field.name}
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  disabled={isSubmitting}
                  placeholder="Username"
                />
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <form.Field name="website">
          {(field) => {
            const hasError = field.state.meta.errors.length > 0;
            return (
              <Field data-invalid={hasError}>
                <FieldLabel>Website</FieldLabel>
                <div className="flex">
                  <span className="inline-flex items-center rounded-l-xl border border-r-0 border-input bg-muted px-2 text-sm text-muted-foreground">
                    https://
                  </span>
                  <Input
                    id="website"
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    disabled={isSubmitting}
                    placeholder="Website (domain or URL)"
                    className="rounded-l-none"
                  />
                </div>
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>

        <div className="flex justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={
              isSubmitting ||
              !isDirty ||
              usernameStatus === "taken" ||
              usernameStatus === "checking"
            }
          >
            {isSubmitting ? (
              <>
                <SpinnerIcon className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Profile"
            )}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
