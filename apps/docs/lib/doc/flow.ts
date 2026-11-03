import type { Kind } from "@/lib/doc/schema";

type Slot =
  | "actions"
  | "code"
  | "demo"
  | "head"
  | "label"
  | "p"
  | "part"
  | "qa"
  | "question"
  | "table";

type Before = Slot | "answer" | null;

type Gap = 0 | 4 | 12 | 16 | 20 | 24 | 28 | 40;

const BLOCK_SLOTS = {
  actions: "actions",
  attrs: "table",
  caption: "question",
  code: "code",
  controls: "table",
  demo: "demo",
  excerpt: "code",
  intro: "p",
  keys: "table",
  log: "code",
  messages: "table",
  p: "p",
  part: "part",
  prompt: "code",
  props: "table",
  qa: "qa",
  section: "p",
  table: "table",
  variables: "table",
} as const satisfies Record<Kind, Slot>;

const OBJECT_SLOTS = new Set<Slot>(["code", "demo", "table"]);

const gap = (before: Before, after: Slot): Gap => {
  if (before === null) {
    return 0;
  }

  if (before === "answer") {
    return after === "code" ? 12 : 4;
  }

  if (before === "label") {
    return 12;
  }

  if (after === "part") {
    return 40;
  }

  if (before === "head") {
    return 16;
  }

  if (before === "qa" && after === "qa") {
    return 28;
  }

  if (after === "table" && (before === "table" || before === "code")) {
    return 16;
  }

  if (OBJECT_SLOTS.has(before)) {
    return OBJECT_SLOTS.has(after) ? 24 : 20;
  }

  return 12;
};

export type { Before, Gap, Slot };
export { BLOCK_SLOTS, gap };
