import {
  actions,
  bind,
  caption,
  choice,
  controls,
  defineDoc,
  demo,
  liveCode,
  log,
  p,
  range,
  section,
  toggle,
} from "@/lib/doc/define";

const PLAYGROUND_PAGE = defineDoc({
  blocks: [
    demo("playground", 48),
    section(
      "Change the props",
      caption("Root"),
      bind(
        "playground",
        controls(
          choice("shape", ["rect", "circle"], "rect"),
          choice("motion", ["auto", "always", "reduce"], "auto"),
          choice("dir", ["ltr", "rtl"], "ltr"),
          range("maxZoom", [1, 15, 15, 1], "×"),
          range("recenterDelay", [0, 500, 2000, 50], " ms"),
          toggle("disabled", false)
        )
      ),
      caption("Viewport"),
      bind(
        "playground",
        controls(
          choice("wheel", ["pan", "zoom", "none"], "pan"),
          toggle("rotateGesture", true)
        )
      )
    ),
    section(
      "Tilt the photo",
      p(
        "Perspective tilts the photo as if the camera leaned. No part sets it, so pass it in `value` or `defaultValue`, or call `setValue()`. [Value](value) has its range."
      ),
      bind(
        "playground",
        controls(
          range("vertical", [-30, 0, 30, 1], "°"),
          range("horizontal", [-30, 0, 30, 1], "°")
        )
      )
    ),
    section(
      "Copy the code",
      p(
        "The code builds the cropper in the demo, with only the props you changed from their defaults:"
      ),
      liveCode("playground/root.jsx.tsx", "code"),
      actions("Copy code", "copy-code"),
      p(
        "The demo adds handles, a grid and reset, shows the angle to one decimal and uses the styles from the zriz site. On a phone its stage is 320 px tall, not the 380 in the code. It tilts the photo with `setValue()` and listens to `onValueChange` and `onValueCommit` for the value and the events below."
      )
    ),
    section(
      "Watch the value",
      p(
        "The crop as you move it, the same object `onValueChange` and `onValueCommit` hand you:"
      ),
      liveCode("playground/value.json", "value"),
      bind("playground", actions("Copy value", "copy-value"))
    ),
    section(
      "Watch the events",
      p(
        "Each row is a reason and a phase from `onValueChange`, or a commit from `onValueCommit`, as in [events](events), newest first:"
      ),
      bind(
        "playground",
        log([
          { event: "dial commit 4°", time: "12:04:31" },
          { event: "dial end", time: "12:04:31" },
          { event: "dial move", time: "12:04:30" },
          { event: "dial start", time: "12:04:29" },
        ])
      )
    ),
    section(
      "Export the crop",
      p(
        'Download the crop as a PNG made by `exportCrop` with `type: "image/png"`. With `shape` set to `"circle"` above, the corners come out transparent.'
      ),
      bind("playground", actions("Download PNG", "download"))
    ),
  ],
  lede: "Change the main props on a live cropper and copy the code that matches what you see.",
});

export { PLAYGROUND_PAGE };
