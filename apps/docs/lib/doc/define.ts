import type { DemoName } from "@/demos/registry";
import type {
  Bind,
  Block,
  BlockMap,
  BlockOf,
  Column,
  Control,
  DemoSpace,
  Doc,
  KeyRow,
  LiveFeed,
  LogLine,
  MessageRow,
  NamedRow,
  PropRow,
} from "@/lib/doc/schema";

const defineDoc = (doc: Doc): Doc => doc;

const p = (text: string): Block => ({ kind: "p", text });

const caption = (text: string): Block => ({ kind: "caption", text });

const prompt = (text: string): Block => ({ kind: "prompt", text });

const demo = (name: DemoName, space?: DemoSpace): Block =>
  space === undefined ? { kind: "demo", name } : { kind: "demo", name, space };

const code = (file: string): Block => ({ file, kind: "code" });

const excerpt = (
  file: string,
  ...ranges: (readonly [string, string | null])[]
): Block => ({ file, kind: "excerpt", ranges });

const table = (spec: BlockMap["table"]): Block => ({
  ...spec,
  kind: "table",
});

const column = (
  label: string,
  kind: Column["kind"],
  options: Omit<Column, "kind" | "label"> = {}
): Column => ({ ...options, kind, label });

const props = (rows: readonly PropRow[], label = "Prop"): Block => ({
  kind: "props",
  label,
  rows,
});

const attrs = (rows: readonly NamedRow[]): Block => ({
  kind: "attrs",
  rows,
});

const variables = (rows: readonly NamedRow[]): Block => ({
  kind: "variables",
  rows,
});

const keys = (rows: readonly KeyRow[]): Block => ({
  kind: "keys",
  rows,
});

const messages = (label: string, rows: readonly MessageRow[]): Block => ({
  kind: "messages",
  label,
  rows,
});

const controls = (...items: Control[]): BlockOf<"controls"> => ({
  controls: items,
  kind: "controls",
});

const choice = (
  name: string,
  options: readonly string[],
  value: string
): Control => ({ name, options, type: "choice", value });

const toggle = (name: string, on: boolean): Control => ({
  name,
  on,
  type: "switch",
});

const range = (
  name: string,
  [min, value, max, step]: readonly [number, number, number, number],
  unit: string
): Control => ({ max, min, name, step, type: "range", unit, value });

const log = (lines: readonly LogLine[]): BlockOf<"log"> => ({
  kind: "log",
  lines,
});

const actions = (
  label: string,
  action: BlockMap["actions"]["action"]
): BlockOf<"actions"> => ({ action, kind: "actions", label });

const bind = (
  to: Bind,
  block: BlockOf<"actions" | "controls" | "log">
): Block => ({ ...block, bind: to });

const liveCode = (file: string, feed: LiveFeed): Block => ({
  feed,
  file,
  kind: "liveCode",
});

const part = (name: string, text: string, ...blocks: Block[]): Block => ({
  blocks,
  kind: "part",
  name,
  text,
});

const qa = (question: string, ...blocks: Block[]): Block => ({
  blocks,
  kind: "qa",
  question,
});

const section = (title: string, ...blocks: Block[]): Block => ({
  blocks,
  kind: "section",
  title,
});

const intro = (...blocks: Block[]): Block => ({
  blocks,
  kind: "intro",
});

export {
  actions,
  attrs,
  bind,
  caption,
  choice,
  code,
  column,
  controls,
  defineDoc,
  demo,
  excerpt,
  intro,
  keys,
  liveCode,
  log,
  messages,
  p,
  part,
  prompt,
  props,
  qa,
  range,
  section,
  table,
  toggle,
  variables,
};
