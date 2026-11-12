"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Stroke = {
  d: string;
  ms: number;
};

type Box = {
  height: number;
  width: number;
};

type StarNudgeProps = {
  children: ReactNode;
};

const START_MS = 1100;
const STAR_GAP = 18;
const STAR_POINTS = 11;

const noop = (): void => undefined;

const fixed = (value: number): string => value.toFixed(1);

const underline = ({ height, width }: Box): Stroke => ({
  d: `M-2 ${height + 1.5}C${fixed(width * 0.3)} ${height} ${fixed(width * 0.62)} ${height + 3.6} ${width + 3} ${height + 1}`,
  ms: 300,
});

const star = ({ height, width }: Box): Stroke => ({
  d: Array.from({ length: STAR_POINTS }, (_, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI) / 5 + 0.08;
    const radius = (index % 2 === 0 ? 8 : 3.5) + 0.5 * Math.sin(index * 2.3);
    const x = width + STAR_GAP + radius * Math.cos(angle);
    const y = height / 2 + radius * Math.sin(angle);

    return `${index === 0 ? "M" : "L"}${fixed(x)} ${fixed(y)}`;
  }).join(""),
  ms: 520,
});

const draw = (svg: SVGSVGElement, strokes: readonly Stroke[]): void => {
  let delay = START_MS;

  for (const [index, path] of [...svg.querySelectorAll("path")].entries()) {
    const ms = strokes[index]?.ms ?? 0;

    path.animate(
      [
        { opacity: 0, strokeDashoffset: 1 },
        { offset: 0.02, opacity: 1, strokeDashoffset: 0.98 },
        { opacity: 1, strokeDashoffset: 0 },
      ],
      { delay, duration: ms, easing: "ease-in-out", fill: "both" }
    );

    delay += ms + 30;
  }
};

const StarNudge = ({ children }: StarNudgeProps) => {
  const holder = useRef<HTMLSpanElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const [box, setBox] = useState<Box | null>(null);
  const strokes = box === null ? [] : [underline(box), star(box)];

  useEffect(() => {
    const element = holder.current;

    if (
      element === null ||
      matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return noop;
    }

    const observer = new ResizeObserver(() => {
      const { height, width } = element.getBoundingClientRect();

      if (width > 0) {
        observer.disconnect();
        setBox({ height, width });
      }
    });

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    if (svg.current !== null && box !== null) {
      draw(svg.current, [underline(box), star(box)]);
    }
  }, [box]);

  return (
    <span className="relative flex items-center gap-2" ref={holder}>
      {children}
      {box !== null && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 overflow-visible fill-none text-ink"
          height={box.height}
          ref={svg}
          width={box.width}
        >
          {strokes.map(({ d }) => (
            <path
              d={d}
              key={d}
              opacity={0}
              pathLength={1}
              stroke="currentColor"
              strokeDasharray={1}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.4}
            />
          ))}
        </svg>
      )}
    </span>
  );
};

export { StarNudge };
