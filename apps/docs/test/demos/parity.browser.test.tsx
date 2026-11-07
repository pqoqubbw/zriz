import type * as CropperModule from "@zriz/react/cropper";
import { createElement, isValidElement } from "react";
import type { ComponentType, ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import { DEMO_LOADERS } from "../../demos/load";
import { DEMO_NAMES, DEMO_SPECS } from "../../demos/registry";
import type { DemoSnippet, SnippetInput } from "../../demos/registry";

type CropperParts = typeof CropperModule;

type Recorded = Map<string, Map<string, unknown>>;

type SnippetModule = Record<string, unknown>;

const calls = vi.hoisted(() => ({
  isPart: (value: unknown): value is ComponentType<Record<string, unknown>> =>
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in value &&
    "render" in value,
  parts: [] as [string, Record<string, unknown>][],
}));

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

vi.mock(import("@zriz/react/cropper"), async (original) => {
  const parts = await original<CropperParts>();
  const { createElement: make, forwardRef: wrapRef } = await import("react");
  const { isPart } = calls;

  return Object.fromEntries(
    Object.entries(parts).map(([name, part]) => [
      name,
      isPart(part)
        ? wrapRef((props: Record<string, unknown>, ref) => {
            calls.parts.push([name, props]);

            return make(part, { ...props, ref });
          })
        : part,
    ])
  );
});

const SNIPPETS = import.meta.glob<SnippetModule>("../../snippets/**/*.tsx");

const SHELL_PROPS: Record<string, readonly string[]> = {
  Root: ["actionsRef", "onError", "onLoad", "shape", "src"],
};

const IGNORED = new Set(["children", "className", "ref", "render", "style"]);

const isPrimitive = (value: unknown): boolean =>
  ["boolean", "number", "string"].includes(typeof value);

const record = (): Recorded => {
  const out: Recorded = new Map();

  for (const [name, props] of calls.parts) {
    const own = out.get(name) ?? new Map<string, unknown>();

    for (const [key, value] of Object.entries(props)) {
      if (!IGNORED.has(key) && !key.startsWith("data-")) {
        own.set(key, value);
      }
    }

    out.set(name, own);
  }

  calls.parts.length = 0;

  return out;
};

const INPUTS: Record<SnippetInput, () => unknown> = {
  callback: () => () => {},
  flag: () => false,
  photo: () => new Blob(),
  text: () => "photo",
};

const inputOf = (kind: SnippetInput): unknown => INPUTS[kind]();

const isComponent = (
  value: unknown
): value is ComponentType<Record<string, unknown>> =>
  typeof value === "function";

const elementOf = (
  exported: unknown,
  props: Record<string, unknown>
): ReactElement => {
  if (isValidElement(exported)) {
    return exported;
  }

  if (isComponent(exported)) {
    return createElement(exported, props);
  }

  throw new Error("the snippet exports no element or component");
};

const renderSnippet = async (snippet: DemoSnippet): Promise<Recorded> => {
  const load = SNIPPETS[`../../snippets/${snippet.file}`];

  if (!load) {
    throw new Error(`no snippet ${snippet.file}`);
  }

  const props = Object.fromEntries(
    Object.entries(snippet.inputs).map(([key, kind]) => [key, inputOf(kind)])
  );

  if (snippet.kind !== "component") {
    Object.assign(globalThis, props);
  }

  const loaded = await load();
  const exported = loaded[snippet.export];
  const shown = elementOf(exported, props);
  const { Root } = await import("@zriz/react/cropper");
  const element =
    snippet.kind === "parts"
      ? createElement(Root, { src: new Blob() }, shown)
      : shown;

  calls.parts.length = 0;
  await render(element);

  const recorded = record();

  await cleanup();

  return recorded;
};

const differencesOf = (snippet: Recorded, demo: Recorded): string[] => {
  const out: string[] = [];

  for (const name of demo.keys()) {
    if (!snippet.has(name)) {
      out.push(`+${name}`);
    }
  }

  for (const [name, props] of snippet) {
    const theirs = demo.get(name);

    if (!theirs) {
      out.push(`-${name}`);

      continue;
    }

    for (const [key, value] of props) {
      if (key === "src") {
        continue;
      }

      const same =
        theirs.has(key) && (!isPrimitive(value) || theirs.get(key) === value);

      if (!same) {
        out.push(`${name}.${key}`);
      }
    }

    for (const key of theirs.keys()) {
      if (!props.has(key) && !(SHELL_PROPS[name] ?? []).includes(key)) {
        out.push(`${name}.${key}`);
      }
    }
  }

  return out.toSorted();
};

const CHECKED = DEMO_NAMES.filter((name) => DEMO_SPECS[name].snippet !== null);

describe("demo parity with the page code", () => {
  afterEach(async () => {
    await cleanup();
  });

  it.each(CHECKED)("%s keeps the snippet's parts and props", async (name) => {
    const { snippet } = DEMO_SPECS[name];

    if (!snippet) {
      return;
    }

    const shown = await renderSnippet(snippet);
    const { default: Live } = await DEMO_LOADERS[name]();

    calls.parts.length = 0;
    await render(createElement(Live));

    const demo = record();

    expect(CHECKED).toContain("introduction");

    expect(differencesOf(shown, demo)).toStrictEqual(
      snippet.differences.toSorted()
    );
  });
});
