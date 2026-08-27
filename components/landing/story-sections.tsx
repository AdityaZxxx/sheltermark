"use client";

import { MagnifyingGlassIcon, WarningIcon } from "@phosphor-icons/react";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";

import {
  DEMO_STORY_HEALTH_ROWS,
  DEMO_STORY_HERO,
  DEMO_WORKSPACES,
  getBookmarkTags,
  getDemoBookmark,
} from "~/lib/demo-data";
import { cn, getPastelColor } from "~/lib/utils";

import { Reveal, useInView, usePrefersReducedMotion } from "./lib";

function SearchVisual() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [typed, setTyped] = useState("");
  const query = reduce || !inView ? "kreate" : typed;

  useEffect(() => {
    if (reduce || !inView) {
      return;
    }

    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const run = async () => {
      setTyped("");

      for (const char of "kreate") {
        if (cancelled) return;

        await new Promise<void>((resolve) => {
          timeout = setTimeout(resolve, 90);
        });

        setTyped((value) => value + char);
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [inView, reduce]);

  return (
    <div ref={ref} className="w-full max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <MagnifyingGlassIcon
            className="size-4 shrink-0 text-muted-foreground"
            weight="bold"
          />

          <span className="text-sm text-foreground">{query}</span>
        </div>

        <motion.div
          initial={false}
          animate={{
            opacity: query.length === 6 ? 1 : 0.35,
            y: query.length === 6 ? 0 : 3,
          }}
          transition={{ duration: 0.25 }}
          className="px-4 py-4"
        >
          <div className="flex items-center gap-3">
            {/* oxlint-disable-next-line next/no-img-element -- demo favicon */}
            <img
              src={DEMO_STORY_HERO.favicon}
              alt=""
              className="size-7 shrink-0 object-contain"
            />

            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {DEMO_STORY_HERO.title}
              </p>

              <p className="mt-1 text-xs text-muted-foreground">
                kreate.gg · 58m ago · #support
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Search the things you remember — not just the URL.
      </p>
    </div>
  );
}

function ContextVisual() {
  const workspace = DEMO_WORKSPACES.find((item) => item.id === "work")!;
  const bookmark = getDemoBookmark("w1");
  const tags = getBookmarkTags("w1");

  return (
    <div className="w-full max-w-xl">
      <div className="relative px-2 py-3">
        {/* vertical spine */}
        <div
          aria-hidden
          className="absolute top-5 bottom-5 left-3 w-px bg-border"
        />

        <div className="relative flex items-start gap-4">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground ring-4 ring-background" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              {/* oxlint-disable-next-line next/no-img-element -- demo favicon */}
              <img
                src={bookmark.favicon_url ?? ""}
                alt=""
                className="size-4 shrink-0 object-contain rounded-xs"
              />

              <p className="truncate text-sm font-medium text-foreground">
                {bookmark.title}
              </p>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="relative mt-7 flex items-start gap-4">
          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-muted-foreground/60 ring-4 ring-background" />

          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">
              Your note
            </p>
            <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground italic">
              “{bookmark.note}”
            </p>
          </div>
        </div>

        <div className="relative mt-7 flex items-start gap-4">
          <span
            className="mt-1.5 size-2 shrink-0 rounded-full ring-4 ring-background"
            style={{ backgroundColor: getPastelColor(workspace.id) }}
          />

          <div>
            <p className="text-xs font-medium text-muted-foreground">
              {workspace.name}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              where this bookmark belongs
            </p>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The reason you saved it stays attached to the link.
      </p>
    </div>
  );
}

function HealthVisual() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (reduce || !inView) {
      return;
    }

    const timeout = setTimeout(() => setChecked(true), 900);

    return () => clearTimeout(timeout);
  }, [inView, reduce]);

  const showBroken = reduce || checked;

  return (
    <div ref={ref} className="w-full max-w-xl">
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {DEMO_STORY_HEALTH_ROWS.map((row) => {
          const broken = row.broken && showBroken;

          return (
            <motion.div
              key={row.id}
              animate={{
                backgroundColor: broken
                  ? "rgba(127, 29, 29, 0.16)"
                  : "rgba(0, 0, 0, 0)",
              }}
              transition={{ duration: 0.4 }}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* oxlint-disable-next-line next/no-img-element -- demo favicon */}
              <img
                src={row.favicon ?? ""}
                alt=""
                className="size-4 shrink-0 object-contain rounded-xs"
              />

              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {row.domain}
              </span>

              {row.broken ? (
                <motion.span
                  initial={false}
                  animate={{
                    opacity: broken ? 1 : 0,
                    scale: broken ? 1 : 0.7,
                  }}
                  transition={{ duration: 0.25 }}
                  className="flex size-4 shrink-0 items-center justify-center text-destructive"
                >
                  <WarningIcon className="size-3.5" weight="fill" />
                </motion.span>
              ) : null}
            </motion.div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        The web changes. Sheltermark checks so your collection doesn't silently
        decay.
      </p>
    </div>
  );
}

const PROFESSIONS = [
  "Developer",
  "Student",
  "Researcher",
  "Designer",
  "Writer",
  "Journalist",
  "Product Manager",
  "Data Scientist",
  "Academic",
  "Recruiter",
  "Analyst",
  "Teacher",
];

function ProfessionsMarquee() {
  return (
    <div
      aria-hidden
      className="overflow-hidden border-t border-border py-4 [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
    >
      <div className="animate-marquee flex w-max">
        {[...PROFESSIONS, ...PROFESSIONS].map((profession, i) => (
          <span
            key={i}
            className="flex items-center text-xs tracking-widest text-muted-foreground/80 uppercase"
          >
            {profession}
            <span className="mx-8 size-1 rounded-full bg-border" />
          </span>
        ))}
      </div>
    </div>
  );
}

function Feature({
  number,
  eyebrow,
  heading,
  body,
  visual,
  reversed = false,
}: {
  number: string;
  eyebrow: string;
  heading: string;
  body: string;
  visual: React.ReactNode;
  reversed?: boolean;
}) {
  return (
    <article
      className={cn(
        "grid items-center gap-10 border-t border-border py-16 md:grid-cols-2 md:gap-20 md:py-24",
        reversed && "md:[&>*:first-child]:order-2",
      )}
    >
      <Reveal>
        <div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground/80">
            <span>{number}</span>
            <span className="h-px w-8 bg-border" />
            <span className="uppercase tracking-widest">{eyebrow}</span>
          </div>

          <h3 className="mt-5 max-w-md text-2xl leading-tight tracking-tight text-foreground md:text-3xl">
            {heading}
          </h3>

          <p className="mt-4 max-w-md text-sm leading-7 text-muted-foreground md:text-base">
            {body}
          </p>
        </div>
      </Reveal>

      <Reveal delay={120}>
        <div>{visual}</div>
      </Reveal>
    </article>
  );
}

export function StorySections() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6">
        <header className="max-w-3xl py-24 md:py-32">
          <Reveal>
            <p className="text-xs font-medium tracking-widest text-muted-foreground/80 uppercase">
              More than a bookmark
            </p>
          </Reveal>

          <Reveal delay={90}>
            <h2 className="mt-5 text-3xl leading-tight tracking-tight text-foreground md:text-5xl">
              Keep the link.
              <br />
              Keep everything around it.
            </h2>
          </Reveal>

          <Reveal delay={180}>
            <p className="mt-6 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
              A URL tells you where something was. Sheltermark keeps why you
              saved it, helps you find it again, and tells you when it stops
              working.
            </p>
          </Reveal>
        </header>

        <ProfessionsMarquee />

        <div>
          <Feature
            number="01"
            eyebrow="Find"
            heading="Remember the thing. We'll find the link."
            body="Search reaches across titles, notes, tags, and URLs. You don't need to remember where you put something to get it back."
            visual={<SearchVisual />}
          />

          <Feature
            number="02"
            eyebrow="Context"
            heading="A link is more useful when it remembers why."
            body="Notes, tags, and workspaces stay attached to the bookmark, so the context survives long after the tab is gone."
            visual={<ContextVisual />}
            reversed
          />

          <Feature
            number="03"
            eyebrow="Health"
            heading="Your collection shouldn't quietly rot."
            body="Sheltermark checks your saved links regularly and flags the ones that disappear, move, or stop responding."
            visual={<HealthVisual />}
          />
        </div>
      </div>
    </section>
  );
}
