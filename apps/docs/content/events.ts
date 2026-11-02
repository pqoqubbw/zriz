import {
  code,
  column,
  defineDoc,
  intro,
  p,
  props,
  section,
  table,
} from "@/lib/doc/define";

export const events = defineDoc({
  blocks: [
    intro(
      code("events/usage.jsx.tsx"),
      p(
        "`onValueChange` runs at most once per frame while the crop moves. `onValueCommit` runs once when a gesture or a write is done. `createCropper` takes the same two options."
      )
    ),
    section(
      "save when the user lets go",
      p(
        "a drag, a pinch or a turn of the dial commits once, when the finger lifts. a thrown dial commits when it stops. a key on `Area`, `Dial` or `Zoom` commits once when it comes up, however long it was held, or when focus leaves. a write such as `rotate90()` commits on the next frame, and the turn you see animates after it. a gesture that ends where it started does not commit. loading a photo fits the crop without a commit, so a photo the user never touches sends none. to save it anyway, read `getValue()` or `getPixelCrop()` from the cropper in `actionsRef`, see [cropper](cropper)."
      ),
      code("events/commit.jsx.tsx")
    ),
    section(
      "follow one gesture from start to commit",
      p("log both callbacks, then throw the dial:"),
      code("events/log.jsx.tsx"),
      table({
        columns: [column("log", "mono"), column("when", "prose")],
        rows: [
          ["dial start", "the first frame the dial turns."],
          ["dial move", "every later frame of the drag and of the throw."],
          ["dial end", "the last frame of the throw."],
          ["dial commit", "`onValueCommit`, in the same frame."],
        ],
      }),
      p(
        "a drag that stops before the finger lifts has no `end`, and its last `move` goes straight to the commit. a write outside a gesture logs one `instant` change, then its commit."
      )
    ),
    section(
      "reject a change",
      p(
        "call `details.cancel()` and the crop snaps back to where the last change left it. this keeps the angle within 10° each way:"
      ),
      code("events/cancel.jsx.tsx")
    ),
    section(
      "change details",
      p("the second argument of `onValueChange`:"),
      props(
        [
          {
            name: "reason",
            text: "names what moved the crop, see reasons below.",
            type: "ChangeReason",
          },
          {
            name: "phase",
            text: "is `start`, `move`, `end` or `instant`, see the order above.",
            type: "ChangePhase",
          },
          {
            name: "changed",
            text: "lists the fields that moved. never empty.",
            type: "readonly ValueField[]",
          },
          {
            name: "previous",
            text: "holds what the last change left.",
            type: "CropValue",
          },
          {
            name: "event",
            text: "holds the dom event behind the change.",
            type: "Event | undefined",
          },
          { name: "cancel", text: "rejects this change.", type: "() => void" },
          {
            name: "isCanceled",
            text: "is `true` once `cancel()` ran.",
            type: "boolean",
          },
        ],
        "field"
      )
    ),
    section(
      "commit details",
      p("the second argument of `onValueCommit`:"),
      props(
        [
          {
            name: "reason",
            text: "names the gesture or write behind the commit.",
            type: "ChangeReason",
          },
          {
            name: "previous",
            text: "holds the last committed value. push it to a stack for [undo](undo).",
            type: "CropValue",
          },
          {
            name: "pixelCrop",
            text: "holds the export plan at scale 1 in source pixels, or `null` before a photo loads. [server crop](server-crop) cuts the original with it.",
            type: "ExportPlan | null",
          },
          {
            name: "event",
            text: "holds the event that ended the gesture, or the one passed with the write.",
            type: "Event | undefined",
          },
        ],
        "field"
      )
    ),
    section(
      "reasons",
      p(
        "every change and commit names its reason. inside a gesture, a write without its own reason reports the gesture's reason."
      ),
      table({
        columns: [column("reason", "mono"), column("sent by", "prose")],
        rows: [
          ["pan", "one finger or pointer dragging the photo, and `panBy()`."],
          [
            "pinch",
            "two fingers pinching or twisting, or a trackpad pinch in safari.",
          ],
          [
            "wheel",
            "a mouse wheel or trackpad scrolling or zooming the photo.",
          ],
          ["resize", "a handle being dragged."],
          ["dial", "the dial being dragged or thrown."],
          [
            "keyboard",
            "keys on `Area` and `Dial`. keys on `Zoom` report `zoom-control` on each change and `keyboard` on the commit.",
          ],
          [
            "zoom-control",
            "the `Zoom` slider, `ZoomStep` buttons and `useZoom`.",
          ],
          [
            "aspect",
            "`AspectItem` buttons, `setAspect()` and the `aspect` prop.",
          ],
          [
            "orientation",
            "the `Orientation` button, which swaps portrait and landscape.",
          ],
          ["rotate-90", "`Rotate` buttons and `rotate90()`."],
          ["flip", "`Flip` buttons and `flip()`."],
          ["reset", "`Reset` and `reset()`."],
          [
            "coverage",
            "a later photo of another size, or new options, that refit the crop. the first photo sends nothing.",
          ],
          [
            "history",
            "your own writes only. zriz never sends it, so [undo](undo) can skip those writes. `Root` animates them like `reset()`.",
          ],
          [
            "controlled",
            "the `rotation` and `zoom` props. a new `value` prop sends nothing.",
          ],
          [
            "imperative",
            "`setValue()`, `setRotation()`, `setZoom()` and `setCropState()` called outside a gesture without a reason.",
          ],
        ],
      })
    ),
    section(
      "listen on the cropper",
      p(
        'the cropper emits the two callbacks as `change` and `commit`, plus six more events. in react, make the cropper with `useCropper` and listen in an effect: `useEffect(() => cropper.on("settle", onSettle), [cropper])`, see [hooks](hooks). `createCropper` comes from `@zriz/core`, installed as in [exporting](exporting). `on()` returns a function that removes the listener:'
      ),
      code("events/on.ts"),
      table({
        columns: [
          column("event", "mono", { width: 92 }),
          column("listener gets", "mono", { width: 168 }),
          column("what it does", "prose"),
        ],
        rows: [
          ["gesturestart", "reason, event", "fires when an input takes hold."],
          [
            "gestureend",
            "reason, event",
            "fires when `end()` runs. for a thrown dial, that is when the throw stops.",
          ],
          [
            "settle",
            "nothing",
            "fires each time the last animation stops, springs included.",
          ],
          [
            "frame",
            "{ time, value, state }",
            "fires on every frame that moved. `useCropperFrame` wraps it.",
          ],
          ["stop", "nothing", "fires when `stop()` ends all motion."],
          ["destroy", "nothing", "fires once, when `destroy()` runs."],
        ],
      })
    ),
  ],
  lede: "two callbacks on `Root` report crop changes: `onValueChange` for live ui and `onValueCommit` for saving.",
});
