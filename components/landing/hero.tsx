"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { motion, type Variants } from "motion/react";
import Link from "next/link";

import { usePrefersReducedMotion } from "./lib";
import { StoryDemo } from "./story-demo";

const EASE = [0.2, 0, 0, 1] as const;

const container: Variants = {
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: 0.6, ease: EASE },
  },
};

export function Hero() {
  const reduce = usePrefersReducedMotion();

  const containerVariants: Variants = reduce ? { visible: {} } : container;
  const itemVariants: Variants = reduce
    ? {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
      }
    : item;

  return (
    <section className="mx-auto max-w-6xl px-6 pb-24 pt-20">
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
      >
        <div className="mx-auto max-w-2xl text-center">
          <motion.div variants={itemVariants}>
            <h1 className="text-4xl leading-[1.1] tracking-tighter text-balance md:text-5xl">
              A quiet place for your bookmarks.
            </h1>
          </motion.div>
          <motion.div variants={itemVariants}>
            <p className="mx-auto mt-5 max-w-[46ch] text-base leading-relaxed text-pretty text-muted-foreground">
              Save a link and Sheltermark files it, fills in the details, and
              keeps it healthy — searchable on every device.
            </p>
          </motion.div>
          <motion.div variants={itemVariants}>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.96]"
              >
                Get started
                <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          </motion.div>
        </div>
        <motion.div variants={itemVariants}>
          <div className="mx-auto mt-14 max-w-xl">
            <StoryDemo />
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
