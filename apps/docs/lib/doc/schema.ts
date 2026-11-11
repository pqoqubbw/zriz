import type { DemoName } from "@/demos/registry";
import type { RegistryName } from "@/lib/registry";

type Chord = readonly string[];

type Column = {
  align?: "end";
  fill?: boolean;
  kind: "mono" | "prose";
  label: string;
  width?: number;
};

type PropRow = {
  default?: string;
  name: string;
  required?: boolean;
  text: string;
  type?: string;
};

type NamedRow = {
  name: string;
  text: string;
};

type KeyRow = {
  keys: readonly Chord[];
  text: string;
};

type MessageRow = {
  fix: string;
  message: string;
};

type LogLine = {
  event: string;
  time: string;
};

type Control =
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

type DemoSpace = 40 | 48 | 56;

type Bind = "playground";

type LiveFeed = "code" | "value";

type BlockMap = {
  attrs: { rows: readonly NamedRow[] };
  caption: { text: string };
  code: { file: string };
  controls: { bind?: Bind; controls: readonly Control[] };
  demo: { name: DemoName; space?: DemoSpace };
  excerpt: {
    file: string;
    ranges: readonly (readonly [string, string | null])[];
  };
  intro: { blocks: readonly Block[] };
  keys: { rows: readonly KeyRow[] };
  liveCode: { feed: LiveFeed; file: string };
  log: { bind?: Bind; lines: readonly LogLine[] };
  messages: { label: string; rows: readonly MessageRow[] };
  p: { text: string };
  part: { blocks: readonly Block[]; name: string; text: string };
  preview: { name: RegistryName };
  prompt: { text: string };
  props: { label: string; rows: readonly PropRow[] };
  qa: { blocks: readonly Block[]; question: string };
  section: { blocks: readonly Block[]; title: string };
  table: {
    columns: readonly Column[];
    fix?: string;
    rows: readonly (readonly string[])[];
  };
  variables: { rows: readonly NamedRow[] };
};

type Kind = keyof BlockMap;

type BlockOf<K extends Kind> = {
  [P in K]: BlockMap[P] & { kind: P };
}[K];

type Block = BlockOf<Kind>;

type Doc = {
  blocks: readonly Block[];
  lede: string;
};

const TABLE_HEADS = {
  attrs: ["Attribute", "When"],
  keys: ["Key", "What it does"],
  variables: ["Variable", "What it sets"],
} as const satisfies Record<string, readonly [string, string]>;

export type {
  Bind,
  Block,
  BlockMap,
  BlockOf,
  Chord,
  Column,
  Control,
  DemoSpace,
  Doc,
  KeyRow,
  Kind,
  LiveFeed,
  LogLine,
  MessageRow,
  NamedRow,
  PropRow,
};
export { TABLE_HEADS };
