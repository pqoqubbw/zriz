import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

export const undo = defineDoc({
  blocks: [
    demo("undo", 56),
    section(
      "remember the crop before each gesture",
      p(
        "`details.previous` holds the crop from before the gesture. one gesture is one commit, however many frames it took. the stack keeps the last 50."
      ),
      p(
        "`remember` skips commits with two reasons. `history` is the undo itself, and `coverage` is zriz fitting the crop to a new photo or new limits."
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
        "`setValue()` commits like any other change, with the reason you give it. the button stays off while the stack is empty."
      ),
      p(
        "for redo, keep a second stack. `undo` pushes `actions.current.getValue()` onto it before it steps back. a `redo` function pops it, pushes the current crop onto the undo stack and calls `setValue()` with `history` too. `remember` clears the redo stack after the reason check, so a new gesture drops it."
      ),
      excerpt(
        "undo/undo-editor.tsx",
        ["const undo", "};"],
        ["<button", "</button>"]
      )
    ),
    section(
      "wire it to the cropper",
      p(
        "`onValueCommit` hands every commit to `remember`. crops from the last photo make no sense on the next one, so `onLoad` clears the stack."
      ),
      excerpt("undo/undo-editor.tsx", ["<Cropper.Root", ">"])
    ),
    section(
      "the whole file",
      p("`UndoEditor` adds the button under the dial:"),
      code("undo/undo-editor.tsx")
    ),
  ],
  lede: "an undo button for the crop, built from what each commit hands you.",
});
