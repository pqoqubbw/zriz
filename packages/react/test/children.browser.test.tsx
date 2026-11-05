import { createElement, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import * as Cropper from "../src/cropper";

const IMAGE = { height: 300, width: 400 };

type ShellProps = { children?: ReactNode; photo: string };

const Shell = ({ children, photo }: ShellProps) => {
  const props = { image: IMAGE };

  return (
    <Cropper.Root key={photo} {...props}>
      <Cropper.Viewport>
        <Cropper.Image />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop">
          <Cropper.Grid />
          <Cropper.Handle position="top-left" />
          <Cropper.Handle position="bottom-right" />
        </Cropper.Area>
      </Cropper.Viewport>
      {children}
      <Cropper.Dial aria-label="Straighten">
        <Cropper.DialTicks />
        <Cropper.DialValue />
      </Cropper.Dial>
      <Cropper.Instructions>drag to move</Cropper.Instructions>
    </Cropper.Root>
  );
};

const App = () => {
  const [photo, setPhoto] = useState("a");

  return (
    <Shell photo={photo}>
      <button
        onClick={() => {
          setPhoto("b");
        }}
        type="button"
      >
        next
      </button>
      <span>{photo}</span>
    </Shell>
  );
};

const keyWarnings = (spy: { mock: { calls: unknown[][] } }): string[] =>
  spy.mock.calls
    .map((call) => String(call[0]))
    .filter((text) => text.includes('unique "key"'));

describe("children of the parts", () => {
  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it("passes several children to every part with no key warning", async () => {
    const errors = vi.spyOn(console, "error");
    const screen = await render(<App />);

    document.querySelector("button")?.click();

    await expect.element(screen.getByText("b")).toBeInTheDocument();
    expect(keyWarnings(errors)).toStrictEqual([]);
  });

  it("still warns about a list without keys, as a div does", async () => {
    const errors = vi.spyOn(console, "error");
    const items = ["one", "two"].map((item) =>
      createElement("span", null, item)
    );

    await render(<Cropper.Root image={IMAGE}>{items}</Cropper.Root>);

    expect(keyWarnings(errors)).toHaveLength(1);
  });
});
