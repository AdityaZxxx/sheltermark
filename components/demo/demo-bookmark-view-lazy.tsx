"use client";

import dynamic from "next/dynamic";

export const DemoBookmarkViewLazy = dynamic(
  () => import("./demo-bookmark-view").then((m) => m.DemoBookmarkView),
  {
    ssr: false,
    loading: () => (
      <div className="max-w-2xl mx-auto py-8 px-4 md:px-6 space-y-6">
        <div className="space-y-4">
          <div className="h-10 bg-muted rounded-md animate-pulse" />
          <div className="flex justify-between pt-2">
            <div className="flex gap-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="w-20 h-6 bg-muted rounded-md animate-pulse"
                />
              ))}
            </div>
            <div className="w-24 h-6 bg-muted rounded-md animate-pulse" />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    ),
  },
);
