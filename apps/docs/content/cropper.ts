import { code, defineDoc, intro, p, props, section } from "@/lib/doc/define";

export const cropper = defineDoc({
  blocks: [
    intro(
      p(
        "import it from `@zriz/core`, installed as in [exporting](exporting), give it the photo's size and write to it:"
      ),
      code("cropper/usage.ts"),
      p(
        "a write changes `getValue()` at once. `change` and `commit` fire on the next frame. in react, `Root` makes the cropper for you, and [hooks](hooks) shows how to reach it."
      )
    ),
    section(
      "options",
      props(
        [
          {
            default: "null",
            name: "image",
            text: "sets the photo's natural size. most writes wait for it.",
            type: "Size | null",
          },
          {
            name: "value",
            text: "sets the start in place of `defaultValue`. `reset()` still goes to `defaultValue`.",
            type: "CropValue",
          },
          {
            name: "defaultValue",
            text: "merges over the core `defaultValue`. the cropper starts here and `reset()` returns here. read once.",
            type: "Partial<CropValue>",
          },
          {
            default: "{ width: 1, height: 1 }",
            name: "minSize",
            text: "sets the smallest crop in source pixels.",
            type: "Size",
          },
          {
            default: "15",
            name: "maxZoom",
            text: "sets the largest zoom. 1 is the largest crop.",
            type: "number",
          },
          {
            default: "26",
            name: "focalLength",
            text: "sets the lens as a 35 mm equivalent, for perspective correction.",
            type: "number",
          },
          {
            default: "false",
            name: "disabled",
            text: "refuses gestures and most writes.",
            type: "boolean",
          },
          {
            default: "frameClock()",
            name: "clock",
            text: "schedules frames. tests pass a manual one, see test without a browser below",
            type: "Clock",
          },
          {
            name: "onValueChange",
            text: "runs at most once per frame while the crop moves.",
            type: "(value, details) => void",
          },
          {
            name: "onValueCommit",
            text: "runs when a gesture or write commits.",
            type: "(value, details) => void",
          },
          {
            default: "[]",
            name: "plugins",
            text: "adds behaviour, see add a plugin and clean it up below",
            type: "readonly CropperPlugin[]",
          },
        ],
        "option"
      ),
      p(
        "`minSize` also caps the angle on tiny photos. while `disabled`, `setValue()`, `setImage()` and `setOptions()` still work. both callbacks are on [events](events)."
      )
    ),
    section(
      "read the crop",
      props(
        [
          {
            name: "getValue",
            text: "returns the live [value](value), frames inside a gesture included.",
            type: "() => CropValue",
          },
          {
            name: "getState",
            text: "returns the snapshot that `useCropperState` reads, see [hooks](hooks).",
            type: "() => CropperSnapshot",
          },
          {
            name: "getCropState",
            text: "returns the crop in image pixels, or `null` before a photo.",
            type: "() => CropState | null",
          },
          {
            name: "getZoom",
            text: "returns the zoom, 1 before a photo loads. 1 is the largest crop that fits.",
            type: "() => number",
          },
          {
            name: "getMaxZoom",
            text: "returns the `maxZoom` option, 15 by default.",
            type: "() => number",
          },
          {
            name: "getRotationLimit",
            text: "returns 45, or less when `minSize` leaves too little room.",
            type: "() => number",
          },
          {
            name: "getPixelCrop",
            text: "returns the export plan, or `null` before a photo, see [exporting](exporting).",
            type: "(scale?) => ExportPlan | null",
          },
        ],
        "method"
      )
    ),
    section(
      "change the crop",
      props(
        [
          {
            name: "setValue",
            text: "merges the fields you pass into the current value.",
            type: "(value, options?) => void",
          },
          {
            name: "setRotation",
            text: "straightens the photo.",
            type: "(degrees, options?) => void",
          },
          {
            name: "setZoom",
            text: "zooms around `anchor`, a point from 0 to 1 on the photo, or the crop's centre.",
            type: "(zoom, options?) => void",
          },
          {
            name: "panBy",
            text: "moves the crop by fractions of the photo's width and height.",
            type: "(dx, dy, options?) => void",
          },
          {
            name: "setAspect",
            text: "locks the crop to an aspect.",
            type: "(aspect, options?) => void",
          },
          {
            name: "setCropState",
            text: 'sets the crop in image pixels. `keep: "centre"` holds the centre. the default, `keep: "size"`, holds the size.',
            type: "(state, options?) => void",
          },
          {
            name: "rotate90",
            text: 'turns counter-clockwise by default, or clockwise with `"cw"`. a numeric aspect turns with it, so 4:3 becomes 3:4.',
            type: "(direction?, options?) => void",
          },
          {
            name: "flip",
            text: 'mirrors left to right by default. `"y"` mirrors top to bottom.',
            type: "(axis?, options?) => void",
          },
          {
            name: "reset",
            text: "returns to `defaultValue`, with or without a photo.",
            type: "(options?) => void",
          },
          {
            name: "setImage",
            text: "sets the photo's natural size. a new size refits the crop with reason `coverage`. a size that is not finite and positive counts as `null`.",
            type: "(size | null) => void",
          },
          {
            name: "setOptions",
            text: "changes `disabled`, `maxZoom`, `minSize`, `focalLength` and the two callbacks. `image`, `value`, `defaultValue`, `clock` and `plugins` stay as created. a new `focalLength` takes effect on the next `setValue()`, `reset()` or `setImage()`. call `setImage()` for a new photo.",
            type: "(options) => void",
          },
        ],
        "method"
      ),
      p(
        "every write keeps the crop valid, see [value](value). before the cropper has a photo, only `setValue()`, `reset()`, `setImage()` and `setOptions()` do anything."
      )
    ),
    section(
      "tell listeners why",
      p(
        "every write except `setImage()` and `setOptions()` takes action options last. outside a gesture, `setValue()`, `setRotation()`, `setZoom()` and `setCropState()` report `imperative` unless you pass a reason. here the write straightens the photo 5°, and on the next frame the commit logs `5 history`:"
      ),
      code("cropper/action-options.ts"),
      props(
        [
          {
            name: "reason",
            text: "names the change for listeners, see [events](events).",
            type: "ChangeReason",
          },
          {
            name: "event",
            text: "passes the dom event behind the change.",
            type: "Event",
          },
          {
            name: "emit",
            text: "with `false`, no change or commit fires, and the new value counts as committed. it also drops a change still waiting from the same frame.",
            type: "boolean",
          },
        ],
        "option"
      )
    ),
    section(
      "drive the crop from your own input",
      p(
        "call `begin()` when your input takes hold and `end()` when it lets go. every write between them is one gesture with one commit. pass the same `owner` object to both, so no other input can end your gesture:"
      ),
      code("cropper/gesture.ts"),
      props(
        [
          {
            name: "begin",
            text: "starts a gesture and stops any animation that holds the commit. returns `false` when the cropper is disabled or another owner holds a gesture.",
            type: "(reason, event?, owner?) => boolean",
          },
          {
            name: "end",
            text: "ends the gesture. the commit follows once blocking tasks stop.",
            type: "(event?, owner?) => void",
          },
          {
            name: "cancel",
            text: "ends the gesture and restores the crop from before it.",
            type: "(event?, owner?) => void",
          },
          {
            name: "run",
            text: "calls `task(time, delta)` every frame until it returns `false`. blocking tasks, the default, hold the commit back. returns a cancel function.",
            type: "(task, blocking?) => () => void",
          },
          {
            name: "invalidate",
            text: "asks for one more `frame` event.",
            type: "() => void",
          },
          {
            name: "on",
            text: "listens to one event, see [events](events). returns a remove function.",
            type: "(type, listener) => () => void",
          },
          {
            name: "subscribe",
            text: "runs the listener when the snapshot changes.",
            type: "(listener) => () => void",
          },
        ],
        "method"
      )
    ),
    section(
      "test without a browser",
      p(
        "in node, the default clock waits about 16 ms per frame on `setTimeout`. pass a clock of your own and step the frames yourself, so every event fires when your test says:"
      ),
      code("cropper/test.ts"),
      p(
        "`setRotation()` changes `getValue()` at once, and `advance(16)` runs the frame that sends the commit. the log reads `[7]`."
      )
    ),
    section(
      "add a plugin and clean it up",
      p(
        "a plugin is an object with a `name`, an `init` and an optional `destroy`. `init` runs right after `createCropper` makes the cropper. `Root` takes `plugins` too and reads them once."
      ),
      code("cropper/plugin.ts"),
      p(
        "`destroy` runs only when you call `destroy()`. `Root` never calls it. when the component that made the cropper unmounts, `Root` or the one that called `useCropper`, it calls `stop()` instead, on purpose: `StrictMode` and `<Activity>` unmount a component and mount the same cropper again, and a destroyed cropper cannot come back."
      ),
      p(
        "if a plugin holds a timer or a socket, call `destroy()` yourself when you are done with the cropper, for example through `actionsRef`."
      ),
      props(
        [
          {
            name: "stop",
            text: "ends any gesture, drops all motion, commits what is there and emits `stop`. the cropper keeps working.",
            type: "() => void",
          },
          {
            name: "destroy",
            text: "runs each plugin's `destroy`, emits `destroy` and drops every listener. the cropper is finished, and every later write is ignored.",
            type: "() => void",
          },
        ],
        "method"
      )
    ),
  ],
  lede: "`createCropper` makes the store behind every `Root`. use it for [vanilla js](vanilla-js), or to test your crop logic without a browser.",
});
