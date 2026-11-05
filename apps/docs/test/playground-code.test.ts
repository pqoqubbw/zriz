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

describe("playground code", () => {
  it("starts as the snippet on the page", () => {
    expect(codeText(DEFAULT_KNOBS)).toBe(
      textOf({ file: SNIPPET, kind: "code" })
    );
  });

  it.each(COMBOS)("highlights %o the way the server does", async (patch) => {
    const knobs = withKnobs(patch);
    const text = codeText(knobs);

    await expect(highlight(text, SNIPPET)).resolves.toBe(codeHtml(knobs));
  });

  it("adds one prop per changed knob", () => {
    const base = codeText(DEFAULT_KNOBS);

    expect(codeText(withKnobs({ maxZoom: 4 }))).toContain("maxZoom={4}");

    expect(codeText(withKnobs({ wheel: "zoom" }))).toContain('wheel="zoom"');

    expect(codeText(withKnobs({ vertical: 5 }))).toContain(
      "defaultValue={{ perspective: { vertical: 5, horizontal: 0 } }}"
    );

    expect(codeText(withKnobs({ disabled: true })).split("\n")).toContain(
      "<Cropper.Root src={photo} disabled>"
    );

    expect(base).not.toContain("maxZoom");
  });

  it("keeps every line inside the snippet width", () => {
    const widest = Math.max(
      ...COMBOS.flatMap((patch) =>
        codeText(withKnobs(patch))
          .split("\n")
          .map((line) => line.length)
      )
    );

    expect(widest).toBeLessThanOrEqual(64);
  });

  it.each(VALUES)(
    "highlights the value %o the way the server does",
    async (value) => {
      const text = jsonText(value);

      await expect(highlight(text, "playground/value.json")).resolves.toBe(
        jsonHtml(text)
      );
    }
  );

  it("starts the value panel at the default value", () => {
    const shown = readFileSync("snippets/playground/value.json", "utf-8");

    expect(shown.trimEnd()).toBe(jsonText(DEFAULT_VALUE));
  });

  it("gives the page controls the knobs' defaults and options", () => {
    const controls = walkBlocks(PLAYGROUND_PAGE.blocks).flatMap((block) =>
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

    expect(shown).toStrictEqual(DEFAULT_KNOBS);

    expect(options).toStrictEqual(KNOB_CHOICES);
  });

  it("binds every live block on the page to the playground", () => {
    const bound = walkBlocks(PLAYGROUND_PAGE.blocks).filter(
      (block) =>
        (block.kind === "controls" ||
          block.kind === "log" ||
          (block.kind === "actions" && block.action !== "copy-code")) &&
        block.bind !== "playground"
    );

    expect(bound).toStrictEqual([]);
  });

  it("writes the starting code and value into the markdown", () => {
    const markdown = pageMarkdown("playground");

    expect(markdown).toContain(textOf({ file: SNIPPET, kind: "code" }));

    expect(markdown).toContain(jsonText(DEFAULT_VALUE));

    expect(markdown).toContain(
      "/docs/playground runs this cropper: a 3:2 photo"
    );
  });
});
