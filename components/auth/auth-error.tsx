interface AuthErrorProps {
  error: string | null;
  id?: string;
}

export function AuthError({ error, id }: AuthErrorProps) {
  if (!error) return null;

  return (
    <div
      id={id}
      aria-live="polite"
      className="rounded-lg border border-destructive/20 bg-destructive/10 p-3"
    >
      <p className="text-sm text-destructive">{error}</p>
    </div>
  );
}
