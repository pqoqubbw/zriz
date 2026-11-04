import { column, defineDoc, p, section, table } from "@/lib/doc/define";

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
          ["editor", "every part from `@zriz/react/cropper`", "22.14 kB"],
          ["avatar", "`Root`, `Viewport`, `Image`, `Mask`, `Area`", "17.00 kB"],
          ["root only", "`Root`", "11.79 kB"],
          [
            "vanilla avatar",
            "`createCropper`, `loadImage`, `attachImage`, `bindViewport`, `bindPhoto`, `bindMask` and `bindArea`",
            "14.64 kB",
          ],
          ["server", "`toSharp` from `@zriz/core`", "540 B"],
          ["stylesheet", "`styles.css`, which is optional", "858 B"],
        ],
      }),
      p(
        "measured with size-limit 14.3 on 4 november 2026. it bundles each set with rolldown, minifies it and compresses it with brotli, and it leaves out react and react-dom. the build uses the `production` export condition, so development warnings do not count."
      ),
      p("with gzip, the stylesheet is 978 B.")
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
            "1.92 kB",
          ],
          [
            "sharpen",
            "the sharper redraw at rest and on deep zoom. it starts downloading after the first paint",
            "393 B",
          ],
          ["svg", "the photo is an svg", "564 B"],
          [
            "source",
            "you pass an `img`, `video`, `canvas` or `OffscreenCanvas` to `loadImage`. `Root` never loads it",
            "325 B",
          ],
        ],
      }),
      p(
        "with all four chunks, even `source`, which `Root` never loads, the avatar set comes to 20.20 kB. your bundler keeps the code a chunk shares with the first load in the first load, so the chunks stay this small. a chunk bundled alone is larger: `render` is 2.89 kB."
      )
    ),
    section(
      "dependencies",
      p(
        "`@zriz/react` depends only on `@zriz/core`, which has no dependencies. both packages mark only their css as a side effect, so your bundler drops every part you do not import."
      )
    ),
  ],
  lede: "what each set of imports adds to your bundle, minified and compressed with brotli.",
});

export { BUNDLE_SIZE_PAGE };
