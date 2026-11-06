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
        "Call a hook in any component inside `Root`. This label reads `edited` once the crop changes:"
      ),
      code("hooks/status.tsx"),
      p(
        "Outside `Root`, pass the cropper yourself. It goes last in `useCropperState`, `useCropperValue` and `useCropperFrame`, and in the options of `useZoom`. Without it, they throw the error listed on [errors](errors)."
      )
    ),
    section(
      "Call methods from your own buttons",
      p(
        "Each `Root` runs one cropper. Pass a ref to `actionsRef` to reach it once `Root` has mounted. The ref stays set while a suspense boundary shows its fallback, and is `null` while `<Activity>` hides `Root`. When `Root` unmounts, the ref clears with the passive effects, so a parent's `useLayoutEffect` in that commit still reads the cropper. On a keyed remount, the old `Root` lets go after the new one takes the ref. A ref object or a stable callback with no cleanup keeps the new cropper. An inline callback gets `null` last, and a cleanup your callback returns runs last, so neither suits a keyed `Root`. [Cropper](cropper) lists its methods."
      ),
      code("hooks/actions-ref.tsx")
    ),
    section(
      "The hooks",
      part(
        "useCropper",
        "`useCropper(options?)` creates the cropper in a component above `Root`. Use it when that component needs the cropper during render. Hand the cropper to `Root` and to any control:",
        code("hooks/use-cropper.tsx"),
        p(
          "It takes the `createCropper` options on [cropper](cropper) except `clock`, plus the controlled `aspect`, `rotation` and `zoom`, and `cropper` to reuse one you already made. `disabled`, `maxZoom`, `minSize`, `value` and the two callbacks follow later renders. The cropper reads `defaultValue`, `image`, `focalLength` and `plugins` once, when it is made."
        ),
        p(
          "When `Root` gets `cropper`, it ignores its own `defaultValue`, `image`, `focalLength` and `plugins`, because the cropper already exists. Give each option to `useCropper` or to `Root`, never to both."
        ),
        p(
          "`Root` frees the photo only for a cropper it made. Free a `useCropper` cropper's photo yourself when the component unmounts, with `attachImage(cropper, null)` from `@zriz/core/dom`, as the snippet does. Add `@zriz/core` as in [exporting](exporting)."
        ),
        p(
          "`Root` keeps its photo while `<Activity>` hides it. React runs no cleanup when it removes a tree that is hidden, so `Root` cannot free the photo then. To remove a hidden `Root`, make the cropper with `useCropper` above it and call `attachImage(cropper, null)` yourself."
        ),
        p(
          "Pass one cropper to one `Root`. `shape`, `motion` and `recenterDelay` belong to the cropper, so a second `Root` overwrites them, even with its defaults. Keep `Instructions` in the `Root` that holds `Area`. Your own parts and hooks can reach the cropper through `CropperContext` or the `cropper` argument."
        )
      ),
      part(
        "useCropperState",
        "`useCropperState(selector, cropper?)` returns the part of the snapshot you select and renders again when it changes. The snapshot changes when a state flips, never on every frame.",
        props(
          [
            {
              name: "ready",
              text: "Is `true` once the cropper knows the photo's size. The `image` option makes it `true` before the file loads, so wait for `onLoad` before you export",
              type: "boolean",
            },
            {
              name: "interacting",
              text: "Names the gesture in progress",
              type: "ChangeReason | null",
            },
            {
              name: "settling",
              text: "Is `true` while any animation runs: a thrown dial, the recentre, a rotate or flip",
              type: "boolean",
            },
            {
              name: "pristine",
              text: "Is `true` while the crop matches the reset value",
              type: "boolean",
            },
            {
              name: "disabled",
              text: "Is `true` while the cropper refuses gestures and most writes, see [cropper](cropper)",
              type: "boolean",
            },
            {
              name: "aspect",
              text: "Holds the current aspect",
              type: "Aspect",
            },
            {
              name: "quarterTurns",
              text: "Holds the current quarter turns",
              type: "0 | 1 | 2 | 3",
            },
            {
              name: "mirrored",
              text: "Is `true` while the photo is flipped",
              type: "boolean",
            },
            {
              name: "committed",
              text: "Holds the last committed value",
              type: "CropValue",
            },
          ],
          "Field"
        ),
        p(
          "Return one field or a primitive. A selector that builds a new object or array on every call makes React render forever."
        )
      ),
      part(
        "useCropperValue",
        "`useCropperValue(cropper?)` returns the last committed value and renders once per commit. A new `value` prop and writes with `emit: false` change it without a commit, so the hook does not render for them. The first fit when a photo loads does not commit either, but the hook renders when a photo arrives or leaves, so it shows that fit. The fields are on [value](value).",
        code("hooks/use-cropper-value.tsx")
      ),
      part(
        "useCropperFrame",
        "`useCropperFrame(listener, cropper?)` calls the listener on every frame that moved, without a render. The frame holds `time`, `value` and `state`, the crop in image pixels, which is `null` before a photo loads. [Cropper](cropper) lists its fields. Write the live angle straight into the DOM:",
        code("hooks/use-cropper-frame.tsx")
      ),
      part(
        "useZoom",
        "`useZoom(options?)` connects a slider of your own to the zoom. Each drag counts as one `zoom-control` gesture on [events](events). It takes two options, `max` and `cropper`. [Zoom](zoom) builds a range input with it. It returns:",
        props(
          [
            {
              name: "value",
              text: "Holds the zoom rounded to 3 decimals. It updates every frame",
              type: "number",
            },
            {
              name: "min",
              text: "Is always 1, the largest crop",
              type: "number",
            },
            {
              name: "max",
              text: "Is the `max` option, or the cropper's `maxZoom`, 15 by default. `max` sets the slider's range only. The cropper still stops at `maxZoom`",
              type: "number",
            },
            {
              name: "dragging",
              text: "Is `true` while the cropper has a `zoom-control` gesture open, so every `Zoom` and every `useZoom` on one cropper reads the same. A press on `Zoom` holds it until release. A `useZoom` change holds it until the last held pointer or key lifts, or, with nothing held, 150 ms after the last change",
              type: "boolean",
            },
            {
              name: "onValueChange",
              text: "Starts the gesture on the first call and sets the zoom. With no pointer or key held, the gesture ends 150 ms after the last call",
              type: "(zoom) => void",
            },
            {
              name: "onValueCommitted",
              text: "Ends the gesture. Call it when the slider lets go. The hook also ends it when the last held pointer or key lifts anywhere in the window, when the window loses focus and on unmount",
              type: "() => void",
            },
          ],
          "Field"
        )
      ),
      part(
        "useCoverScale",
        "`useCoverScale({ image, crop, rotation })` returns the smallest scale that keeps a straightened photo free of empty corners, for a crop centred on it. It calls no React hooks, so it is safe in loops and conditions. Outside React, `coverScale(image, crop, radians)` from `@zriz/core`, installed as in [exporting](exporting), does the same.",
        code("hooks/use-cover-scale.tsx"),
        p(
          "A full-frame crop of a 4032 × 3024 photo, straightened 5°, needs 1.1124. The photo grows 11.2%."
        )
      ),
      part(
        "useRender",
        "`useRender(options)` renders an element the way every zriz part does. Use it to build a part of your own. This is the label from the top of the page as a part:",
        code("hooks/use-render.tsx"),
        p(
          "Your part follows the `render` and `className` rules on [composition](composition). It takes:"
        ),
        props(
          [
            {
              name: "tag",
              required: true,
              text: 'Sets the tag, for example `"span"`',
              type: "keyof JSX.IntrinsicElements",
            },
            {
              name: "state",
              required: true,
              text: "Goes to `render` and `className` functions",
              type: "S",
            },
            {
              name: "props",
              required: true,
              text: "Sets the element's props. Take `render` and your own props out first, as the parts do",
              type: "object",
            },
            {
              name: "ref",
              text: "Attaches to the element",
              type: "Ref<Element>",
            },
            {
              name: "render",
              text: "Replaces the element, as on every part",
              type: "RenderProp<S>",
            },
            {
              name: "className",
              text: "Sets the class: a string, or a function of state",
              type: "ClassName<S>",
            },
          ],
          "Option"
        )
      )
    ),
  ],
  lede: "Seven hooks from `@zriz/react` that read the cropper and build parts of your own.",
});

export { HOOKS_PAGE };
