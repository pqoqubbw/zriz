import {
  actions,
  caption,
  choice,
  code,
  controls,
  defineDoc,
  demo,
  log,
  p,
  range,
  section,
  toggle,
} from "@/lib/doc/define";

export const playground = defineDoc({
  blocks: [
    demo("playground", 48),
    section(
      "change the props",
      caption("Root"),
      controls(
        choice("shape", ["rect", "circle"], "rect"),
        choice("motion", ["auto", "always", "reduce"], "reduce"),
        choice("dir", ["ltr", "rtl"], "ltr"),
        range("maxZoom", [1, 8, 15, 1], "×"),
        range("recentreDelay", [0, 500, 2000, 50], " ms"),
        toggle("disabled", false)
      ),
      caption("Viewport"),
      controls(
        choice("wheel", ["pan", "zoom", "none"], "zoom"),
        toggle("rotateGesture", true)
      )
    ),
    section(
      "tilt the photo",
      p(
        "perspective tilts the photo as if the camera leaned. no part sets it, so pass it in `value` or `defaultValue`, or call `setValue()`. [value](value) has its range."
      ),
      controls(
        range("vertical", [-30, 0, 30, 1], "°"),
        range("horizontal", [-30, 0, 30, 1], "°")
      )
    ),
    section(
      "copy the code",
      p(
        "the code builds the cropper in the demo, with only the props you changed from their defaults:"
      ),
      code("playground/root.jsx.tsx")
    ),
    section(
      "watch the value",
      p(
        "the crop as you move it, the same object `onValueChange` and `onValueCommit` hand you:"
      ),
      code("playground/value.ts"),
      actions("copy value", "copy-value")
    ),
    section(
      "watch the events",
      p(
        "each row is a reason and a phase from `onValueChange`, or a commit from `onValueCommit`, as in [events](events), newest first:"
      ),
      log([
        { event: "dial commit 4°", time: "12:04:31" },
        { event: "dial end", time: "12:04:31" },
        { event: "dial move", time: "12:04:30" },
        { event: "dial start", time: "12:04:29" },
      ])
    ),
    section(
      "export the crop",
      p(
        'download the crop as a png made by `exportCrop` with `type: "image/png"`. with `shape` set to `"circle"` above, the corners come out transparent.'
      ),
      actions("download png", "download")
    ),
  ],
  lede: "change the main props on a live cropper and copy the code that matches what you see.",
});
