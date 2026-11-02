import type { DemoName } from "@/demos/registry";
import type {
  Block,
  BlockMap,
  Column,
  Control,
  Doc,
  KeyRow,
  LogLine,
  MessageRow,
  NamedRow,
  PropRow,
} from "@/lib/doc/schema";

export const defineDoc = (doc: Doc): Doc => doc;

export const p = (text: string): Block => ({ kind: "p", text });

export const sub = (text: string): Block => ({ kind: "sub", text });

export const caption = (text: string): Block => ({ kind: "caption", text });

export const prompt = (text: string): Block => ({ kind: "prompt", text });

export const list = (items: readonly string[]): Block => ({
  items,
  kind: "list",
});

export const demo = (name: DemoName, space?: 40 | 48 | 56): Block =>
  space === undefined ? { kind: "demo", name } : { kind: "demo", name, space };

export const code = (file: string): Block => ({ file, kind: "code" });

export const excerpt = (
  file: string,
  ...ranges: (readonly [string, string | null])[]
): Block => ({ file, kind: "excerpt", ranges });

export const table = (spec: BlockMap["table"]): Block => ({
  ...spec,
  kind: "table",
});

export const column = (
  label: string,
  kind: Column["kind"],
  options: Omit<Column, "kind" | "label"> = {}
): Column => ({ ...options, kind, label });

export const props = (rows: readonly PropRow[], label = "prop"): Block => ({
  kind: "props",
  label,
  rows,
});

export const attrs = (rows: readonly NamedRow[]): Block => ({
  kind: "attrs",
  rows,
});

export const variables = (rows: readonly NamedRow[]): Block => ({
  kind: "variables",
  rows,
});

export const keys = (rows: readonly KeyRow[]): Block => ({
  kind: "keys",
  rows,
});

export const messages = (
  label: string,
  rows: readonly MessageRow[]
): Block => ({ kind: "messages", label, rows });

export const controls = (...items: Control[]): Block => ({
  controls: items,
  kind: "controls",
});

export const choice = (
  name: string,
  options: readonly string[],
  value: string
): Control => ({ name, options, type: "choice", value });

export const toggle = (name: string, on: boolean): Control => ({
  name,
  on,
  type: "switch",
});

export const range = (
  name: string,
  [min, value, max, step]: readonly [number, number, number, number],
  unit: string
): Control => ({ max, min, name, step, type: "range", unit, value });

export const log = (lines: readonly LogLine[]): Block => ({
  kind: "log",
  lines,
});

export const actions = (
  label: string,
  action: BlockMap["actions"]["action"]
): Block => ({ action, kind: "actions", label });

export const part = (
  name: string,
  text: string,
  ...blocks: Block[]
): Block => ({
  blocks,
  kind: "part",
  name,
  text,
});

export const qa = (question: string, ...blocks: Block[]): Block => ({
  blocks,
  kind: "qa",
  question,
});

export const section = (title: string, ...blocks: Block[]): Block => ({
  blocks,
  kind: "section",
  title,
});

export const intro = (...blocks: Block[]): Block => ({
  blocks,
  kind: "intro",
});
