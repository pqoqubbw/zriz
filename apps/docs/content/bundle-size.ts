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
      "first load",
      table({
        columns: [
          column("set", "prose", { width: 136 }),
          column("imports", "prose"),
          column("brotli", "prose", { align: "end", width: 88 }),
        ],
        rows: [
          ["editor", "every part from `@zriz/react/cropper`", "32.28 kB"],
          ["avatar", "`Root`, `Viewport`, `Image`, `Mask`, `Area`", "25.67 kB"],
          ["root only", "`Root`", "18.20 kB"],
          [
            "vanilla avatar",
            "`createCropper`, `loadImage`, `attachImage`, `bindViewport`, `bindPhoto`, `bindMask` and `bindArea`",
            "21.10 kB",
          ],
          ["server", "`toSharp` from `@zriz/core`", "723 B"],
          ["stylesheet", "`styles.css`, which is optional", "893 B"],
        ],
      }),
      p(
        "measured with size-limit 14.3.0 on the 0.0.0 packages. it bundles each set with rolldown 1.2.15, minifies it with oxc and leaves out react and react-dom. it compresses each output file with brotli at quality 11, adds the files up and subtracts the 18 B that size-limit measures for an empty project. 1 kB is 1000 B. the build uses the `production` export condition, so development warnings do not count."
      ),
      p("with gzip, the stylesheet is 1020 B."),
      p(
        "the same sets built with rollup 4, vite 7 and 8, webpack 5 and next 16, with turbopack or webpack, come out between 2.2% smaller and 7.4% larger. esbuild comes out up to 16.3% larger."
      ),
      p(
        'esbuild ignores the `production` condition unless you pass it, so it ships the development warnings. pass `conditions: ["module", "production"]` in production builds. `module` keeps the condition esbuild sets by default.'
      )
    ),
    section(
      "loaded later",
      p(
        "four chunks stay out of the first load and download the first time a photo needs them. each row is what the chunk adds to the avatar set:"
      ),
      table({
        columns: [
          column("chunk", "prose", { width: 136 }),
          column("loads when", "prose"),
          column("brotli", "prose", { align: "end", width: 88 }),
        ],
        rows: [
          [
            "render",
            "the first export. it starts downloading once the first photo attaches",
            size(LAZY_CHUNKS.render),
          ],
          [
            "sharpen",
            "the sharper redraw at rest and on deep zoom. it starts downloading after the first paint",
            size(LAZY_CHUNKS.sharpen),
          ],
          ["svg", "the photo is an svg", size(LAZY_CHUNKS.svg)],
          [
            "source",
            "you pass an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` to `loadImage`, or your `decode` option runs after the browser fails to decode. `Root` never loads it",
            size(LAZY_CHUNKS.source),
          ],
        ],
      }),
      p(
        `with all four chunks, even \`source\`, which \`Root\` never loads, the avatar set comes to ${size(AVATAR_TOTAL)}. rolldown, rollup, vite, webpack and next keep the code a chunk shares with the first load in the first load, so the chunks stay this small. esbuild splits that code into chunks of its own. a chunk bundled alone is larger: \`render\` is 3.68 kB.`
      )
    ),
    section(
      "dependencies",
      p(
        "`@zriz/react` has `@zriz/core` and react as peers and no dependencies. `@zriz/core` has none either. both packages mark only their css as a side effect, so rollup, vite, webpack and next drop every part you do not import. esbuild drops their code too, but it still writes the four lazy chunks next to your bundle, even for a part such as `Rotate` that never loads them."
      )
    ),
  ],
  lede: "what each set of imports adds to your bundle, minified and compressed with brotli.",
});

export { BUNDLE_SIZE_PAGE };
