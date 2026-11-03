import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { CN_THEME, cn } from "@/lib/cn";

const THEME_TOKEN =
  /^\s*--(?<group>font-weight|inset-shadow|radius|shadow|text)-(?<name>[a-z0-9-]+):/gmu;

const themeNames = (): Record<string, string[]> => {
  const css = readFileSync("app/globals.css", "utf-8");
  const start = css.indexOf("@theme {");
  const block = css.slice(start, css.indexOf("\n}", start));
  const names: Record<string, string[]> = {};

  for (const match of block.matchAll(THEME_TOKEN)) {
    const { group = "", name = "" } = match.groups ?? {};

    if (!name.includes("--")) {
      names[group] = [...(names[group] ?? []), name];
    }
  }

  return names;
};

const sorted = (list: readonly string[] = []): string[] => list.toSorted();

describe(cn, () => {
  it.each([
    ["text-cell text-soft", "text-cell text-soft"],
    ["text-code text-code-ink", "text-code text-code-ink"],
    ["text-nav text-muted", "text-nav text-muted"],
    ["font-mono font-strong", "font-mono font-strong"],
    [
      "font-mono font-semibold text-heading-mono",
      "font-mono font-semibold text-heading-mono",
    ],
    ["rounded-panel bg-surface", "rounded-panel bg-surface"],
    ["shadow-raised inset-shadow-rule", "shadow-raised inset-shadow-rule"],
    ["text-muted text-ink", "text-ink"],
    ["text-body text-cell", "text-cell"],
    ["mt-3 mt-6", "mt-6"],
  ])("keeps the theme tokens apart in %s", (input, output) => {
    expect(cn(input)).toBe(output);
  });

  it("knows every token in the theme", () => {
    const names = themeNames();

    expect(
      Object.fromEntries(
        Object.entries(CN_THEME).map(([group, list]) => [group, sorted(list)])
      )
    ).toStrictEqual(
      Object.fromEntries(
        Object.keys(CN_THEME).map((group) => [group, sorted(names[group])])
      )
    );
  });
});
