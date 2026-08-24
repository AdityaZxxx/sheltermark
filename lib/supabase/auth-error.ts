const FRIENDLY_AUTH_MESSAGES = [
  "User already registered",
  "Invalid login credentials",
  "Email not confirmed",
  "Signups not allowed",
  "Password should be at least",
  "New password should be different from the old password",
  // Supabase rejects reserved-TLD addresses (e.g. .test) at signup.
  "Email address",
  "email rate limit exceeded",
];

export function friendlyAuthError(error: { message: string }): string {
  const message = error.message ?? "";
  if (FRIENDLY_AUTH_MESSAGES.some((m) => message.startsWith(m))) {
    return message;
  }
  return "Something went wrong. Please try again.";
}
