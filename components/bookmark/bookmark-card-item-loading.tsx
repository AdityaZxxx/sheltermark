import { GlobeIcon } from "@phosphor-icons/react";
import { safeDomain } from "~/lib/utils";
import { MatrixFaviconLoader, TextDecrypt } from "./loading-animations";

interface BookmarkCardItemLoadingProps {
  url: string;
}

export function BookmarkCardItemLoading({ url }: BookmarkCardItemLoadingProps) {
  const domain = safeDomain(url);

  return (
    <div className="flex flex-col rounded-sm overflow-hidden h-full relative animate-pulse-subtle">
      {/* Image placeholder */}
      <div className="aspect-1200/628 w-full overflow-hidden relative">
        <div className="w-full h-full flex items-center justify-center bg-muted">
          <GlobeIcon className="w-12 h-12 text-muted-foreground/20" />
        </div>
        {/* Title overlay - raw URL with decrypt */}
        <div className="absolute bottom-0.5 left-1 right-1 bg-black/60 px-2 py-1 mx-auto">
          <TextDecrypt
            text={url}
            className="text-[10px] text-white/70 truncate leading-none font-medium"
            delay={400}
          />
        </div>
      </div>

      {/* Bottom info */}
      <div className="flex items-center px-4 py-3 justify-between w-full">
        <div className="flex gap-2 min-w-0 flex-1 mr-2">
          <div className="shrink-0 w-4 h-4 rounded-xs overflow-hidden flex items-center justify-center">
            <MatrixFaviconLoader size={16} />
          </div>
          <TextDecrypt
            text={domain}
            className="text-xs font-medium text-muted-foreground/70 truncate"
            delay={600}
          />
        </div>
        <div className="shrink-0 min-w-[80px]" />
      </div>
    </div>
  );
}
