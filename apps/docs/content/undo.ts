import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

const UNDO_PAGE = defineDoc({
  blocks: [
    demo("undo", 56),
    section(
      "remember the crop before each gesture",
      p(
        "`details.previous` holds the crop from before the gesture. one gesture is one commit, however many frames it took. the stack keeps the last 50."
      ),
      p(
        "`remember` skips commits with two reasons. `history` is the undo itself, and `coverage` is zriz fitting the crop to new limits."
      ),
      excerpt(
        "undo/undo-editor.tsx",
        ["const skipped", null],
        ["const [history", null],
        ["const remember", "};"]
      )
    ),
    section(
      "step back",
      p(
        "`setValue()` commits like any other change, with the reason you give it. a press during a gesture does nothing, because the gesture would overwrite the step and the stack would lose it. the button reads as off while the stack is empty, with `aria-disabled`, so it keeps focus when the last step goes."
      ),
      p(
        "for redo, keep a second stack. `undo` pushes `actions.current.getValue()` onto it before it steps back. a `redo` function pops it, pushes the current crop onto the undo stack and calls `setValue()` with `history` too. `remember` clears the redo stack after the reason check, so a new gesture drops it."
      ),
      excerpt(
        "undo/undo-editor.tsx",
        ["const undo", "};"],
        ["<button", "</button>"]
      ),
      p(
        "the browser dims only `disabled`, so paint the off state yourself. save this as `undo.css` next to the editor, which imports it:"
      ),
      code("undo/undo.css")
    ),
    section(
      "wire it to the cropper",
      p(
        "`onValueCommit` hands every commit to `remember`. crops from the last photo make no sense on the next one, so `UndoEditor` keys `Editor` by `src`. each photo gets a fresh cropper at the full frame and an empty stack, and a late commit from the old cropper has no stack to reach. the old photo leaves the screen at once."
      ),
      excerpt(
        "undo/undo-editor.tsx",
        ["<Cropper.Root", ">"],
        ["export const UndoEditor", ");"]
      )
    ),
    section(
      "the whole file",
      p("`Editor` adds the button under the dial:"),
      code("undo/undo-editor.tsx"),
      p(
        "the demo above runs this file with a rotate button, so a turn is one more step to undo. it adds handles, a grid and reset, shows the angle to one decimal and uses the styles from the zriz site."
      )
    ),
  ],
  lede: "an undo button for the crop, built from what each commit hands you.",
});

export { UNDO_PAGE };
