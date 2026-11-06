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
      "Label every control",
      p("zriz ships no words. Give each control a name in your language:"),
      code("accessibility/labels.jsx.tsx"),
      p(
        "In development, `Area`, `Dial` and `Zoom` warn once each in the console when nothing names them. An `aria-label`, an `aria-labelledby` or a `title` counts. Text inside does not, because it never names a slider or a group. Nothing checks the aspect group or the buttons, so name those yourself. Buttons take their name from the text inside them."
      )
    ),
    section(
      "Check what a screen reader hears",
      table({
        columns: [
          column("Part", "mono"),
          column("What a screen reader gets", "prose"),
        ],
        rows: [
          [
            "Area",
            'Always `role="application"`, and one tab stop once a photo is placed, described by `Instructions`. The role passes the arrow keys through a screen reader\'s browse mode. Pass your own `role` to change it',
          ],
          [
            "Dial",
            'A slider that reads "4 degrees" in your `locale`. `format` changes the wording',
          ],
          [
            "Zoom",
            'A slider that reads "150%" in your `locale`. `format` changes the wording',
          ],
          [
            "AspectGroup",
            "A `radiogroup` with one tab stop. Each `AspectItem` is a radio. Outside a group, an item is a button with `aria-pressed`",
          ],
          [
            "Rotate, Orientation, ZoomStep",
            "Buttons. Name a `ZoomStep` with `aria-label`. `Orientation` is disabled for a free, original or square crop",
          ],
          ["Flip", "A toggle button. `aria-pressed` follows `mirrored`"],
          [
            "Reset",
            "A button that is `hidden` while nothing has changed. If it has focus when it hides, focus moves to `Area`, or to the first control in `Root` that can take focus when there is no `Area` or it cannot take focus",
          ],
          [
            "Every control above",
            "`aria-disabled` while `Root` is disabled. A press does nothing, and the control stays in the tab order",
          ],
          ["Image", "An image named by its `alt`. Without `alt`, nothing"],
          ["Handle, Grid, Mask, DialTicks, DialValue, ZoomThumb", "Hidden"],
        ],
      })
    ),
    section(
      "Describe the crop",
      p(
        "`Area` points to `Instructions` with `aria-describedby`, so a screen reader reads its text when the crop gets focus:"
      ),
      code("accessibility/instructions.jsx.tsx"),
      p(
        "Render one `Instructions` and one `Announcer` per `Root`, outside any toolbar you duplicate. A second `Instructions` gets the same id, and `Area` only reads the first. A second `Announcer` calls `announce` again and speaks each message twice."
      )
    ),
    section(
      "Announce changes",
      p(
        "A moving crop has no text, so a screen reader stays silent without `Announcer`. After each commit it calls `announce` and speaks what it returns, or nothing for `null`. This one speaks the position and width after each keyboard change. Dial and zoom keys commit as `keyboard` too, so it also speaks after an arrow press on either slider, on top of the slider's own value:"
      ),
      code("accessibility/announcer.jsx.tsx"),
      p(
        "`details.reason` says what made the change, such as `keyboard`, `dial`, `pan` or `orientation`, and `details.previous` holds the crop before it. A message equal to the last one is spoken again."
      )
    ),
    section(
      "Move everything with keys",
      p(
        "Every control works without a mouse. The keys live with each part: [crop area](crop-area), [dial](dial), [zoom](zoom) and [aspect ratio](aspect-ratio). Buttons take Enter and Space like any button."
      ),
      p(
        "Escape also cancels a drag on the photo, a handle, `Dial` or `Zoom`, and the dialog around it stays open. A second Escape reaches the dialog."
      ),
      p(
        "A key pressed in a focusable child of `Area`, `Dial` or `Zoom` stays with that child, and Ctrl, Cmd and Alt shortcuts stay with the browser. The one exception is Alt + arrows on `Area`, which resizes the crop."
      ),
      p(
        "On keyboard focus, the stylesheet draws a two-tone ring inside `Area` in `Canvas` and `CanvasText`, so it shows on any photo and at padding 0. A mouse press adds nothing. Without the stylesheet, and on `Dial` and `Zoom`, the browser's default ring shows. [Crop area](crop-area) shows how to recolour the ring."
      )
    ),
    section(
      "Work without a drag",
      p(
        "The dial, the handles and the photo pan need a drag, and keys do not replace that for someone who only has a pointer. WCAG 2.5.7 asks for a way with single taps. `Zoom` already jumps on a press, for the rest add plain buttons that write to the cropper. Pass a reason, so `Announcer` speaks these writes too. The effect frees the photo, see [hooks](hooks):"
      ),
      code("accessibility/no-drag.tsx")
    ),
    section(
      "Respect reduced motion",
      p(
        "With `prefers-reduced-motion: reduce`, motion that zriz starts on its own gets shorter. Drags, pinches and throws stay the same, so the photo follows your finger."
      ),
      table({
        columns: [
          column("Motion", "prose", { width: 136 }),
          column("Full", "prose", { width: 184 }),
          column("Reduced", "prose"),
        ],
        rows: [
          ["Recentre", "Spring, about 460 ms", "Spring, about 250 ms"],
          [
            "Rotate 90°, reset or undo across a turn",
            "Spring, about 390 ms",
            "150 ms",
          ],
          ["Flip", "Spring, about 420 ms", "150 ms"],
          [
            "Aspect, orientation, reset or undo",
            "Spring, about 460 ms",
            "150 ms",
          ],
        ],
      }),
      p(
        '`motion="reduce"` on `Root` forces the short motion, and `motion="always"` keeps the full one. `Root` shows `data-reduced-motion` while it is on.'
      ),
      p(
        "Spring-backs keep their length in both modes: the dial past its limit, the photo pulled past the crop and the zoom past its limits."
      ),
      p(
        "The stylesheet's fades keep their length in both modes: the mask dims over 200 ms and comes back over 300 ms, and the grid fades in over 250 ms and out over 300 ms. After a gesture, the thirds grid and `data-interacting` on `Root` and `Mask` stay for 1380 ms. On `Area`, `data-interacting` clears when the gesture ends."
      )
    ),
    section(
      "API",
      part(
        "Announcer",
        'Renders a visually hidden `<div role="status" aria-live="polite">` anywhere inside `Root`. With a native modal `<dialog>`, keep it inside the dialog, because `showModal` makes everything outside inert and screen readers lose it.',
        props([
          {
            name: "announce",
            required: true,
            text: "What to say after each commit. Return `null` to stay quiet",
            type: "(value, details) => string | null",
          },
        ])
      ),
      part(
        "Instructions",
        "Renders a `<div hidden>` anywhere inside `Root`, which `Area` points to with `aria-describedby`. It has no props of its own. Its children are the text."
      )
    ),
  ],
  lede: "zriz sets roles, keys and announcements. You write every word a screen reader says.",
});

export { ACCESSIBILITY_PAGE };
