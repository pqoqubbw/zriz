import { code, defineDoc, intro, p, props, section } from "@/lib/doc/define";

const CROPPER_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "Import it from `@zriz/core`, installed as in [exporting](exporting), give it the photo's size and write to it:"
      ),
      code("cropper/usage.ts"),
      p(
        "A write changes `getValue()` at once. `change` and `commit` fire on the next frame. In React, `Root` makes the cropper for you, and [hooks](hooks) shows how to reach it."
      )
    ),
    section(
      "Options",
      props(
        [
          {
            default: "null",
            name: "image",
            text: "Sets the photo's natural size. Most writes wait for it. A side of about 1e18 or more can drop the tilt and open level",
            type: "Size | null",
          },
          {
            name: "value",
            text: "Sets the start in place of `defaultValue`. `reset()` still goes to `defaultValue`",
            type: "CropValue",
          },
          {
            name: "defaultValue",
            text: "Merges over the core `defaultValue`. The cropper starts here and `reset()` returns here. Read once",
            type: "Partial<CropValue>",
          },
          {
            default: "{ width: 1, height: 1 }",
            name: "minSize",
            text: "Sets the smallest crop in source pixels, along the photo's own sides",
            type: "Size",
          },
          {
            default: "15",
            name: "maxZoom",
            text: "Sets the largest zoom. 1 is the largest crop",
            type: "number",
          },
          {
            default: "26",
            name: "focalLength",
            text: "Sets the lens as a 35 mm equivalent, for perspective correction. At a strong tilt, zriz lengthens a lens too short to keep the photo in front of it. A length that overflows falls back to 26 mm",
            type: "number",
          },
          {
            default: "false",
            name: "disabled",
            text: "Refuses gestures and most writes",
            type: "boolean",
          },
          {
            default: "frameClock()",
            name: "clock",
            text: "Schedules frames. Tests pass a manual one, see test without a browser below",
            type: "Clock",
          },
          {
            name: "onValueChange",
            text: "Runs at most once per frame while the crop moves",
            type: "(value, details) => void",
          },
          {
            name: "onValueCommit",
            text: "Runs when a gesture or write commits",
            type: "(value, details) => void",
          },
          {
            default: "[]",
            name: "plugins",
            text: "Adds behaviour, see add a plugin and clean it up below",
            type: "readonly CropperPlugin[]",
          },
        ],
        "Option"
      ),
      p(
        "`minSize` also caps the angle once its diagonal is longer than a side of the photo. Only its size next to the photo counts, not the photo's pixel count. While `disabled`, `setValue()`, `setImage()` and `setOptions()` still work. Both callbacks are on [events](events)."
      )
    ),
    section(
      "Read the crop",
      props(
        [
          {
            name: "getValue",
            text: "Returns the live [value](value), frames inside a gesture included",
            type: "() => CropValue",
          },
          {
            name: "getState",
            text: "Returns the snapshot that `useCropperState` reads, see [hooks](hooks)",
            type: "() => CropperSnapshot",
          },
          {
            name: "getCropState",
            text: "Returns the crop in image pixels, or `null` before a photo",
            type: "() => CropState | null",
          },
          {
            name: "getZoom",
            text: "Returns the zoom, 1 before a photo loads. 1 is the largest crop that fits",
            type: "() => number",
          },
          {
            name: "getMaxZoom",
            text: "Returns the `maxZoom` option, 15 by default",
            type: "() => number",
          },
          {
            name: "getRotationLimit",
            text: "Returns 45, or less when `minSize` leaves too little room",
            type: "() => number",
          },
          {
            name: "getPixelCrop",
            text: "Returns the export plan, or `null` before a photo, see [exporting](exporting)",
            type: "(scale?) => ExportPlan | null",
          },
        ],
        "Method"
      )
    ),
    section(
      "Change the crop",
      props(
        [
          {
            name: "setValue",
            text: "Merges the fields you pass into the current value",
            type: "(value, options?) => void",
          },
          {
            name: "setRotation",
            text: "Straightens the photo",
            type: "(degrees, options?) => void",
          },
          {
            name: "setZoom",
            text: "Zooms around `anchor`, a point from 0 to 1 on the photo, or the crop's centre",
            type: "(zoom, options?) => void",
          },
          {
            name: "panBy",
            text: "Moves the crop by fractions of the photo's width and height",
            type: "(dx, dy, options?) => void",
          },
          {
            name: "setAspect",
            text: "Locks the crop to an aspect",
            type: "(aspect, options?) => void",
          },
          {
            name: "setCropState",
            text: 'Sets the crop in image pixels. `keep: "center"` holds the centre. The default, `keep: "size"`, holds the size. A state from a photo of another size does nothing, and the state\'s `aspect` and `focal` are ignored',
            type: "(state, options?) => void",
          },
          {
            name: "rotate90",
            text: 'Turns counter-clockwise by default, or clockwise with `"cw"`. A numeric aspect turns with it, so 4:3 becomes 3:4',
            type: "(direction?, options?) => void",
          },
          {
            name: "flip",
            text: 'Mirrors left to right by default. `"y"` mirrors top to bottom',
            type: "(axis?, options?) => void",
          },
          {
            name: "reset",
            text: "Returns to `defaultValue`, with or without a photo",
            type: "(options?) => void",
          },
          {
            name: "setImage",
            text: "Sets the photo's natural size. A new size refits the crop with reason `coverage`. A size that is not finite and positive counts as `null`",
            type: "(size | null) => void",
          },
          {
            name: "setOptions",
            text: "Changes `disabled`, `maxZoom`, `minSize`, `focalLength` and the two callbacks. The type takes only those six. `image`, `value`, `defaultValue`, `clock` and `plugins` stay as created. A new `focalLength` takes effect on the next `setValue()`, `reset()` or `setImage()`. Call `setImage()` for a new photo",
            type: "(options) => void",
          },
        ],
        "Method"
      ),
      p(
        "Every write keeps the crop valid, see [value](value). Before the cropper has a photo, only `setValue()`, `reset()`, `setImage()` and `setOptions()` do anything."
      )
    ),
    section(
      "Tell listeners why",
      p(
        "Every write except `setImage()` and `setOptions()` takes action options last. Outside a gesture, `setValue()`, `setRotation()`, `setZoom()` and `setCropState()` report `imperative` unless you pass a reason. Here the write straightens the photo 5°, and on the next frame the commit logs `5 history`:"
      ),
      code("cropper/action-options.ts"),
      props(
        [
          {
            name: "reason",
            text: "Names the change for listeners, see [events](events)",
            type: "ChangeReason",
          },
          {
            name: "event",
            text: "Passes the DOM event behind the change",
            type: "Event",
          },
          {
            name: "emit",
            text: "With `false`, no change or commit fires, and the new value counts as committed. It also drops a change still waiting from the same frame",
            type: "boolean",
          },
        ],
        "Option"
      )
    ),
    section(
      "Drive the crop from your own input",
      p(
        "Call `begin()` when your input takes hold and `end()` when it lets go. Every write between them is one gesture with one commit. Pass the same `owner` object to both, so no other input can end your gesture:"
      ),
      code("cropper/gesture.ts"),
      props(
        [
          {
            name: "begin",
            text: "Starts a gesture and stops any animation that holds the commit. Returns `false` when the cropper is disabled or another owner holds a gesture. A dial glide or a wheel turn gives way to it",
            type: "(reason, event?, owner?) => boolean",
          },
          {
            name: "end",
            text: "Ends the gesture. The commit follows once blocking tasks stop",
            type: "(event?, owner?) => void",
          },
          {
            name: "cancel",
            text: "Ends the gesture and restores the crop from before it",
            type: "(event?, owner?) => void",
          },
          {
            name: "run",
            text: "Calls `task(time, delta)` every frame until it returns `false`. Blocking tasks, the default, hold the commit back. Returns a cancel function",
            type: "(task, blocking?) => () => void",
          },
          {
            name: "invalidate",
            text: "Asks for one more `frame` event",
            type: "() => void",
          },
          {
            name: "on",
            text: "Listens to one event, see [events](events). Returns a remove function",
            type: "(type, listener) => () => void",
          },
          {
            name: "subscribe",
            text: "Runs the listener when the snapshot changes",
            type: "(listener) => () => void",
          },
        ],
        "Method"
      )
    ),
    section(
      "Test without a browser",
      p(
        "In Node, the default clock waits about 16 ms per frame on `setTimeout`. Pass a clock of your own and step the frames yourself, so every event fires when your test says:"
      ),
      code("cropper/test.ts"),
      p(
        "`setRotation()` changes `getValue()` at once, and `advance(16)` runs the frame that sends the commit. The log reads `[7]`."
      )
    ),
    section(
      "Add a plugin and clean it up",
      p(
        "A plugin is an object with a `name`, an `init` and an optional `destroy`. `init` runs right after `createCropper` makes the cropper. `Root` and `useCropper` take `plugins` too, read them once and run `init` once on the client, after mount, never during a render."
      ),
      code("cropper/plugin.ts"),
      p(
        "`destroy` runs only when you call `destroy()`. `Root` never calls it. When the component that made the cropper unmounts, `Root` or the one that called `useCropper`, it calls `stop()` instead, on purpose: `StrictMode` and `<Activity>` unmount a component and mount the same cropper again, and a destroyed cropper cannot come back."
      ),
      p(
        "If a plugin holds a timer or a socket, call `destroy()` yourself when you are done with the cropper, for example through `actionsRef`."
      ),
      props(
        [
          {
            name: "stop",
            text: "Ends any gesture, drops all motion, commits what is there and emits `stop`. The cropper keeps working",
            type: "() => void",
          },
          {
            name: "destroy",
            text: "Runs each plugin's `destroy`, emits `destroy`, detaches the photo and drops every listener. A change or commit still waiting is dropped, and a running gesture ends with no `gestureend`, so call `stop()` first to send them. The cropper is finished, and every later write is ignored",
            type: "() => void",
          },
        ],
        "Method"
      )
    ),
    section(
      "Read the crop in image pixels",
      p(
        "`getCropState()` and `useCropperFrame` give a `CropState`, and `setCropState()` takes one. `crop.x` and `crop.y` are not a corner. They are the crop's centre measured from the photo's centre, so they can be negative, with x to the right and y down, after the quarter turns."
      ),
      props(
        [
          {
            name: "image",
            text: "The photo's size before any turn",
            type: "Size",
          },
          {
            name: "turns",
            text: "Quarter turns, 0 to 3",
            type: "0 | 1 | 2 | 3",
          },
          { name: "flip", text: "`true` while mirrored", type: "boolean" },
          {
            name: "angle",
            text: "The straighten angle in degrees",
            type: "number",
          },
          {
            name: "crop",
            text: "The crop in image pixels, after the quarter turns",
            type: "{ x, y, width, height }",
          },
          {
            name: "aspect",
            text: "The ratio as a number, or `null` when free",
            type: "number | null",
          },
          {
            name: "perspective",
            text: "The tilt in degrees, with `focal` in pixels",
            type: "{ vertical, horizontal, focal }",
          },
        ],
        "Field"
      )
    ),
  ],
  lede: "`createCropper` makes the store behind every `Root`. Use it for [vanilla JS](vanilla-js), or to test your crop logic without a browser.",
});

export { CROPPER_PAGE };
