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

const VALUE_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "A square crop of a 4032 × 3024 photo, half its height, right of the middle and a little above it, straightened 3°:"
      ),
      code("value/value.ts"),
      p(
        "Outside React, import the type from `@zriz/core`, installed as in [exporting](exporting)."
      ),
      p(
        "`onValueCommit`, `getValue()` and `useCropperValue` all hand you this object. `Root` and `createCropper` take the whole object as `value`, or part of it as `defaultValue`."
      )
    ),
    section(
      "Fields",
      props(
        [
          {
            default: "{ x: 0.5, y: 0.5 }",
            name: "center",
            text: "Marks the middle of the crop. 0.5, 0.5 is the middle of the photo",
            type: "Point",
          },
          {
            default: "{ width: 1, height: 1 }",
            name: "size",
            text: "Sets the crop's width and height as fractions of the photo's sides",
            type: "Size",
          },
          {
            default: "0",
            name: "rotation",
            text: "Straightens the photo, in degrees from −45 to 45. A `minSize` with a diagonal longer than a side of the photo lowers the limit, see `getRotationLimit()` on [cropper](cropper)",
            type: "number",
          },
          {
            default: "0",
            name: "quarterTurns",
            text: "Counts clockwise 90° turns. One counter-clockwise turn reads 3",
            type: "0 | 1 | 2 | 3",
          },
          {
            default: "false",
            name: "mirrored",
            text: "Swaps left and right. Each flip toggles it and negates `rotation`. A left to right flip also turns a `quarterTurns` of 1 into 3, and a top to bottom flip turns 0 into 2",
            type: "boolean",
          },
          {
            default: "{ vertical: 0, horizontal: 0 }",
            name: "perspective",
            text: "Tilts the photo by `vertical` and `horizontal` degrees. No part or gesture sets it, only `setValue()`, `setCropState()`, `value` and `defaultValue`. Keep each within −30 to 30. `parse` clamps to that range, `setValue()` does not",
            type: "object",
          },
          {
            default: '"free"',
            name: "aspect",
            text: 'Locks the crop\'s shape to a ratio such as `16 / 9`, to `"original"` for the photo\'s own shape, or to nothing with `"free"`',
            type: "Aspect",
          },
        ],
        "Field"
      ),
      p(
        "`center` and `size` are fractions of the photo after its quarter turns, never pixels. The same value fits a 400 px preview and the 4032 px original."
      ),
      p(
        "zriz measures each side on its own. The largest square crop of a 4032 × 3024 photo reads `size: { width: 0.75, height: 1 }`."
      ),
      p(
        "There is no zoom field. Zoom follows from `size`, and `getZoom()` returns it: 1 is the largest crop that fits."
      )
    ),
    section(
      "See how zriz fixes a bad value",
      p(
        "zriz keeps every value you set valid. It clamps the angle, reshapes a `size` that misses its `aspect` at the same area, grows a crop below `minSize` or past `maxZoom`, and shrinks or moves a crop that would show an empty corner. Ask for a 90° straighten and you get the limit:"
      ),
      code("value/clamp.ts"),
      p(
        'A field that is not a usable number keeps the value it had, and a write with a usable field that still cannot make a crop, such as `setRotation(NaN)`, is ignored. An `aspect` that is not a number from 0.000001 to 1000000 counts as `"free"`. An option that is not a positive number falls back to its default, but any `maxZoom` below 1, zero and negatives included, counts as 1.'
      ),
      p(
        "A value from zriz is frozen, so one reader cannot change it for the next. Copy it to change a field: `setValue({ ...value, rotation: 2 })`."
      ),
      p(
        "Before a photo loads, zriz stores a value as you set it and fixes it when the photo arrives."
      )
    ),
    section(
      "Control the angle from React state",
      p("Pass `rotation` and update it in `onValueChange`:"),
      code("value/controlled.tsx"),
      p(
        "`rotation`, `zoom` and `aspect` each control one part of the crop. A new prop moves the crop and commits, so `onValueCommit` runs with the whole new value. `onValueChange` stays quiet when each controlled prop lands as passed, even when the crop size moves with it, as it does for a new `aspect`. It runs when zriz applied something else: a rotation of 60 reports 45. To mirror the whole value, write it from both callbacks. A value zriz reported comes back as an answer and does not move the crop, for 2 s after the last report, so a slow store cannot rewind it. If no other answer follows and the crop has not moved since, that value applies when the 2 s end, or 500 ms after it arrived if that is later. A preset equal to a recent report lands late this way, and a value never reported lands at once. Mirror `rotation`, `zoom` or `aspect` from `onValueChange`, not `onValueCommit`: a store slower than 2 s that mirrors commits still flips the crop. Zoom runs from 1 up to `maxZoom`. A prop applied as the photo arrives is silent."
      ),
      p(
        "`value` sets the whole object without calling either callback. Each new object moves the crop, unless zriz reported that same object in the last 2 s, so keep it stable or update it from `onValueChange`. `Reset` still goes to `defaultValue`, not to the last `value`."
      ),
      p(
        "During a gesture and until it commits, zriz ignores a new `value`, `rotation` or `zoom`, so a slow render cannot fight the finger. To snap the crop after a gesture, write it in `onValueCommit`. A new `aspect` applies at once. The `aspect`, `rotation` and `zoom` from the first render become the reset target."
      ),
      p(
        "A prop acts when it changes. `zoom` also acts when a photo of another size arrives: with `zoom={3}` held, the crop goes back to 3 and commits with reason `coverage`. A write ignored during a gesture is not replayed. To limit a gesture, call `details.cancel()`. `rotation={5}` with no handler sets the angle once and the user can move away from it."
      ),
      p(
        "A photo after `null` counts as a first photo: zriz fits your `value` to it and sends nothing. Read `getValue()` if you keep the fitted crop."
      )
    ),
    section(
      "Turn it into text and back",
      p("Save a crop as text and read it back:"),
      code("value/serialize.ts"),
      p(
        '`serialize` adds a version field, `v: 1`. `parse` takes the text or an object you already parsed, and returns `null` when it is not JSON, not an object or carries a `v` other than 1. A value with no `v` still reads. It fills missing fields with defaults, clamps `rotation` to 45 and `perspective` to 30 each way, and turns a bad `aspect` into `"free"`. The full flow is on [saving state](saving-state).'
      )
    ),
    section(
      "Helpers",
      p("A constant and pure functions from `@zriz/core`:"),
      table({
        columns: [column("Export", "mono"), column("What it does", "prose")],
        rows: [
          ["defaultValue", "Is the whole photo, level, with a free aspect"],
          [
            "valuesEqual",
            "Takes `(a, b)` and returns `true` when every field matches",
          ],
          [
            "changedFields",
            "Takes `(a, b)` and returns the names of the fields that differ",
          ],
          [
            "aspectRatio",
            "Takes `(aspect, image, quarterTurns)` and returns the ratio as a number, or `null` for a free aspect",
          ],
          [
            "valueToState",
            "Takes `(value, image, focal?)` and returns the crop in image pixels. `focal` is a length in pixels and defaults to a 26 mm lens on the photo's long side",
          ],
          [
            "stateToValue",
            "Takes `(state, aspect)` and turns a crop in image pixels back into a value",
          ],
        ],
      })
    ),
  ],
  lede: "A plain object that describes the crop. Read it to save a crop, and set it to restore or control one.",
});

export { VALUE_PAGE };
