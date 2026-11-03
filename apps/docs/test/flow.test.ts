import { describe, expect, it } from "vitest";

import { gap } from "@/lib/doc/flow";
import type { Before, Slot } from "@/lib/doc/flow";

const SLOTS: readonly Slot[] = [
  "actions",
  "code",
  "demo",
  "head",
  "label",
  "p",
  "part",
  "qa",
  "question",
  "table",
];

const DESIGN_GAPS: [Slot, Slot, number][] = [
  ["actions", "actions", 12],
  ["actions", "code", 12],
  ["actions", "demo", 12],
  ["actions", "p", 12],
  ["actions", "part", 40],
  ["actions", "qa", 12],
  ["actions", "question", 12],
  ["actions", "table", 12],
  ["code", "actions", 20],
  ["code", "code", 24],
  ["code", "demo", 24],
  ["code", "p", 20],
  ["code", "part", 40],
  ["code", "qa", 20],
  ["code", "question", 20],
  ["code", "table", 16],
  ["demo", "actions", 20],
  ["demo", "code", 24],
  ["demo", "demo", 24],
  ["demo", "p", 20],
  ["demo", "part", 40],
  ["demo", "qa", 20],
  ["demo", "question", 20],
  ["demo", "table", 24],
  ["head", "actions", 16],
  ["head", "code", 16],
  ["head", "demo", 16],
  ["head", "p", 16],
  ["head", "part", 40],
  ["head", "qa", 16],
  ["head", "question", 16],
  ["head", "table", 16],
  ["label", "actions", 12],
  ["label", "code", 12],
  ["label", "demo", 12],
  ["label", "p", 12],
  ["label", "part", 12],
  ["label", "qa", 12],
  ["label", "question", 12],
  ["label", "table", 12],
  ["p", "actions", 12],
  ["p", "code", 12],
  ["p", "demo", 12],
  ["p", "p", 12],
  ["p", "part", 40],
  ["p", "qa", 12],
  ["p", "question", 12],
  ["p", "table", 12],
  ["part", "actions", 12],
  ["part", "code", 12],
  ["part", "demo", 12],
  ["part", "p", 12],
  ["part", "part", 40],
  ["part", "qa", 12],
  ["part", "question", 12],
  ["part", "table", 12],
  ["qa", "actions", 12],
  ["qa", "code", 12],
  ["qa", "demo", 12],
  ["qa", "p", 12],
  ["qa", "part", 40],
  ["qa", "qa", 28],
  ["qa", "question", 12],
  ["qa", "table", 12],
  ["question", "actions", 12],
  ["question", "code", 12],
  ["question", "demo", 12],
  ["question", "p", 12],
  ["question", "part", 40],
  ["question", "qa", 12],
  ["question", "question", 12],
  ["question", "table", 12],
  ["table", "actions", 20],
  ["table", "code", 24],
  ["table", "demo", 24],
  ["table", "p", 20],
  ["table", "part", 40],
  ["table", "qa", 20],
  ["table", "question", 20],
  ["table", "table", 16],
];

const ANSWER_GAPS: [Before, Slot, number][] = SLOTS.flatMap(
  (after): [Before, Slot, number][] => [
    ["answer", after, after === "code" ? 12 : 4],
    [null, after, 0],
  ]
);

describe("flow", () => {
  it.each(DESIGN_GAPS)(
    "puts %s before %s %ipx apart, as the design does",
    (before, after, px) => {
      expect(gap(before, after)).toBe(px);
    }
  );

  it.each(ANSWER_GAPS)(
    "puts %s before %s %ipx apart inside an answer or at the start",
    (before, after, px) => {
      expect(gap(before, after)).toBe(px);
    }
  );
});
