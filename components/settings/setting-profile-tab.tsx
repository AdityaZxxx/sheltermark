"use client";

import { CheckIcon, SpinnerIcon, XIcon } from "@phosphor-icons/react";
import { useForm, useStore } from "@tanstack/react-form";
import { useEffect, useReducer, useRef } from "react";
import { checkUsernameAvailability } from "~/app/action/setting.action";
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
import { useProfile } from "~/hooks/use-profile";
import { usernameSchema } from "~/lib/schemas/profile.schema";
import { Textarea } from "../ui/textarea";

interface SettingsProfileTabProps {
  onCancel: () => void;
  onRegisterFooter: (state: {
    isSubmitting: boolean;
    isDirty: boolean;
    isDisabled: boolean;
    onSubmit: () => void;
  }) => void;
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

function UsernameStatusIcon({
  status,
}: {
  status: "checking" | "available" | "taken" | "idle";
}) {
  if (status === "checking") {
    return (
      <SpinnerIcon className="h-4 w-4 animate-spin text-muted-foreground" />
    );
  }
  if (status === "available") {
    return <CheckIcon className="h-4 w-4 text-green-500" weight="bold" />;
  }
  if (status === "taken") {
    return <XIcon className="h-4 w-4 text-destructive" weight="bold" />;
  }
  return null;
}

type UsernameStatus = "idle" | "checking" | "available" | "taken";

function usernameStatusReducer(
  _state: UsernameStatus,
  action: { type: "IDLE" | "CHECKING" | "AVAILABLE" | "TAKEN" },
): UsernameStatus {
  switch (action.type) {
    case "IDLE":
      return "idle";
    case "CHECKING":
      return "checking";
    case "AVAILABLE":
      return "available";
    case "TAKEN":
      return "taken";
  }
}

export function SettingsProfileTab({
  onCancel,
  onRegisterFooter,
}: SettingsProfileTabProps) {
  const { profile, updatePublicProfile } = useProfile();

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

  const originalUsername = profile?.username || "";

  const form = useForm({
    defaultValues: initialValues,
    onSubmit: async ({ value }) => {
      updatePublicProfile({
        username: value.username,
        is_public: value.is_public,
        bio: value.bio,
        github_username: value.github_username,
        x_username: value.x_username,
        website: value.website,
        current_username: originalUsername,
      });

      onCancel();
    },
  });

  // Reactive form states
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
  const isDirty = useStore(form.store, (state) => state.isDirty);

  // Get current username for debounced checking - use useStore for reactivity
  const usernameValue =
    useStore(form.store, (state) => state.values.username) || "";
  const debouncedUsername = useDebounce(usernameValue.trim(), 500);

  // Use a reducer so the effect can dispatch state transitions
  // (idle → checking → available|taken) without calling setState
  // synchronously in the effect body. React Compiler can track
  // dispatch because the reducer is a pure function.
  const [usernameStatus, dispatch] = useReducer(usernameStatusReducer, "idle");

  useEffect(() => {
    if (
      !debouncedUsername ||
      debouncedUsername.length < 3 ||
      debouncedUsername === originalUsername
    ) {
      dispatch({ type: "IDLE" });
      return;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(debouncedUsername)) {
      dispatch({ type: "IDLE" });
      return;
    }

    dispatch({ type: "CHECKING" });

    let cancelled = false;

    checkUsernameAvailability({
      username: debouncedUsername,
      current_username: originalUsername,
    }).then((result) => {
      if (cancelled) return;
      if (!result.success) {
        dispatch({ type: "IDLE" });
      } else if (result.data?.available) {
        dispatch({ type: "AVAILABLE" });
      } else {
        dispatch({ type: "TAKEN" });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [debouncedUsername, originalUsername]);

  const showUsernameIcon = usernameValue && usernameValue.length >= 3;
  const footerDisabled =
    usernameStatus === "taken" || usernameStatus === "checking";

  const formRef = useRef(form);
  formRef.current = form;

  useEffect(() => {
    onRegisterFooter({
      isSubmitting,
      isDirty,
      isDisabled: footerDisabled,
      onSubmit: () => formRef.current.handleSubmit(),
    });
  }, [isSubmitting, isDirty, footerDisabled, onRegisterFooter]);

  return (
    <form
      id="settings-profile-form"
      onSubmit={(e) => {
        e.preventDefault();
        form.handleSubmit();
      }}
      className="flex min-h-0 flex-1 flex-col"
    >
      <FieldGroup className="scroll-fade flex-1 overflow-y-auto px-4 py-4">
        <form.Field name="is_public">
          {(field) => (
            <Field orientation="horizontal">
              <FieldContent>
                <FieldLabel>Public Profile</FieldLabel>
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
            onChange: usernameSchema,
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
                    {showUsernameIcon && (
                      <UsernameStatusIcon status={usernameStatus} />
                    )}
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
                  rows={2}
                  maxLength={160}
                  className="resize-none"
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
                    onChange={(e) => {
                      // Auto-strip https:// prefix when user types or pastes
                      const value = e.target.value.replace(/^https?:\/\//, "");
                      field.handleChange(value);
                    }}
                    disabled={isSubmitting}
                    placeholder="example.com"
                    className="rounded-l-none"
                  />
                </div>
                {hasError && <FieldError errors={field.state.meta.errors} />}
              </Field>
            );
          }}
        </form.Field>
      </FieldGroup>
    </form>
  );
}
