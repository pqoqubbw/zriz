import {
  code,
  defineDoc,
  intro,
  p,
  part,
  props,
  section,
} from "@/lib/doc/define";

const HOOKS_PAGE = defineDoc({
  blocks: [
    intro(
      p(
        "call a hook in any component inside `Root`. this label reads `edited` once the crop changes:"
      ),
      code("hooks/status.tsx"),
      p(
        "outside `Root`, pass the cropper yourself. it goes last in `useCropperState`, `useCropperValue` and `useCropperFrame`, and in the options of `useZoom`. without it, they throw the error listed on [errors](errors)."
      )
    ),
    section(
      "call methods from your own buttons",
      p(
        "each `Root` runs one cropper. pass a ref to `actionsRef` to reach it once `Root` has mounted. the ref stays set while a suspense boundary shows its fallback, and is `null` while `<Activity>` hides `Root`. when `Root` unmounts, the ref clears with the passive effects, so a parent's `useLayoutEffect` in that commit still reads the cropper. on a keyed remount, the old `Root` lets go after the new one takes the ref. a ref object or a stable callback with no cleanup keeps the new cropper. an inline callback gets `null` last, and a cleanup your callback returns runs last, so neither suits a keyed `Root`. [cropper](cropper) lists its methods."
      ),
      code("hooks/actions-ref.tsx")
    ),
    section(
      "the hooks",
      part(
        "useCropper",
        "`useCropper(options?)` creates the cropper in a component above `Root`. use it when that component needs the cropper during render. hand the cropper to `Root` and to any control:",
        code("hooks/use-cropper.tsx"),
        p(
          "it takes the `createCropper` options on [cropper](cropper) except `clock`, plus the controlled `aspect`, `rotation` and `zoom`, and `cropper` to reuse one you already made. `disabled`, `maxZoom`, `minSize`, `value` and the two callbacks follow later renders. the cropper reads `defaultValue`, `image`, `focalLength` and `plugins` once, when it is made."
        ),
        p(
          "when `Root` gets `cropper`, it ignores its own `defaultValue`, `image`, `focalLength` and `plugins`, because the cropper already exists. give each option to `useCropper` or to `Root`, never to both."
        ),
        p(
          "`Root` frees the photo only for a cropper it made. free a `useCropper` cropper's photo yourself when the component unmounts, with `attachImage(cropper, null)` from `@zriz/core/dom`, as the snippet does. add `@zriz/core` as in [exporting](exporting)."
        ),
        p(
          "`Root` keeps its photo while `<Activity>` hides it. react runs no cleanup when it removes a tree that is hidden, so `Root` cannot free the photo then. to remove a hidden `Root`, make the cropper with `useCropper` above it and call `attachImage(cropper, null)` yourself."
        ),
        p(
          "pass one cropper to one `Root`. `shape`, `motion` and `recenterDelay` belong to the cropper, so a second `Root` overwrites them, even with its defaults. keep `Instructions` in the `Root` that holds `Area`. your own parts and hooks can reach the cropper through `CropperContext` or the `cropper` argument."
        )
      ),
      part(
        "useCropperState",
        "`useCropperState(selector, cropper?)` returns the part of the snapshot you select and renders again when it changes. the snapshot changes when a state flips, never on every frame.",
        props(
          [
            {
              name: "ready",
              text: "is `true` once a photo is loaded and sized",
              type: "boolean",
            },
            {
              name: "interacting",
              text: "names the gesture in progress",
              type: "ChangeReason | null",
            },
            {
              name: "settling",
              text: "is `true` while any animation runs: a thrown dial, the recentre, a rotate or flip",
              type: "boolean",
            },
            {
              name: "pristine",
              text: "is `true` while the crop matches the reset value",
              type: "boolean",
            },
            {
              name: "disabled",
              text: "is `true` while the cropper refuses gestures and most writes, see [cropper](cropper)",
              type: "boolean",
            },
            {
              name: "aspect",
              text: "holds the current aspect",
              type: "Aspect",
            },
            {
              name: "quarterTurns",
              text: "holds the current quarter turns",
              type: "0 | 1 | 2 | 3",
            },
            {
              name: "mirrored",
              text: "is `true` while the photo is flipped",
              type: "boolean",
            },
            {
              name: "committed",
              text: "holds the last committed value",
              type: "CropValue",
            },
          ],
          "field"
        ),
        p(
          "return one field or a primitive. a selector that builds a new object or array on every call makes react render forever."
        )
      ),
      part(
        "useCropperValue",
        "`useCropperValue(cropper?)` returns the last committed value and renders once per commit. a new `value` prop and writes with `emit: false` change it without a commit, so the hook does not render for them. the first fit when a photo loads does not commit either, but the hook renders when a photo arrives or leaves, so it shows that fit. the fields are on [value](value).",
        code("hooks/use-cropper-value.tsx")
      ),
      part(
        "useCropperFrame",
        "`useCropperFrame(listener, cropper?)` calls the listener on every frame that moved, without a render. the frame holds `time`, `value` and `state`, the crop in image pixels, which is `null` before a photo loads. write the live angle straight into the dom:",
        code("hooks/use-cropper-frame.tsx")
      ),
      part(
        "useZoom",
        "`useZoom(options?)` connects a slider of your own to the zoom. each drag counts as one `zoom-control` gesture on [events](events). it takes two options, `max` and `cropper`. [zoom](zoom) builds a range input with it. it returns:",
        props(
          [
            {
              name: "value",
              text: "holds the zoom rounded to 3 decimals. it updates every frame",
              type: "number",
            },
            {
              name: "min",
              text: "is always 1, the largest crop",
              type: "number",
            },
            {
              name: "max",
              text: "is the `max` option, or the cropper's `maxZoom`, 15 by default. `max` sets the slider's range only. the cropper still stops at `maxZoom`",
              type: "number",
            },
            {
              name: "dragging",
              text: "is `true` while a drag runs",
              type: "boolean",
            },
            {
              name: "onValueChange",
              text: "starts the gesture on the first call and sets the zoom",
              type: "(zoom) => void",
            },
            {
              name: "onValueCommitted",
              text: "ends the gesture. call it when the slider lets go",
              type: "() => void",
            },
          ],
          "field"
        )
      ),
      part(
        "useCoverScale",
        "`useCoverScale({ image, crop, rotation })` returns the smallest scale that keeps a straightened photo free of empty corners, for a crop centred on it. it calls no react hooks, so it is safe in loops and conditions. outside react, `coverScale(image, crop, radians)` from `@zriz/core`, installed as in [exporting](exporting), does the same.",
        code("hooks/use-cover-scale.tsx"),
        p(
          "a full-frame crop of a 4032 × 3024 photo, straightened 5°, needs 1.1124. the photo grows 11.2%."
        )
      ),
      part(
        "useRender",
        "`useRender(options)` renders an element the way every zriz part does. use it to build a part of your own. this is the label from the top of the page as a part:",
        code("hooks/use-render.tsx"),
        p(
          "your part follows the `render` and `className` rules on [composition](composition). it takes:"
        ),
        props(
          [
            {
              name: "tag",
              required: true,
              text: 'sets the tag, for example `"span"`',
              type: "keyof JSX.IntrinsicElements",
            },
            {
              name: "state",
              required: true,
              text: "goes to `render` and `className` functions",
              type: "S",
            },
            {
              name: "props",
              required: true,
              text: "sets the element's props. take `render` and your own props out first, as the parts do",
              type: "object",
            },
            {
              name: "ref",
              text: "attaches to the element",
              type: "Ref<Element>",
            },
            {
              name: "render",
              text: "replaces the element, as on every part",
              type: "RenderProp<S>",
            },
            {
              name: "className",
              text: "sets the class: a string, or a function of state",
              type: "ClassName<S>",
            },
          ],
          "option"
        )
      )
    ),
  ],
  lede: "seven hooks from `@zriz/react` that read the cropper and build parts of your own.",
});

export { HOOKS_PAGE };
