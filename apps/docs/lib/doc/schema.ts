import type { DemoName } from "@/demos/registry";

export type Chord = readonly string[];

export interface Column {
  align?: "end";
  fill?: boolean;
  kind: "mono" | "prose";
  label: string;
  width?: number;
}

export interface PropRow {
  default?: string;
  name: string;
  required?: boolean;
  text: string;
  type?: string;
}

export interface NamedRow {
  name: string;
  text: string;
}

export interface KeyRow {
  keys: readonly Chord[];
  text: string;
}

export interface MessageRow {
  fix: string;
  message: string;
}

export interface LogLine {
  event: string;
  time: string;
}

export type Control =
  | { name: string; options: readonly string[]; type: "choice"; value: string }
  | { name: string; on: boolean; type: "switch" }
  | {
      max: number;
      min: number;
      name: string;
      step: number;
      type: "range";
      unit: string;
      value: number;
    };

export interface BlockMap {
  actions: { action: "copy-value" | "download"; label: string };
  attrs: { rows: readonly NamedRow[] };
  caption: { text: string };
  code: { file: string };
  controls: { controls: readonly Control[] };
  demo: { name: DemoName; space?: 40 | 48 | 56 };
  excerpt: {
    file: string;
    ranges: readonly (readonly [string, string | null])[];
  };
  intro: { blocks: readonly Block[] };
  keys: { rows: readonly KeyRow[] };
  list: { items: readonly string[] };
  log: { lines: readonly LogLine[] };
  messages: { label: string; rows: readonly MessageRow[] };
  p: { text: string };
  part: { blocks: readonly Block[]; name: string; text: string };
  prompt: { text: string };
  props: { label: string; rows: readonly PropRow[] };
  qa: { blocks: readonly Block[]; question: string };
  section: { blocks: readonly Block[]; title: string };
  sub: { text: string };
  table: {
    columns: readonly Column[];
    fix?: string;
    rows: readonly (readonly string[])[];
  };
  variables: { rows: readonly NamedRow[] };
}

export type Kind = keyof BlockMap;

export type BlockOf<K extends Kind> = {
  [P in K]: BlockMap[P] & { kind: P };
}[K];

export type Block = BlockOf<Kind>;

export interface Doc {
  blocks: readonly Block[];
  lede: string;
}

export const heads = {
  attrs: ["attribute", "when"],
  keys: ["key", "what it does"],
  variables: ["variable", "what it sets"],
} as const satisfies Record<string, readonly [string, string]>;

export const isArrows = (name: string): boolean =>
  name === "arrow" || name === "arrows" || name === "arrow keys";

const pairs: Record<string, string> = {
  "(": ")",
  "<": ">",
  "[": "]",
  "{": "}",
};

export const typeTokens = (type: string, commas = false): string[] => {
  const tokens: string[] = [];
  const open: string[] = [];
  let current = "";
  for (let i = 0; i < type.length; i += 1) {
    const char = type.charAt(i);
    const closing = pairs[char];
    if (closing !== undefined) {
      open.push(closing);
    } else if (char === open.at(-1)) {
      open.pop();
    }
    if (open.length === 0 && type.startsWith(" | ", i)) {
      tokens.push(current);
      current = "|";
      i += 1;
    } else if (commas && open.length === 0 && type.startsWith(", ", i)) {
      tokens.push(`${current},`);
      current = "";
      i += 1;
    } else {
      current += char;
    }
  }
  tokens.push(current);
  return tokens;
};
