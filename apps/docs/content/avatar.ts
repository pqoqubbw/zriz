import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

const AVATAR_PAGE = defineDoc({
  blocks: [
    demo("avatar", 56),
    section(
      "Take a file from the visitor",
      p(
        "`src` takes the `File` from the input as it is. Picking a new file turns save off until that photo loads."
      ),
      p(
        "Each pick bumps a counter that `Root` takes as its `key`, so every photo starts from the full frame. [Loading images](loading-images) explains why. Safari fires no `change` for the same file twice, so `onClick` clears the input first."
      ),
      excerpt("avatar/avatar-picker.tsx", ["<input", "/>"])
    ),
    section(
      "Crop to a circle",
      p(
        '`shape="circle"` locks the aspect to 1 and draws a round mask. The area has no handles, so the visitor drags the photo under the circle and zooms it with a pinch or, with `wheel="zoom"`, the mouse wheel.'
      ),
      p(
        "`minSize` keeps the crop at least 512 by 512 source pixels. On a photo with a side under 512 px, the circle stays as large as the photo allows. `onLoad` fires when the photo has decoded and turns save on."
      ),
      excerpt("avatar/avatar-picker.tsx", ["<Cropper.Root", "</Cropper.Root>"])
    ),
    section(
      "Say when a photo does not open",
      p(
        "`onError` gets a `ZrizError` when the file is not a photo or the browser cannot decode it, such as a HEIC file in Chrome. The alert asks for another file. [Errors](errors) lists every code."
      ),
      excerpt(
        "avatar/avatar-picker.tsx",
        ["const unreadable", '"this photo'],
        ['{status === "failed"', null]
      )
    ),
    section(
      "Save a PNG",
      p(
        "`exportCrop` reads the circle from `Root` and returns a PNG with transparent corners, at most 512 by 512. It comes from `@zriz/core/dom`."
      ),
      p(
        "An export can still fail on a very large photo, so `save` shows its own alert when it does."
      ),
      p(
        "`running` holds the export in flight. A second click does nothing, and the button keeps focus because `saving` sets `aria-disabled` and leaves it enabled. A new pick aborts the export, so an old crop never lands on the next photo. If an export finishes between two clicks, `onSave` runs twice, so keep it safe to repeat."
      ),
      excerpt(
        "avatar/avatar-picker.tsx",
        ["const unsaved", null],
        ["const running", null],
        ["useEffect(", null],
        ["const save", "};"],
        ["{saveFailed", null],
        ["<button", "</button>"]
      )
    ),
    section(
      "The whole file",
      p("`AvatarPicker` hands `onSave` the PNG as a `Blob`:"),
      code("avatar/avatar-picker.tsx"),
      p(
        "The demo above runs this file with the styles from the zriz site. Its open, reset and download buttons take the place of the input, the alerts and save. It adds a zoom slider with step buttons, and `maxZoom` on `Root` stops the zoom at 3×."
      )
    ),
  ],
  lede: "A profile photo picker: the visitor picks a file, moves it under a circle and saves a round PNG.",
});

export { AVATAR_PAGE };
