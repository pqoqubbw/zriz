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
        "a square crop of a 4032 × 3024 photo, half its height, right of the middle and a little above it, straightened 3°:"
      ),
      code("value/value.ts"),
      p(
        "outside react, import the type from `@zriz/core`, installed as in [exporting](exporting)."
      ),
      p(
        "`onValueCommit`, `getValue()` and `useCropperValue` all hand you this object. `Root` and `createCropper` take the whole object as `value`, or part of it as `defaultValue`."
      )
    ),
    section(
      "fields",
      props(
        [
          {
            default: "{ x: 0.5, y: 0.5 }",
            name: "center",
            text: "marks the middle of the crop. 0.5, 0.5 is the middle of the photo",
            type: "Point",
          },
          {
            default: "{ width: 1, height: 1 }",
            name: "size",
            text: "sets the crop's width and height as fractions of the photo's sides",
            type: "Size",
          },
          {
            default: "0",
            name: "rotation",
            text: "straightens the photo, in degrees from −45 to 45. a big `minSize` on a small photo lowers the limit, see `getRotationLimit()` on [cropper](cropper)",
            type: "number",
          },
          {
            default: "0",
            name: "quarterTurns",
            text: "counts clockwise 90° turns. one counter-clockwise turn reads 3",
            type: "0 | 1 | 2 | 3",
          },
          {
            default: "false",
            name: "mirrored",
            text: "swaps left and right. each flip toggles it and negates `rotation`. a left to right flip also turns a `quarterTurns` of 1 into 3, and a top to bottom flip turns 0 into 2",
            type: "boolean",
          },
          {
            default: "{ vertical: 0, horizontal: 0 }",
            name: "perspective",
            text: "tilts the photo by `vertical` and `horizontal` degrees. no part or gesture sets it, only `setValue()`, `value` and `defaultValue`. keep each within −30 to 30. `parse` clamps to that range, `setValue()` does not",
            type: "object",
          },
          {
            default: '"free"',
            name: "aspect",
            text: 'locks the crop\'s shape to a ratio such as `16 / 9`, to `"original"` for the photo\'s own shape, or to nothing with `"free"`',
            type: "Aspect",
          },
        ],
        "field"
      ),
      p(
        "`center` and `size` are fractions of the photo after its quarter turns, never pixels. the same value fits a 400 px preview and the 4032 px original."
      ),
      p(
        "zriz measures each side on its own. the largest square crop of a 4032 × 3024 photo reads `size: { width: 0.75, height: 1 }`."
      ),
      p(
        "there is no zoom field. zoom follows from `size`, and `getZoom()` returns it: 1 is the largest crop that fits."
      )
    ),
    section(
      "see how zriz fixes a bad value",
      p(
        "zriz keeps every value you set valid. it clamps the angle, reshapes a `size` that misses its `aspect` at the same area, grows a crop below `minSize` or past `maxZoom`, and shrinks or moves a crop that would show an empty corner. ask for a 90° straighten and you get the limit:"
      ),
      code("value/clamp.ts"),
      p(
        'a field that is not a usable number keeps the value it had, and a write with a usable field that still cannot make a crop, such as `setRotation(NaN)`, is ignored. an `aspect` that is not a number from 0.000001 to 1000000 counts as `"free"`. an option that is not a positive number falls back to its default, but any `maxZoom` below 1, zero and negatives included, counts as 1.'
      ),
      p(
        "a value from zriz is frozen, so one reader cannot change it for the next. copy it to change a field: `setValue({ ...value, rotation: 2 })`."
      ),
      p(
        "before a photo loads, zriz stores a value as you set it and fixes it when the photo arrives."
      )
    ),
    section(
      "control the angle from react state",
      p("pass `rotation` and update it in `onValueChange`:"),
      code("value/controlled.tsx"),
      p(
        "`rotation`, `zoom` and `aspect` each control one part of the crop. a new prop moves the crop and commits, so `onValueCommit` runs. `onValueChange` runs only when zriz applied something other than what you passed: a rotation of 60 reports 45. a value zriz reported comes back as an answer and does not move the crop, for 2 s after the last report, so a slow store cannot rewind it. if no other answer follows and the crop has not moved since, that value applies when the 2 s end. a preset equal to a recent report lands late this way, and a value never reported lands at once. mirror from `onValueChange`, not `onValueCommit`: a store slower than 2 s that mirrors commits still flips the crop. zoom runs from 1 up to `maxZoom`. a prop applied as the photo arrives is silent."
      ),
      p(
        "`value` sets the whole object without calling either callback. each new object moves the crop, unless zriz reported that same object in the last 2 s, so keep it stable or update it from `onValueChange`. `Reset` still goes to `defaultValue`, not to the last `value`."
      ),
      p(
        "during a gesture and until it commits, zriz ignores a new `value`, `rotation` or `zoom`, so a slow render cannot fight the finger. to snap the crop after a gesture, write it in `onValueCommit`. a new `aspect` applies at once. the `aspect`, `rotation` and `zoom` from the first render become the reset target."
      ),
      p(
        "a prop acts when it changes. a write ignored during a gesture is not replayed. to limit a gesture, call `details.cancel()`. `rotation={5}` with no handler sets the angle once and the user can move away from it."
      ),
      p(
        "a photo after `null` counts as a first photo: zriz fits your `value` to it and sends nothing. read `getValue()` if you keep the fitted crop."
      )
    ),
    section(
      "turn it into text and back",
      p("save a crop as text and read it back:"),
      code("value/serialize.ts"),
      p(
        '`serialize` adds a version field, `v: 1`. `parse` takes the text or an object you already parsed, and returns `null` when it is not json, not an object or carries a `v` other than 1. a value with no `v` still reads. it fills missing fields with defaults, clamps `rotation` to 45 and `perspective` to 30 each way, and turns a bad `aspect` into `"free"`. the full flow is on [saving state](saving-state).'
      )
    ),
    section(
      "helpers",
      p("a constant and pure functions from `@zriz/core`:"),
      table({
        columns: [column("export", "mono"), column("what it does", "prose")],
        rows: [
          ["defaultValue", "is the whole photo, level, with a free aspect"],
          [
            "valuesEqual",
            "takes `(a, b)` and returns `true` when every field matches",
          ],
          [
            "changedFields",
            "takes `(a, b)` and returns the names of the fields that differ",
          ],
          [
            "aspectRatio",
            "takes `(aspect, image, quarterTurns)` and returns the ratio as a number, or `null` for a free aspect",
          ],
          [
            "valueToState",
            "takes `(value, image, focal?)` and returns the crop in image pixels. `focal` is a length in pixels and defaults to a 26 mm lens on the photo's long side",
          ],
          [
            "stateToValue",
            "takes `(state, aspect)` and turns a crop in image pixels back into a value",
          ],
        ],
      })
    ),
  ],
  lede: "a plain object that describes the crop. read it to save a crop, and set it to restore or control one.",
});

export { VALUE_PAGE };
