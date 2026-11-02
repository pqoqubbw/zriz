import {
  code,
  column,
  defineDoc,
  demo,
  p,
  section,
  table,
} from "@/lib/doc/define";

export const introduction = defineDoc({
  blocks: [
    demo("introduction"),
    section(
      "what it does",
      table({
        columns: [column("feature", "prose"), column("what you get", "prose")],
        rows: [
          [
            "[straighten](dial)",
            "a dial turns the photo up to 45° each way and glides on after a flick. the photo zooms in by the least amount that keeps every corner of the crop filled",
          ],
          [
            "[move and zoom](viewport)",
            "drag, pinch, trackpad and wheel. pull past an edge and the photo stretches, then springs back when you let go",
          ],
          [
            "[rotate and flip](buttons)",
            "animated quarter turns and mirroring, and a reset that undoes every change",
          ],
          [
            "[aspect ratio](aspect-ratio)",
            "free, the photo's own ratio or any ratio you name, with a portrait and landscape swap",
          ],
          [
            "[circle crop](avatar)",
            "a round mask for avatars, exported as a png with transparent corners",
          ],
          [
            "[export](exporting)",
            "a file made off the main thread, or a plan your server uses to cut the original with sharp",
          ],
          [
            "[accessibility](accessibility)",
            "keys on every control, labels and announcements in your own words, and shorter motion when the system asks",
          ],
          [
            "[styling](styling)",
            "an optional stylesheet, css variables, a data attribute for every state, dark mode and tailwind",
          ],
          [
            "[plain data](value)",
            "the crop is a small object you can save, restore, undo or send",
          ],
          [
            "[without react](vanilla-js)",
            "the same core binds to plain elements, so it runs in any framework",
          ],
        ],
      })
    ),
    section(
      "build it from parts",
      p(
        "import the parts as one namespace from `@zriz/react/cropper`, and the hooks from `@zriz/react`. these pages call the parts by their short names, such as `Root`."
      ),
      p(
        "each part renders one outer element, which takes your props, `className` and ref. `Image`, `Mask` and `Area` go inside `Viewport`. the dial, zoom and buttons can sit anywhere inside `Root`, so your layout decides where they go:"
      ),
      code("introduction/parts.jsx.tsx"),
      p("`onValueCommit` hands you the crop each time a change ends.")
    ),
  ],
  lede: "zriz is an image cropper for react with a straighten dial, like the crop tool in ios photos.",
});
