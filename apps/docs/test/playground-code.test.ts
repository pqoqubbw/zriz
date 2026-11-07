import { readFileSync } from "node:fs";

import { createCropper } from "@zriz/core";
import { describe, expect, it } from "vitest";

import { PLAYGROUND_PAGE } from "@/content/playground";
import {
  codeHtml,
  codeText,
  jsonHtml,
  jsonText,
} from "@/demos/playground/code";
import { DEFAULT_KNOBS, KNOB_CHOICES } from "@/demos/playground/store";
import type { Knobs } from "@/demos/playground/store";
import { walkBlocks } from "@/lib/doc/anchors";
import { highlight } from "@/lib/doc/highlight";
import { pageMarkdown } from "@/lib/doc/markdown";
import { textOf } from "@/lib/doc/snippets";

const SNIPPET = "playground/root.jsx.tsx";

const DEFAULT_VALUE = createCropper().getValue();

const COMBOS: readonly Partial<Knobs>[] = [
  {},
  { shape: "circle" },
  { motion: "reduce" },
  { dir: "rtl" },
  { maxZoom: 3 },
  { recenterDelay: 1250 },
  { disabled: true },
  { wheel: "zoom" },
  { rotateGesture: false, wheel: "none" },
  { vertical: -12 },
  { horizontal: 30, vertical: 4 },
  {
    dir: "rtl",
    disabled: true,
    horizontal: -30,
    maxZoom: 1,
    motion: "always",
    recenterDelay: 0,
    rotateGesture: false,
    shape: "circle",
    vertical: -30,
    wheel: "zoom",
  },
];

const VALUES: readonly unknown[] = [
  DEFAULT_VALUE,
  {
    ...DEFAULT_VALUE,
    aspect: 0.8,
    center: { x: 0.4812, y: 0.5 },
    mirrored: true,
    perspective: { horizontal: -12, vertical: 3 },
    quarterTurns: 3,
    rotation: -44.5,
    size: { height: 0.0012, width: 1e-7 },
  },
  { ...DEFAULT_VALUE, aspect: "original" },
];

const withKnobs = (patch: Partial<Knobs>): Knobs => ({
  ...DEFAULT_KNOBS,
  ...patch,
});

const HIGHLIGHTED = [
  ...COMBOS.map((patch) => ({
    file: SNIPPET,
    html: codeHtml(withKnobs(patch)),
    shown: patch,
    text: codeText(withKnobs(patch)),
  })),
  ...VALUES.map((value) => ({
    file: "playground/value.json",
    html: jsonHtml(jsonText(value)),
    shown: value,
    text: jsonText(value),
  })),
];

describe("playground code", () => {
  it("starts the code and value panels as the snippet files", () => {
    const shown = readFileSync("snippets/playground/value.json", "utf-8");

    expect(codeText(DEFAULT_KNOBS)).toBe(
      textOf({ file: SNIPPET, kind: "code" })
    );

    expect(shown.trimEnd()).toBe(jsonText(DEFAULT_VALUE));
  });

  it.each(HIGHLIGHTED)(
    "highlights $file for $shown the way the server does",
    async ({ file, html, text }) => {
      await expect(highlight(text, file)).resolves.toBe(html);
    }
  );

  it("gives the page controls the knobs' defaults and options, bound to the playground", () => {
    const blocks = walkBlocks(PLAYGROUND_PAGE.blocks);
    const controls = blocks.flatMap((block) =>
      block.kind === "controls" ? block.controls : []
    );
    const shown = Object.fromEntries(
      controls.map((control) => [
        control.name,
        control.type === "switch" ? control.on : control.value,
      ])
    );
    const options = Object.fromEntries(
      controls.flatMap((control) =>
        control.type === "choice" ? [[control.name, control.options]] : []
      )
    );
    const unbound = blocks.filter(
      (block) =>
        (block.kind === "controls" || block.kind === "log") &&
        block.bind !== "playground"
    );

    expect(shown).toStrictEqual(DEFAULT_KNOBS);
    expect(options).toStrictEqual(KNOB_CHOICES);
    expect(unbound).toStrictEqual([]);
  });

  it("writes the starting code and value into the markdown", () => {
    const markdown = pageMarkdown("playground");

    expect(markdown).toContain(textOf({ file: SNIPPET, kind: "code" }));
    expect(markdown).toContain(jsonText(DEFAULT_VALUE));
  });
});
