import { Fragment } from "react";

import { Kbd } from "@/components/ui/kbd";
import type { Chord } from "@/lib/doc/schema";

type GlyphProps = {
  name: keyof typeof KEY_GLYPHS;
};

type KeyProps = {
  name: string;
};

type KeysProps = {
  keys: readonly Chord[];
};

const KEY_GLYPHS = {
  alt: "⌥",
  down: "↓",
  left: "←",
  right: "→",
  shift: "⇧",
  up: "↑",
} as const satisfies Record<string, string>;

const ARROW_KEYS = ["left", "up", "right", "down"] as const;

const isGlyph = (name: string): name is keyof typeof KEY_GLYPHS =>
  Object.hasOwn(KEY_GLYPHS, name);

const Glyph = ({ name }: GlyphProps) => (
  <Kbd>
    <span aria-hidden="true">{KEY_GLYPHS[name]}</span>
    <span className="sr-only">{name}</span>
  </Kbd>
);

const Key = ({ name }: KeyProps) => {
  if (name === "arrow keys") {
    return (
      <>
        {ARROW_KEYS.map((arrow) => (
          <Kbd aria-hidden="true" key={arrow}>
            {KEY_GLYPHS[arrow]}
          </Kbd>
        ))}
        <span className="sr-only">arrow keys</span>
      </>
    );
  }

  if (isGlyph(name)) {
    return <Glyph name={name} />;
  }

  return <Kbd wide={name.length > 1}>{name}</Kbd>;
};

const Keys = ({ keys }: KeysProps) => (
  <span className="flex min-h-5.5 flex-wrap content-start items-center gap-1 pt-px">
    {keys.map((chord, i) => (
      <Fragment key={chord.join("+")}>
        {i > 0 && <span className="sr-only">or</span>}
        {chord.map((name, j) => (
          <Fragment key={name}>
            {j > 0 && <span className="text-small text-faint">+</span>}
            <Key name={name} />
          </Fragment>
        ))}
      </Fragment>
    ))}
  </span>
);

export { Keys };
