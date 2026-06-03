import { safeDomain } from "~/lib/utils";
import { MatrixFaviconLoader, TextDecrypt } from "./loading-animations";

interface BookmarkListItemLoadingProps {
  url: string;
}

export function BookmarkListItemLoading({ url }: BookmarkListItemLoadingProps) {
  const domain = safeDomain(url);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg text-left w-full relative animate-pulse-subtle">
      {/* Favicon loader */}
      <div className="shrink-0 w-6 h-6 overflow-hidden rounded-xs flex items-center justify-center">
        <MatrixFaviconLoader size={24} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-between min-w-0">
        <div className="flex-1 min-w-0 flex items-center gap-2 mr-2">
          <TextDecrypt
            text={url}
            className="text-sm font-medium truncate text-foreground/60 min-w-0"
            delay={400}
          />
          <TextDecrypt
            text={domain}
            className="text-xs text-muted-foreground/60 shrink-0 whitespace-nowrap"
            delay={600}
          />
        </div>
        <div className="shrink-0 ml-10 w-12" />
      </div>
    </div>
  );
}
