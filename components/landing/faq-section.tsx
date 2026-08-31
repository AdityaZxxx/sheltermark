"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";

import { Reveal } from "./lib";

const FAQS = [
  {
    question: "Why not just use my browser's bookmarks?",
    answer:
      "Browser bookmarks live in one browser, on one device. Sheltermark is a web app, so the same bookmarks are with you wherever you sign in. You can also add a note and tags to each one, search across all of them, and get a heads-up when a link goes dead.",
  },
  {
    question: "Can I import my existing bookmarks?",
    answer:
      "Yes. Export a bookmarks file from Chrome, Firefox, Edge, or Safari, then upload it to Sheltermark. Review your folders, choose which ones to bring over, and pick the workspace they land in.",
  },
  {
    question: "What happens when I save a bookmark?",
    answer:
      "Sheltermark fetches the page's title, description, favicon, and cover image automatically, so every bookmark looks complete without you filling anything in. For links to YouTube, Spotify, and similar sites, you can preview the content right from your list without opening a new tab. If you use Chrome, the extension saves the page you're on in one click.",
  },
  {
    question: "What happens when a link dies?",
    answer:
      "Sheltermark checks your links on a schedule and flags the ones that disappear or stop responding. Your note and tags stay attached, so you still have the context you saved.",
  },
  {
    question: "Is my collection private?",
    answer:
      "Yes, private by default. A public profile is entirely opt-in — nothing is shared unless you choose to share it.",
  },
  {
    question: "Can I take my bookmarks elsewhere?",
    answer:
      "Yes. Export your bookmarks, notes, and tags to a file that other tools can read. No lock-in.",
  },
];

export function FaqSection() {
  return (
    <section className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid gap-12 md:grid-cols-[1fr_2fr] md:gap-20">
          <Reveal>
            <div>
              <p className="text-xs font-medium tracking-widest text-muted-foreground/80 uppercase">
                FAQ
              </p>

              <h2 className="mt-5 text-3xl leading-tight tracking-tight text-foreground md:text-4xl">
                Questions, answered.
              </h2>

              <p className="mt-4 text-sm leading-7 text-muted-foreground">
                Everything else you'd want to know before signing up.
              </p>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <Accordion className="rounded-2xl">
              {FAQS.map((faq) => (
                <AccordionItem key={faq.question}>
                  <AccordionTrigger className="px-4 py-4 text-sm">
                    {faq.question}
                  </AccordionTrigger>

                  <AccordionContent className="px-4 text-sm leading-7 text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
