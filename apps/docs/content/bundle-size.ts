import { AVATAR_TOTAL, LAZY_CHUNKS } from "@/content/bundle-size-chunks";
import { column, defineDoc, p, section, table } from "@/lib/doc/define";

const KILO = 1000;

const size = (bytes: number): string =>
  bytes < KILO
    ? `${bytes} B`
    : `${(Math.round(bytes / 10) / 100).toFixed(2)} kB`;

const BUNDLE_SIZE_PAGE = defineDoc({
  blocks: [
    section(
      "First load",
      table({
        columns: [
          column("Set", "prose", { width: 136 }),
          column("Imports", "prose"),
          column("Brotli", "prose", { align: "end", width: 88 }),
        ],
        rows: [
          ["Editor", "Every part from `@zriz/react/cropper`", "32.28 kB"],
          ["Avatar", "`Root`, `Viewport`, `Image`, `Mask`, `Area`", "25.67 kB"],
          ["Root only", "`Root`", "18.20 kB"],
          [
            "Vanilla avatar",
            "`createCropper`, `loadImage`, `attachImage`, `bindViewport`, `bindPhoto`, `bindMask` and `bindArea`",
            "21.10 kB",
          ],
          ["Server", "`toSharp` from `@zriz/core`", "723 B"],
          ["Stylesheet", "`styles.css`, which is optional", "893 B"],
        ],
      }),
      p(
        "Measured with size-limit 14.3.0 on the 0.0.0 packages. It bundles each set with Rolldown 1.2.15, minifies it with Oxc and leaves out React and react-dom. It compresses each output file with Brotli at quality 11, adds the files up and subtracts the 18 B that size-limit measures for an empty project. 1 kB is 1000 B. The build uses the `production` export condition, so development warnings do not count."
      ),
      p("With gzip, the stylesheet is 1020 B."),
      p(
        "The same sets built with Rollup 4, Vite 7 and 8, webpack 5 and Next 16, with Turbopack or webpack, come out between 2.2% smaller and 7.4% larger. esbuild comes out up to 16.3% larger."
      ),
      p(
        'esbuild ignores the `production` condition unless you pass it, so it ships the development warnings. Pass `conditions: ["module", "production"]` in production builds. `module` keeps the condition esbuild sets by default.'
      )
    ),
    section(
      "Loaded later",
      p(
        "Four chunks stay out of the first load and download the first time a photo needs them. Each row is what the chunk adds to the avatar set:"
      ),
      table({
        columns: [
          column("Chunk", "prose", { width: 136 }),
          column("Loads when", "prose"),
          column("Brotli", "prose", { align: "end", width: 88 }),
        ],
        rows: [
          [
            "Render",
            "The first export. It starts downloading once the first photo attaches",
            size(LAZY_CHUNKS.render),
          ],
          [
            "Sharpen",
            "The sharper redraw at rest and on deep zoom. It starts downloading after the first paint",
            size(LAZY_CHUNKS.sharpen),
          ],
          ["SVG", "The photo is an SVG", size(LAZY_CHUNKS.svg)],
          [
            "Source",
            "You pass an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` to `loadImage`, or your `decode` option runs after the browser fails to decode. `Root` never loads it",
            size(LAZY_CHUNKS.source),
          ],
        ],
      }),
      p(
        `With all four chunks, even \`source\`, which \`Root\` never loads, the avatar set comes to ${size(AVATAR_TOTAL)}. Rolldown, Rollup, Vite, webpack and Next keep the code a chunk shares with the first load in the first load, so the chunks stay this small. esbuild splits that code into chunks of its own. A chunk bundled alone is larger: \`render\` is 3.68 kB.`
      )
    ),
    section(
      "Dependencies",
      p(
        "`@zriz/react` has `@zriz/core` and React as peers and no dependencies. `@zriz/core` has none either. Both packages mark only their CSS as a side effect, so Rollup, Vite, webpack and Next drop every part you do not import. esbuild drops their code too, but it still writes the four lazy chunks next to your bundle, even for a part such as `Rotate` that never loads them."
      )
    ),
  ],
  lede: "What each set of imports adds to your bundle, minified and compressed with Brotli.",
});

export { BUNDLE_SIZE_PAGE };
