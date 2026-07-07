import Link from "next/link";
import { Button } from "~/components/ui/button";

export default function AuthCodeErrorPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-xs flex flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-xl font-semibold">Authentication Error</h1>
          <p className="text-sm text-muted-foreground">
            The authentication link is invalid or has expired. Please try again.
          </p>
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Link href="/login">
            <Button className="w-full">Back to Login</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
