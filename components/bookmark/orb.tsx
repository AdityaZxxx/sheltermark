import type { CSSProperties } from "react";

import styles from "./orb.module.css";

/** The stage the geometry is tuned on; --orb-k scales it to `size`. */
const STAGE = 28;

/** Default rendered size — 20×20 indicator box. */
const SIZE = 20;

type LatticeVariant = "S5";
type OrbVariant = LatticeVariant;

const ORB_TASKS = { S5: "Finalizing" } satisfies Record<OrbVariant, string>;

const N = 3; // lattice is N×N
const PITCH = 6; // centre-to-centre spacing in stage px; the dot size is CSS
const MID = (N - 1) / 2;
const ORBIT_DURATION = 1700; // ms, must match the orb-comet duration

/** Clockwise walk of the lattice perimeter — the track the pulse runs on. */
const RING: [number, number][] = (() => {
  const ring: [number, number][] = [];
  for (let x = 0; x < N; x++) ring.push([x, 0]);
  for (let y = 1; y < N; y++) ring.push([N - 1, y]);
  for (let x = N - 2; x >= 0; x--) ring.push([x, N - 1]);
  for (let y = N - 2; y >= 1; y--) ring.push([0, y]);
  return ring;
})();

const RING_INDEX = new Map(RING.map(([x, y], i) => [x + "," + y, i]));

/**
 * Per-cell `animation-delay` in ms. Negative values seed a cell partway
 * into its cycle; the scrambled ring order turns 8 identical animations
 * into one pulse that jumps pseudo-randomly around the perimeter.
 */
function cellDelay(x: number, y: number): number {
  const i = RING_INDEX.get(x + "," + y);
  if (i === undefined) return 0;
  const scrambled = (i * 3) % RING.length;
  return -(scrambled / RING.length) * ORBIT_DURATION;
}

const SWIRL = 1.05; // radians of rotation at each end, ~60°
const SPREAD = 1.6; // outward push, on top of the rotation

/** Offset from a cell's own grid slot to its swirled position, in stage px. */
function swirl(x: number, y: number, angle: number): [number, number] {
  const dx = x - MID;
  const dy = y - MID;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return [
    ((dx * cos - dy * sin) * SPREAD - dx) * PITCH,
    ((dx * sin + dy * cos) * SPREAD - dy) * PITCH,
  ];
}

interface Cell {
  key: string;
  left: number;
  top: number;
  delay: number;
  /** Where `settle` gathers this cell from, and releases it to. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Sits out the choreography (the centre cell). */
  still: boolean;
  /** Centre cell — the static frame under reduced motion. */
  mid: boolean;
}

/** The 9 lattice cells, with position, phase and swirl vectors. Constant. */
const CELLS: Cell[] = (() => {
  const cells: Cell[] = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const [ax, ay] = swirl(x, y, -SWIRL);
      const [bx, by] = swirl(x, y, SWIRL);
      cells.push({
        key: x + "," + y,
        left: x * PITCH,
        top: y * PITCH,
        delay: cellDelay(x, y),
        ax,
        ay,
        bx,
        by,
        still: !RING_INDEX.has(x + "," + y),
        mid: x === MID && y === MID,
      });
    }
  }
  return cells;
})();

interface OrbProps {
  variant?: OrbVariant;
  /** Rendered edge length in px. The 28px geometry scales to fit. */
  size?: number;
  /** Accessible label, and the status text when `pill` is set. */
  label?: string;
  /** Wraps the orb and its label in a status pill. */
  pill?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function Orb({
  variant = "S5",
  size = SIZE,
  label,
  pill,
  className,
  style,
}: OrbProps) {
  const text = label ?? ORB_TASKS[variant] + "…";
  return (
    <span
      className={styles.root + (className ? " " + className : "")}
      data-pill={pill ? "" : undefined}
      style={style}
    >
      <span
        className={styles.glyph}
        // In pill form the visible label already carries the meaning, so
        // the glyph steps out of the accessibility tree.
        role={pill ? undefined : "img"}
        aria-label={pill ? undefined : text}
        aria-hidden={pill ? true : undefined}
        // SAFETY: the only untyped member is the custom `--orb-k` property;
        // all other fields are checked against CSSProperties.
        style={
          {
            width: size,
            height: size,
            "--orb-k": size / STAGE,
          } as CSSProperties
        }
      >
        <span className={styles.lattice} data-variant={variant}>
          {CELLS.map((c) => (
            <span
              key={c.key}
              className={styles.cell}
              data-still={c.still ? "" : undefined}
              data-mid={c.mid ? "" : undefined}
              // SAFETY: the only untyped members are custom `--orb-*`
              // properties; all other fields are checked against
              // CSSProperties.
              style={
                {
                  left: c.left,
                  top: c.top,
                  animationDelay: c.delay + "ms",
                  "--orb-ax": c.ax + "px",
                  "--orb-ay": c.ay + "px",
                  "--orb-bx": c.bx + "px",
                  "--orb-by": c.by + "px",
                } as CSSProperties
              }
            />
          ))}
        </span>
      </span>
      {pill && <span className={styles.pillLabel}>{text}</span>}
    </span>
  );
}
