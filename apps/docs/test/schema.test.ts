import { describe, expect, it } from "vitest";

import { typeTokens } from "@/lib/doc/schema";

describe(typeTokens, () => {
  it.each([
    ["0 | 1 | 2 | 3", false, ["0", "| 1", "| 2", "| 3"]],
    ["(value, details) => void", false, ["(value, details) => void"]],
    ["{ width: 1, height: 1 }", false, ["{ width: 1, height: 1 }"]],
    ['"rect" | "circle"', false, ['"rect"', '| "circle"']],
    ["#f7f7f7eb, #000000c7", true, ["#f7f7f7eb,", "#000000c7"]],
    ["(a: 1 | 2) => void | null", false, ["(a: 1 | 2) => void", "| null"]],
  ])("splits %s at the top level only", (type, commas, tokens) => {
    expect(typeTokens(type, commas)).toStrictEqual(tokens);
  });
});
