import axe from "axe-core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { userEvent } from "vitest/browser";

import "../app/globals.css";

import { DocBody } from "../components/doc/blocks";
import { FAQ_PAGE } from "../content/faq";
import { anchorsOf, walkBlocks } from "../lib/doc/anchors";
import type { Block } from "../lib/doc/schema";

vi.hoisted(() => {
  Object.assign(globalThis, { process: { env: {} } });
});

vi.mock(import("../lib/doc/snippets"), () => ({
  isFragment: () => false,
  languageOf: () => ({ fence: "ts", shiki: "ts" }) as const,
  textOf: () => "",
}));

const withoutCode = (blocks: readonly Block[]): Block[] =>
  blocks
    .filter((block) => block.kind !== "code")
    .map((block) =>
      "blocks" in block
        ? { ...block, blocks: withoutCode(block.blocks) }
        : block
    );

const BLOCKS = withoutCode(FAQ_PAGE.blocks);

const ANCHORS = anchorsOf(BLOCKS);

const QUESTIONS = walkBlocks(BLOCKS).flatMap((block) =>
  block.kind === "qa"
    ? [{ id: ANCHORS.of(block), question: block.question }]
    : []
);

const triggerOf = (id: string): HTMLButtonElement => {
  const found = document.querySelector<HTMLButtonElement>(`#${id} button`);

  if (!found) {
    throw new Error(`no trigger for ${id}`);
  }

  return found;
};

const panelOf = (id: string): HTMLElement => {
  const found = document.querySelector<HTMLElement>(
    `[role="region"][aria-labelledby="${triggerOf(id).id}"]`
  );

  if (!found) {
    throw new Error(`no panel for ${id}`);
  }

  return found;
};

const settled = async (check: () => void) => {
  await vi.waitFor(check, { interval: 20, timeout: 2000 });
};

const mount = async () => {
  await render(<DocBody anchors={ANCHORS} blocks={BLOCKS} />);
};

describe("faq", () => {
  afterEach(async () => {
    await cleanup();
    history.replaceState(null, "", location.pathname);
  });

  it("lists every question closed, with every answer in the dom", async () => {
    await mount();

    const triggers = [
      ...document.querySelectorAll<HTMLButtonElement>("h3 > button"),
    ];

    expect(triggers.map((each) => each.textContent)).toStrictEqual(
      QUESTIONS.map((each) => each.question)
    );

    expect(document.querySelectorAll("section [data-slot=faq]")).toHaveLength(
      2
    );

    for (const { id } of QUESTIONS) {
      expect(triggerOf(id).getAttribute("aria-expanded")).toBe("false");
      expect(panelOf(id).hasAttribute("hidden")).toBeTruthy();
      expect(panelOf(id).textContent).not.toBe("");
    }

    const result = await axe.run(document.body, {
      rules: { region: { enabled: false } },
    });

    expect(result.violations.map((each) => each.id)).toStrictEqual([]);
  });

  it("opens several questions and keeps the closed answers", async () => {
    await mount();

    const [first, second, third] = QUESTIONS;

    if (!first || !second || !third) {
      throw new Error("too few questions");
    }

    await userEvent.click(triggerOf(first.id));
    triggerOf(second.id).focus();
    await userEvent.keyboard("{Enter}");
    triggerOf(third.id).focus();
    await userEvent.keyboard(" ");

    await settled(() => {
      for (const { id } of [first, second, third]) {
        expect(triggerOf(id).getAttribute("aria-expanded")).toBe("true");
        expect(panelOf(id).hasAttribute("hidden")).toBeFalsy();
      }
    });

    await userEvent.keyboard(" ");

    await settled(() => {
      expect(triggerOf(third.id).getAttribute("aria-expanded")).toBe("false");
      expect(panelOf(third.id).hasAttribute("hidden")).toBeTruthy();
    });

    expect(panelOf(third.id).textContent).not.toBe("");
    expect(triggerOf(first.id).getAttribute("aria-expanded")).toBe("true");
  });

  it("opens the question a hash points at", async () => {
    const [, linked, later] = QUESTIONS;

    if (!linked || !later) {
      throw new Error("too few questions");
    }

    history.replaceState(null, "", `#${linked.id}`);
    await mount();

    await settled(() => {
      expect(triggerOf(linked.id).getAttribute("aria-expanded")).toBe("true");
    });

    location.hash = later.id;

    await settled(() => {
      expect(triggerOf(later.id).getAttribute("aria-expanded")).toBe("true");
    });

    expect(triggerOf(linked.id).getAttribute("aria-expanded")).toBe("true");
  });
});
