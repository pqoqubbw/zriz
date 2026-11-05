import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

const FULL_EDITOR_PAGE = defineDoc({
  blocks: [
    demo("full-editor", 56),
    section(
      "lay out the crop area",
      p(
        "give the viewport a size. the stylesheet paints the mask, the crop frame, the handles and the grid. eight `Handle` parts let the visitor drag every corner and edge."
      ),
      excerpt(
        "full-editor/editor.tsx",
        ["const handles", "] as const;"],
        ["<Cropper.Viewport", "</Cropper.Viewport>"]
      )
    ),
    section(
      "straighten with the dial",
      p(
        "the dial fills its parent unless you give it a width, see [dial](dial)."
      ),
      p(
        "`DialValue` prints the angle as a whole number. `format` adds the degree sign."
      ),
      excerpt("full-editor/editor.tsx", [
        "<Cropper.DialValue",
        "</Cropper.Dial>",
      ])
    ),
    section(
      "add a zoom slider",
      p(
        "zriz ships `Zoom` and `ZoomThumb` with no paint. `track` draws a 2 px line and `thumb` draws the knob. zriz moves the knob from the left end at 1× to the right end at the largest zoom."
      ),
      excerpt(
        "full-editor/editor.tsx",
        ["const track", "};"],
        ["const thumb", "};"],
        ["<Cropper.Zoom", "</Cropper.Zoom>"]
      ),
      p(
        "forced colours mode removes a gradient and a plain background, so the slider would vanish. save this as `forced-colors.css` next to the editor, which imports it. it brings both back in `CanvasText`. the styles above are inline, so it needs `!important`:"
      ),
      code("full-editor/forced-colors.css")
    ),
    section(
      "pick an aspect ratio",
      p(
        "`AspectGroup` is one tab stop. [aspect ratio](aspect-ratio) lists its keys."
      ),
      p(
        "`Orientation` swaps 4:5 for 5:4 and 16:9 for 9:16. it is off while the aspect is free, original or square. after a swap no item is checked, because the list has neither 5:4 nor 9:16. [aspect ratio](aspect-ratio) flips the labels with the orientation so one item stays checked."
      ),
      excerpt(
        "full-editor/editor.tsx",
        ["const aspects", "] as const;"],
        ["<Cropper.AspectGroup", "<Cropper.Orientation>"]
      )
    ),
    section(
      "turn, flip and reset",
      p(
        "the buttons come with no paint, so put your own icons or words inside. `Rotate` turns the photo 90° counter-clockwise, `Flip` mirrors it, and `Reset` puts the crop back where it started. `Reset` stays hidden until the crop changes."
      ),
      excerpt("full-editor/editor.tsx", ["<Cropper.Rotate>", "<Cropper.Reset>"])
    ),
    section(
      "describe it to screen readers",
      p(
        "`Instructions` is hidden text. the crop area points to it with `aria-describedby`, so a screen reader reads it when the area gets focus."
      ),
      p(
        "the dial and the zoom slider read out their own values. the buttons do not, so `announce` speaks for them after each commit. it returns `null` for any other change. [accessibility](accessibility) covers the keys and the labels."
      ),
      excerpt(
        "full-editor/editor.tsx",
        ["const spoken", "};"],
        ["const announce", "spoken["],
        ["const instructions", "].join"],
        ["<Cropper.Instructions>", "<Cropper.Announcer"]
      )
    ),
    section(
      "export a jpeg",
      p(
        "`exportCrop` makes a jpeg unless the crop is a circle. the button stays off until `onLoad` fires, because an export before that rejects. `exportCrop` comes from `@zriz/core/dom`."
      ),
      p(
        "an export can still fail on a very large photo, so `save` shows its own alert when it does. `onError` shows a second one when the photo does not open. [errors](errors) lists the codes."
      ),
      p(
        "`key={src}` gives each photo a fresh cropper, and the check on `shown` turns the button off and hides both alerts when `src` changes."
      ),
      p(
        "`running` holds the export in flight. a second click does nothing, and the button keeps focus because `saving` sets `aria-disabled` and leaves it enabled. a new `src` aborts the export, so an old crop never reaches `onSave` after the photo changed."
      ),
      excerpt(
        "full-editor/editor.tsx",
        ["const running", null],
        ["const [saving", null],
        ["const [ready", "}"],
        ["useEffect(", null],
        ["const save", "};"],
        ["<Cropper.Root", ">"],
        ["<button", "</button>"],
        ["{failed", null],
        ["{exportFailed", ")}"]
      )
    ),
    section(
      "the whole file",
      p("`Editor` takes a photo url and hands `onSave` the jpeg:"),
      code("full-editor/editor.tsx"),
      p(
        "the demo above runs this file with the icons and styles from the zriz site. it shows the angle to one decimal and calls square 1:1. its aspect labels turn with the orientation, as on [aspect ratio](aspect-ratio). it leaves out the zoom slider, and wheel and pinch still zoom."
      )
    ),
  ],
  lede: "the crop area, the dial, zoom, aspect ratios, the buttons and a jpeg export in one component.",
});

export { FULL_EDITOR_PAGE };
