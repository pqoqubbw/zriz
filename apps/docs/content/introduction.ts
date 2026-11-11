import {
  code,
  column,
  defineDoc,
  demo,
  p,
  section,
  table,
} from "@/lib/doc/define";

const INTRODUCTION_PAGE = defineDoc({
  blocks: [
    demo("introduction"),
    section(
      "What it does",
      table({
        columns: [column("Feature", "prose"), column("What you get", "prose")],
        rows: [
          [
            "[Straighten](dial)",
            "A dial turns the photo up to 45° each way and glides on after a flick. The photo zooms in by the least amount that keeps every corner of the crop filled",
          ],
          [
            "[Move and zoom](viewport)",
            "Drag, pinch, trackpad and wheel. Pull past an edge and the photo stretches, then springs back when you let go",
          ],
          [
            "[Rotate and flip](buttons)",
            "Animated quarter turns and mirroring, and a reset that undoes every change",
          ],
          [
            "[Aspect ratio](aspect-ratio)",
            "Free, the photo's own ratio or any ratio you name, with a portrait and landscape swap",
          ],
          [
            "[Circle crop](avatar)",
            "A round mask for avatars, exported as a PNG with transparent corners",
          ],
          [
            "[Export](exporting)",
            "A file made off the main thread, or a plan your server uses to cut the original with sharp",
          ],
          [
            "[Accessibility](accessibility)",
            "Keys on every control, labels and announcements in your own words, and shorter motion when the system asks",
          ],
          [
            "[Styling](styling)",
            "An optional stylesheet, CSS variables, a data attribute for every state, dark mode and Tailwind",
          ],
          [
            "[Plain data](value)",
            "The crop is a small object you can save, restore, undo or send",
          ],
          [
            "[Without React](vanilla-js)",
            "The same core binds to plain elements, so it runs in any framework",
          ],
        ],
      })
    ),
    section(
      "Build it from parts",
      p(
        "Import the parts as one namespace from `@zriz/react/cropper`, and the hooks from `@zriz/react`. These pages call the parts by their short names, such as `Root`."
      ),
      p(
        "Each part renders one outer element, which takes your props, `className` and ref. `Image`, `Mask` and `Area` go inside `Viewport`. The dial, zoom and buttons can sit anywhere inside `Root`, so your layout decides where they go:"
      ),
      code("introduction/parts.jsx.tsx"),
      p("`onValueCommit` hands you the crop each time a change ends."),
      p(
        "The demo above runs this code. It adds handles, a grid, rotate, flip and reset, shows the angle to one decimal and uses the styles from the zriz site."
      )
    ),
  ],
  lede: "zriz is a headless image cropper for React and Next.js, written in TypeScript. It crops avatars, profile pictures and cover photos with a straighten dial, pinch zoom and touch gestures, like the crop tool in iOS Photos.",
});

export { INTRODUCTION_PAGE };
