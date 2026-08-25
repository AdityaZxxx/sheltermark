import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import { DEFAULT_BASE_URL } from "./constants.js";
import { getBaseUrl, setBaseUrl } from "./storage.js";
import { Button } from "./ui/button.js";
import { cn } from "./ui/cn.js";
import { Input } from "./ui/input.js";
import { Logo } from "./ui/logo.js";

function OptionsApp() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<{
    msg: string;
    error: boolean;
  } | null>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void getBaseUrl().then(setUrl);
  }, []);

  function showStatus(msg: string, error = false) {
    if (statusTimer.current !== null) clearTimeout(statusTimer.current);
    setStatus({ msg, error });
    statusTimer.current = setTimeout(() => setStatus(null), 2500);
  }

  async function save() {
    const raw = url.trim();
    if (!raw) {
      showStatus("Enter your Sheltermark URL, including https://", true);
      return;
    }

    let normalized: string;
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("Invalid protocol");
      }
      normalized = parsed.href.replace(/\/$/, "");
    } catch {
      showStatus("Enter a full URL, including https://", true);
      return;
    }

    await setBaseUrl(normalized);
    setUrl(normalized);
    showStatus("Saved");
  }

  async function reset() {
    setUrl(DEFAULT_BASE_URL);
    await setBaseUrl(DEFAULT_BASE_URL);
    showStatus("Reset to default");
  }

  return (
    <div className="mx-auto max-w-[480px] p-8 text-sm">
      <h1 className="mb-6 flex items-center gap-2.5 text-base font-semibold">
        <Logo className="size-5" />
        Sheltermark Settings
      </h1>

      <div className="mb-4">
        <label
          htmlFor="base-url"
          className="mb-1.5 block text-xs font-medium tracking-wider text-muted-foreground uppercase"
        >
          Server URL
        </label>
        <Input
          id="base-url"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void save();
          }}
          placeholder="https://sheltermark.vercel.app"
          spellCheck={false}
          autoComplete="off"
          className="font-mono text-[13px]"
        />
        <p className="mt-1.5 text-xs text-muted-foreground">
          Change this only if you are self-hosting or developing locally.
        </p>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <Button onClick={() => void save()}>Save</Button>
        <Button variant="secondary" onClick={() => void reset()}>
          Reset to default
        </Button>
        <output
          className={cn(
            "text-xs transition-opacity",
            status === null && "opacity-0",
            status?.error === true && "text-red-600 dark:text-red-400",
            status?.error === false &&
              status !== null &&
              "text-green-700 dark:text-green-600",
          )}
        >
          {status?.msg ?? ""}
        </output>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
