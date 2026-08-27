"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { BookmarkInput } from "~/components/bookmark/bookmark-input";
import { BookmarkListItem } from "~/components/bookmark/bookmark-list-item";
import {
  DEMO_STORY_CONTEXT as CONTEXT,
  DEMO_STORY_HERO as HERO,
} from "~/lib/demo-data";

import { CARD_CLASS, useInView, usePrefersReducedMotion } from "./lib";

const EASE = [0.2, 0, 0, 1] as const;

type Phase = "idle" | "saved" | "enriched" | "found" | "checking" | "flagged";

export function StoryDemo() {
  const reduce = usePrefersReducedMotion();
  const cardRef = useRef<HTMLDivElement>(null);
  const inView = useInView(cardRef);

  const [phase, setPhase] = useState<Phase>(reduce ? "flagged" : "idle");
  const [query, setQuery] = useState("");
  const [heroRefetching, setHeroRefetching] = useState(false);

  useEffect(() => {
    if (reduce || !inView) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const sleep = (ms: number) =>
      new Promise<void>((r) => {
        timer = setTimeout(r, ms);
      });
    const typeWord = async (word: string) => {
      for (let i = 1; i <= word.length; i++) {
        if (cancelled) return;
        setQuery(word.slice(0, i));
        await sleep(110);
      }
    };

    (async () => {
      await sleep(700);
      // oxlint-disable-next-line no-unmodified-loop-condition -- cancelled flips from effect cleanup; guarded below
      while (!cancelled) {
        setPhase("idle");
        setQuery("");
        setHeroRefetching(false);
        await sleep(1000);
        if (cancelled) return;
        setPhase("saved");
        await sleep(1400);
        if (cancelled) return;
        setHeroRefetching(true);
        await sleep(900);
        if (cancelled) return;
        setHeroRefetching(false);
        setPhase("enriched");
        await sleep(1600);
        if (cancelled) return;
        await typeWord("kreate");
        if (cancelled) return;
        setPhase("found");
        await sleep(1900);
        if (cancelled) return;
        setQuery("");
        setPhase("checking");
        await sleep(1100);
        if (cancelled) return;
        setPhase("flagged");
        await sleep(2400);
        if (cancelled) return;
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [reduce, inView]);

  const heroPresent = phase !== "idle";
  const heroEnriched =
    phase === "enriched" ||
    phase === "found" ||
    phase === "checking" ||
    phase === "flagged";
  const boardBroken = phase === "flagged";
  const boardChecking = phase === "checking";

  const rows = useMemo(() => {
    const list: {
      key: string;
      kind: "hero" | "context";
      context?: (typeof CONTEXT)[number];
    }[] = [];
    if (heroPresent) list.push({ key: HERO.id, kind: "hero" });
    for (const c of CONTEXT)
      list.push({ key: c.id, kind: "context", context: c });
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const title = r.kind === "hero" ? HERO.title : (r.context?.title ?? "");
      const url = r.kind === "hero" ? HERO.url : (r.context?.url ?? "");
      return title.toLowerCase().includes(q) || url.toLowerCase().includes(q);
    });
  }, [heroPresent, query]);

  const status = heroRefetching
    ? "Fetching title and favicon…"
    : phase === "idle"
      ? "Your library"
      : phase === "saved"
        ? "Saved — just a URL for now"
        : phase === "enriched"
          ? "Title and favicon filled in"
          : phase === "found"
            ? "Found it"
            : phase === "checking"
              ? "Running the weekly link check…"
              : "Flagged a broken link";

  return (
    <div ref={cardRef} className={`${CARD_CLASS} p-3`}>
      <div className="pointer-events-none">
        <BookmarkInput value={query} onChange={setQuery} onSubmit={() => {}} />
      </div>
      <div className="relative mt-2 rounded-xl">
        {/* Invisible sizer: all rows at max content pin the height, so
            mounts/unmounts/filtering never resize the card (font-metric
            differences between browsers made min-h unreliable). */}
        <div aria-hidden className="invisible divide-y divide-border">
          <div>
            <BookmarkListItem
              id={HERO.id}
              title={HERO.title}
              url={HERO.url}
              domain="kreate.gg"
              created_at={HERO.createdAt}
              favicon_url={HERO.favicon}
              brokenStatus="alive"
              httpStatus={null}
              disableContextMenu
              tabIndex={-1}
              showKbdHint={false}
            />
          </div>
          {CONTEXT.map((c) => (
            <div key={c.id}>
              <BookmarkListItem
                id={c.id}
                title={c.title}
                url={c.url}
                domain={new URL(c.url).hostname}
                created_at={c.createdAt}
                favicon_url={c.favicon}
                brokenStatus="alive"
                httpStatus={null}
                disableContextMenu
                tabIndex={-1}
                showKbdHint={false}
              />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 divide-y divide-border">
          <AnimatePresence initial={false} mode="popLayout">
            {rows.map((r, i) => (
              <motion.div
                key={r.key}
                layout
                initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                animate={{
                  opacity: 1,
                  y: 0,
                  filter: "blur(0px)",
                  transition: {
                    delay: Math.min(i * 0.05, 0.2),
                    duration: 0.3,
                    ease: EASE,
                  },
                }}
                exit={{
                  opacity: 0,
                  y: -8,
                  filter: "blur(4px)",
                  transition: { duration: 0.15, ease: "easeIn" },
                }}
              >
                <div className="pointer-events-none">
                  {r.kind === "hero" ? (
                    <BookmarkListItem
                      id={HERO.id}
                      title={heroEnriched ? HERO.title : HERO.url}
                      url={HERO.url}
                      domain="kreate.gg"
                      created_at={HERO.createdAt}
                      favicon_url={heroEnriched ? HERO.favicon : undefined}
                      refetchingId={heroRefetching ? HERO.id : null}
                      brokenStatus="alive"
                      httpStatus={null}
                      disableContextMenu
                      tabIndex={-1}
                      showKbdHint={false}
                    />
                  ) : (
                    <BookmarkListItem
                      id={r.context!.id}
                      title={r.context!.title}
                      url={r.context!.url}
                      domain={new URL(r.context!.url).hostname}
                      created_at={r.context!.createdAt}
                      favicon_url={r.context!.favicon}
                      brokenStatus={
                        r.context!.id === "c-board" && boardBroken
                          ? "confirmed_broken"
                          : "alive"
                      }
                      httpStatus={
                        r.context!.id === "c-board" && boardBroken ? 404 : null
                      }
                      refetchingId={
                        r.context!.id === "c-board" && boardChecking
                          ? r.context!.id
                          : null
                      }
                      disableContextMenu
                      tabIndex={-1}
                      showKbdHint={false}
                    />
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
      <div className="flex h-7 items-center px-1 pt-2">
        <motion.span
          key={status}
          initial={{ opacity: 0, y: 4, filter: "blur(3px)" }}
          animate={{
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            transition: { duration: 0.35, ease: EASE },
          }}
          className="text-xs text-muted-foreground"
        >
          {status}
        </motion.span>
      </div>
    </div>
  );
}
