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

const EVENTS_PAGE = defineDoc({
  blocks: [
    intro(
      code("events/usage.jsx.tsx"),
      p(
        "`onValueChange` runs at most once per frame while the crop moves. `onValueCommit` runs once when a gesture or a write is done. `createCropper` takes the same two options."
      )
    ),
    section(
      "Save when the user lets go",
      p(
        "A drag, a pinch or a turn of the dial commits once, when the finger lifts. A thrown dial commits when it stops. A key on `Area`, `Dial` or `Zoom` commits once when it comes up, however long it was held, or when focus leaves. A write such as `rotate90()` commits on the next frame, and the turn you see animates after it. A gesture that ends where it started does not commit. The first photo, or a photo after `null`, fits the crop without a commit. A later photo commits only when fitting it changes the value, such as a locked aspect on a photo of another shape, and that commit has the reason `coverage`. To save a photo nobody touched, read `getValue()` or `getPixelCrop()` from the cropper in `actionsRef`, see [cropper](cropper)."
      ),
      p(
        "`stop()` and unmount commit synchronously. React warns if `onValueCommit` calls `flushSync` inside that unmount, so leave `flushSync` out of the handler."
      ),
      code("events/commit.jsx.tsx")
    ),
    section(
      "Follow one gesture from start to commit",
      p("Log both callbacks, then throw the dial:"),
      code("events/log.jsx.tsx"),
      table({
        columns: [column("Log", "mono"), column("When", "prose")],
        rows: [
          ["dial start", "The first frame the dial turns"],
          ["dial move", "Every later frame of the drag and of the throw"],
          ["dial end", "The last frame of the throw"],
          ["dial commit", "`onValueCommit`, in the same frame"],
        ],
      }),
      p(
        "A drag that stops before the finger lifts has no `end`, and its last `move` goes straight to the commit. A write outside a gesture logs one `instant` change, then its commit."
      )
    ),
    section(
      "Reject a change",
      p(
        "Call `details.cancel()` and the crop snaps back to where the last change left it. This keeps the angle within 10° each way:"
      ),
      code("events/cancel.jsx.tsx")
    ),
    section(
      "Change details",
      p("The second argument of `onValueChange`:"),
      props(
        [
          {
            name: "reason",
            text: "Names what moved the crop, see reasons below",
            type: "ChangeReason",
          },
          {
            name: "phase",
            text: "Is `start`, `move`, `end` or `instant`, see the order above",
            type: "ChangePhase",
          },
          {
            name: "changed",
            text: "Lists the fields that moved. Never empty",
            type: "readonly ValueField[]",
          },
          {
            name: "previous",
            text: "Holds what the last change left",
            type: "CropValue",
          },
          {
            name: "event",
            text: "Holds the DOM event behind the change",
            type: "Event | undefined",
          },
          { name: "cancel", text: "Rejects this change", type: "() => void" },
          {
            name: "isCanceled",
            text: "Is `true` once `cancel()` ran",
            type: "boolean",
          },
        ],
        "Field"
      )
    ),
    section(
      "Commit details",
      p("The second argument of `onValueCommit`:"),
      props(
        [
          {
            name: "reason",
            text: "Names the gesture or write behind the commit",
            type: "ChangeReason",
          },
          {
            name: "previous",
            text: "Holds the last committed value. Push it to a stack for [undo](undo)",
            type: "CropValue",
          },
          {
            name: "pixelCrop",
            text: "Holds the export plan at scale 1 in source pixels, or `null` before a photo loads. Use it for your own tools. [Server crop](server-crop) sends the value from `getValue()` and recomputes the plan on the server, see [exporting](exporting)",
            type: "ExportPlan | null",
          },
          {
            name: "event",
            text: "Holds the event that ended the gesture, or the one passed with the write",
            type: "Event | undefined",
          },
        ],
        "Field"
      )
    ),
    section(
      "Reasons",
      p(
        "Every change and commit names its reason. Inside a gesture, a write without its own reason reports the gesture's reason."
      ),
      table({
        columns: [column("Reason", "mono"), column("Sent by", "prose")],
        rows: [
          ["pan", "One finger or pointer dragging the photo, and `panBy()`"],
          [
            "pinch",
            "Two fingers pinching or twisting, or a trackpad pinch in Safari",
          ],
          ["wheel", "A mouse wheel or trackpad scrolling or zooming the photo"],
          ["resize", "A handle being dragged"],
          ["dial", "The dial being dragged or thrown"],
          [
            "keyboard",
            "Keys on `Area` and `Dial`. Keys on `Zoom` report `zoom-control` on each change and `keyboard` on the commit",
          ],
          [
            "zoom-control",
            "The `Zoom` slider, `ZoomStep` buttons and `useZoom`",
          ],
          [
            "aspect",
            "`AspectItem` buttons, `setAspect()` and the `aspect` prop",
          ],
          [
            "orientation",
            "The `Orientation` button, which swaps portrait and landscape",
          ],
          ["rotate-90", "`Rotate` buttons and `rotate90()`"],
          ["flip", "`Flip` buttons and `flip()`"],
          ["reset", "`Reset` and `reset()`"],
          [
            "coverage",
            "A later photo of another size, or new options, that refit the crop. The first photo sends nothing",
          ],
          [
            "history",
            "Your own writes only. zriz never sends it, so [undo](undo) can skip those writes. `Root` animates them like `reset()`",
          ],
          [
            "controlled",
            'The `rotation` and `zoom` props, on the commit and on a change when zriz applied another value, and `shape="circle"` setting the aspect to 1 without a morph. A new `value` prop sends nothing',
          ],
          [
            "imperative",
            "`setValue()`, `setRotation()`, `setZoom()` and `setCropState()` called outside a gesture without a reason",
          ],
        ],
      })
    ),
    section(
      "Listen on the cropper",
      p(
        'The cropper emits the two callbacks as `change` and `commit`, plus six more events. Under `Root` or `useCropper`, `change` also fires when a controlled prop lands as passed, which `onValueChange` skips. In React, make the cropper with `useCropper` and listen in an effect: `useEffect(() => cropper.on("settle", onSettle), [cropper])`, see [hooks](hooks). `createCropper` comes from `@zriz/core`, installed as in [exporting](exporting). `on()` returns a function that removes the listener:'
      ),
      code("events/on.ts"),
      table({
        columns: [
          column("Event", "mono", { width: 92 }),
          column("Listener gets", "mono", { width: 168 }),
          column("What it does", "prose"),
        ],
        rows: [
          ["gesturestart", "reason, event", "Fires when an input takes hold"],
          [
            "gestureend",
            "reason, event",
            "Fires when `end()` runs. For a thrown dial, that is when the throw stops",
          ],
          [
            "settle",
            "nothing",
            "Fires each time the last animation stops, springs included. `stop()` ends motion with no `settle`, so listen to `stop` for that case",
          ],
          [
            "frame",
            "{ time, value, state }",
            "Fires on every frame that moved. `useCropperFrame` wraps it",
          ],
          ["stop", "nothing", "Fires when `stop()` ends all motion"],
          ["destroy", "nothing", "Fires once, when `destroy()` runs"],
        ],
      }),
      p(
        "A listener that throws stops nothing. The other listeners still run, the crop keeps working, and the error comes back as an uncaught error on a microtask."
      )
    ),
  ],
  lede: "Two callbacks on `Root` report crop changes: `onValueChange` for live UI and `onValueCommit` for saving.",
});

export { EVENTS_PAGE };
