import { Suspense } from "react";
import { FeedManager } from "~/components/feed/feed-manager";

export default function FeedsPage() {
  return (
    <main className="min-h-dvh bg-background p-6">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">RSS Feeds</h1>
        <Suspense
          fallback={<div className="text-center py-8">Loading feeds...</div>}
        >
          <FeedManager />
        </Suspense>
      </div>
    </main>
  );
}
