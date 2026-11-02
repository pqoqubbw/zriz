import { describe, expect, it } from "vitest";

import { cn } from "@/lib/cn";

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
});
