import type { Kind } from "@/lib/doc/schema";

export type Slot =
  | "actions"
  | "code"
  | "demo"
  | "head"
  | "label"
  | "list"
  | "p"
  | "part"
  | "qa"
  | "question"
  | "table";

export const slotOf = {
  actions: "actions",
  attrs: "table",
  caption: "question",
  code: "code",
  controls: "table",
  demo: "demo",
  excerpt: "code",
  intro: "p",
  keys: "table",
  list: "list",
  log: "code",
  messages: "table",
  p: "p",
  part: "part",
  prompt: "code",
  props: "table",
  qa: "qa",
  section: "p",
  sub: "question",
  table: "table",
  variables: "table",
} as const satisfies Record<Kind, Slot>;

const objects = new Set<Slot>(["code", "demo", "table"]);

export const gap = (before: Slot, after: Slot): keyof typeof classes => {
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
  if (objects.has(before)) {
    return objects.has(after) ? 24 : 20;
  }
  return 12;
};

const classes = {
  12: "mt-3",
  16: "mt-4",
  20: "mt-5",
  24: "mt-6",
  28: "mt-7",
  40: "mt-10",
} as const;

export const gapClass = (before: Slot, after: Slot): string =>
  classes[gap(before, after)];
