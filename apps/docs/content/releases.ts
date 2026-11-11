type Release = {
  bump: "major" | "minor" | "patch";
  date: string;
  notes: readonly string[];
  version: string;
};

const RELEASES: readonly Release[] = [
  {
    bump: "patch",
    date: "2026-11-11",
    notes: [
      "`Root` loads the code that fetches, checks and decodes a file when it gets a `src`, as one chunk of about 4.6 kB. With Brotli the avatar set is 4.13 kB smaller on first load and the full editor 4.32 kB smaller. Code that calls `loadImage` itself is not affected.",
      "A TIFF whose header tables never end now fails with a `too-large` error.",
      "An SVG that repeats an id is checked by the first element with that id, the one the browser draws.",
    ],
    version: "0.2.1",
  },
  {
    bump: "minor",
    date: "2026-11-10",
    notes: [
      "Two fingers can drag two handles at once to resize the crop. With a locked aspect, a finger that stays still keeps its corner and the other finger resizes from it.",
      "`Rotate`, `Flip`, `Reset` and aspect changes move the photo through the Web Animations API, so it stays smooth when the browser slows `requestAnimationFrame`, as Safari does in Low Power Mode.",
      "`handleHandlers` in `@zriz/core/dom` takes a fourth argument, a function that gets `true` when its handle is pressed and `false` when it lets go.",
      "The full editor is 1.48 kB larger and the avatar set 0.66 kB larger.",
    ],
    version: "0.2.0",
  },
  {
    bump: "patch",
    date: "2026-11-07",
    notes: [
      "The full editor is 138 B smaller and the avatar set 47 B smaller, with the same behaviour and API.",
    ],
    version: "0.1.1",
  },
  {
    bump: "minor",
    date: "2026-11-07",
    notes: ["The first version."],
    version: "0.1.0",
  },
];

export type { Release };
export { RELEASES };
