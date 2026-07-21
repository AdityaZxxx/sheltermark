import { GlobeIcon } from "@phosphor-icons/react";
import { safeDomain } from "~/lib/utils";
import { MatrixFaviconLoader, TextDecrypt } from "./loading-animations";

interface BookmarkComfortItemLoadingProps {
  url: string;
}

export function BookmarkComfortItemLoading({
  url,
}: BookmarkComfortItemLoadingProps) {
  const domain = safeDomain(url);

  return (
    <div className="flex gap-4 rounded-lg border p-3 overflow-hidden w-full animate-pulse-subtle">
      {/* Left content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <TextDecrypt
          text={url}
          className="text-base font-medium truncate text-foreground/60"
          delay={400}
        />

        <div className="flex flex-row items-center gap-2 mt-4">
          <div className="shrink-0 w-4 h-4 rounded-xs overflow-hidden flex items-center justify-center">
            <MatrixFaviconLoader size={16} />
          </div>
          <TextDecrypt
            text={domain}
            className="text-xs text-muted-foreground/70 truncate min-w-0 flex-1"
            delay={600}
          />
        </div>
      </div>

      {/* OG thumbnail placeholder */}
      <div className="w-24 sm:w-36 shrink-0">
        <div className="w-full aspect-video rounded-md overflow-hidden bg-muted flex items-center justify-center">
          <GlobeIcon className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground/40" />
        </div>
      </div>
    </div>
  );
}
