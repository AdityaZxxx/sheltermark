"use client";

import {
  ArrowsClockwiseIcon,
  CaretUpDownIcon,
  PlusIcon,
  RssIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { Dialog, DialogContent } from "~/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";
import { useFeeds } from "~/hooks/use-feeds";
import { useWorkspaces } from "~/hooks/use-workspaces";
import type { Feed } from "~/lib/schemas/feed";
import { getPastelColor } from "~/lib/utils";

interface FeedManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FeedManager({ open, onOpenChange }: FeedManagerProps) {
  const feedsHook = useFeeds();
  const feeds = feedsHook.feeds as Feed[];
  const { subscribeToFeed, deleteFeed, refreshFeed, isSubscribing } = feedsHook;
  const { workspaces } = useWorkspaces();
  const [url, setUrl] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  const handleSubmit = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (url.trim()) {
      subscribeToFeed({
        url: url.trim(),
        workspaceId: workspaceId || undefined,
      });
      setUrl("");
      setWorkspaceId(null);
    }
  };

  const selectedWorkspace = workspaces.find((ws) => ws.id === workspaceId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-h-[95vh] transition-all duration-200">
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold">Subscriptions</h2>

          <p className="text-sm text-muted-foreground max-w-sm">
            Automatically save links from your favorite sites and publishers.
          </p>

          <form onSubmit={handleSubmit} className="space-y-2">
            <Label htmlFor="feed-url">Add subscription</Label>

            <Input
              id="feed-url"
              placeholder="https://example.com/feed.xml"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className=" h-8 mt-2"
            />

            <div className="flex items-center justify-between mt-2 gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" className="w-fit justify-between">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{
                            backgroundColor: getPastelColor(
                              selectedWorkspace?.id || workspaces[0]?.id,
                            ),
                          }}
                        />
                        <span className="truncate text-sm">
                          {selectedWorkspace
                            ? selectedWorkspace.name
                            : workspaces.find((ws) => ws.is_default)?.name}
                        </span>
                      </div>
                      <CaretUpDownIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    </Button>
                  }
                />

                <DropdownMenuContent className="w-full">
                  {workspaces.map((ws) => (
                    <DropdownMenuItem
                      key={ws.id}
                      onClick={() => setWorkspaceId(ws.id)}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: getPastelColor(ws.id) }}
                      />
                      <span>{ws.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                type="submit"
                variant="outline"
                disabled={!url.trim() || isSubscribing}
              >
                <PlusIcon className="h-4 w-4 mr-1" />
                Add
              </Button>
            </div>
          </form>

          <Separator />

          {feeds.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <RssIcon size="38" className=" mx-auto mb-2 opacity-50" />
              <p className="max-w-xs mx-auto">
                No feeds subscribed yet. Add a website or feed URL above to get
                started.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Your subscriptions
              </p>

              {feeds.map((feed) => (
                <div
                  key={feed.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-card group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-6 h-6 shrink-0 rounded overflow-hidden flex items-center justify-center">
                      {feed.icon_url ? (
                        // biome-ignore lint/performance/noImgElement: nothing to optimize
                        <img
                          src={feed.icon_url}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <RssIcon className="w-full h-full text-muted-foreground" />
                      )}
                    </div>

                    <a
                      href={feed.url}
                      target="_blank"
                      className="min-w-0 hover:underline"
                    >
                      <p className="font-medium truncate">
                        {feed.title || feed.url}
                      </p>
                    </a>
                  </div>

                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => refreshFeed(feed.id)}
                    >
                      <ArrowsClockwiseIcon className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteFeed(feed.id)}
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
