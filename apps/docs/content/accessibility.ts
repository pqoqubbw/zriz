import {
  code,
  column,
  defineDoc,
  p,
  part,
  props,
  section,
  table,
} from "@/lib/doc/define";

const ACCESSIBILITY_PAGE = defineDoc({
  blocks: [
    section(
      "label every control",
      p("zriz ships no words. give each control a name in your language:"),
      code("accessibility/labels.jsx.tsx"),
      p(
        "in development, `Area`, `Dial` and `Zoom` warn once each in the console when nothing names them. an `aria-label`, an `aria-labelledby` or text inside all count. nothing checks the group or the buttons, so name those yourself."
      )
    ),
    section(
      "check what a screen reader hears",
      table({
        columns: [
          column("part", "mono"),
          column("what a screen reader gets", "prose"),
        ],
        rows: [
          [
            "Area",
            'one tab stop with `role="group"`, described by `Instructions`',
          ],
          [
            "Dial",
            'a slider that reads "4 degrees" in your `locale`. `format` changes the wording',
          ],
          [
            "Zoom",
            'a slider that reads "150%" in your `locale`. `format` changes the wording',
          ],
          [
            "AspectGroup",
            "a `radiogroup` with one tab stop. each `AspectItem` is a radio. outside a group, an item is a button with `aria-pressed`",
          ],
          [
            "Rotate, Orientation",
            "buttons. `Orientation` is disabled for a free, original or square crop",
          ],
          ["Flip", "a toggle button. `aria-pressed` follows `mirrored`"],
          ["Reset", "a button that is `hidden` while nothing has changed"],
          ["Image", "an image named by its `alt`. without `alt`, nothing"],
          ["Handle, Grid, Mask", "hidden"],
        ],
      })
    ),
    section(
      "describe the crop",
      p(
        "`Area` points to `Instructions` with `aria-describedby`, so a screen reader reads its text when the crop gets focus:"
      ),
      code("accessibility/instructions.jsx.tsx")
    ),
    section(
      "announce changes",
      p(
        "a moving crop has no text, so a screen reader stays silent without `Announcer`. after each commit it calls `announce` and speaks what it returns, or nothing for `null`. this one speaks the position and width after each keyboard change. dial keys commit as `keyboard` too, so it also speaks after an arrow press on the dial, on top of the dial's own value:"
      ),
      code("accessibility/announcer.jsx.tsx"),
      p(
        "`details.reason` says what made the change, such as `keyboard`, `dial`, `pan` or `orientation`, and `details.previous` holds the crop before it. a message equal to the last one is spoken again."
      )
    ),
    section(
      "move everything with keys",
      p(
        "every control works without a mouse. the keys live with each part: [crop area](crop-area), [dial](dial), [zoom](zoom) and [aspect ratio](aspect-ratio). buttons take enter and space like any button."
      ),
      p("escape also cancels a photo drag or a handle drag."),
      p(
        "a key pressed in a focusable child of `Area`, `Dial` or `Zoom` stays with that child, and ctrl, cmd and alt shortcuts stay with the browser. the one exception is alt + arrows on `Area`, which resizes the crop."
      ),
      p(
        "zriz adds no focus style and removes none, so the browser's default ring shows on `Area`, `Dial` and `Zoom`. [crop area](crop-area) shows a ring of your own."
      )
    ),
    section(
      "work without a drag",
      p(
        "the dial, the handles and the photo pan need a drag, and keys do not replace that for someone who only has a pointer. wcag 2.5.7 asks for a way with single taps. `Zoom` already jumps on a press, for the rest add plain buttons that write to the cropper. pass a reason, so `Announcer` speaks these writes too:"
      ),
      code("accessibility/no-drag.tsx")
    ),
    section(
      "respect reduced motion",
      p(
        "with `prefers-reduced-motion: reduce`, motion that zriz starts on its own gets shorter. drags, pinches and throws stay the same, so the photo follows your finger."
      ),
      table({
        columns: [
          column("motion", "prose", { width: 136 }),
          column("full", "prose", { width: 184 }),
          column("reduced", "prose"),
        ],
        rows: [
          ["recentre", "spring, about 460 ms", "spring, about 250 ms"],
          ["rotate 90°", "about 300 ms", "150 ms"],
          ["flip", "spring, about 420 ms", "150 ms"],
          ["aspect, reset", "spring, about 460 ms", "150 ms"],
        ],
      }),
      p(
        '`motion="reduce"` on `Root` forces the short motion, and `motion="always"` keeps the full one. `Root` shows `data-reduced-motion` while it is on.'
      ),
      p(
        "the stylesheet's fades keep their length in both modes: the mask dims over 200 ms and comes back over 300 ms, and the grid fades in over 250 ms and out over 300 ms. after a gesture, the thirds grid and `data-interacting` on `Root` and `Mask` stay for 1380 ms. on `Area`, `data-interacting` clears when the gesture ends."
      )
    ),
    section(
      "api",
      part(
        "Announcer",
        'renders a visually hidden `<div role="status" aria-live="polite">` anywhere inside `Root`.',
        props([
          {
            name: "announce",
            required: true,
            text: "what to say after each commit. return `null` to stay quiet",
            type: "(value, details) => string | null",
          },
        ])
      ),
      part(
        "Instructions",
        "renders a `<div hidden>` anywhere inside `Root`, which `Area` points to with `aria-describedby`. it has no props of its own. its children are the text."
      )
    ),
  ],
  lede: "zriz sets roles, keys and announcements. you write every word a screen reader says.",
});

export { ACCESSIBILITY_PAGE };
