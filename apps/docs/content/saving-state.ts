import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

const SAVING_STATE_PAGE = defineDoc({
  blocks: [
    demo("saving-state", 56),
    section(
      "Read the saved crop before the cropper mounts",
      p(
        "Each photo gets its own key, built from an `id` you pass, such as the photo's id in your database. `parse` turns the stored string back into a crop, or returns `null` when there is none. [Value](value) shows what it does with broken input."
      ),
      p(
        "`parse` and `serialize` come from `@zriz/core`, which [quick start](quick-start) installs."
      ),
      p(
        "`Root` reads `defaultValue` once, when it mounts. The component renders nothing until it has read storage for this `id`. That empty render unmounts the old cropper, so each photo starts fresh."
      ),
      p(
        "Storage can refuse a read, such as in a sandboxed iframe. `read` treats that as no saved crop, so the cropper still opens."
      ),
      excerpt(
        "saving-state/saved-crop.tsx",
        ["const read", "};"],
        ["const key", null],
        ["const [saved", null],
        ["useEffect(", "}, [id, key]);"],
        ["if (saved?.id", null]
      )
    ),
    section(
      "Start from it and save each commit",
      p(
        "`serialize` writes a JSON string with a version field and stores the crop as fractions of the photo, so it fits any viewport size. To keep it in a database instead, send the same string with `fetch`."
      ),
      p(
        "`Reset` goes back to `defaultValue`, which is now the saved crop. To keep `Reset` on the whole photo, pass `saved.value ?? undefined` as `value` instead. It stays the same object, so it moves the crop only once, see [value](value)."
      ),
      p(
        "The recipe skips `coverage` commits. That is zriz fitting the crop to a new photo, and nobody chose it, so it must not replace the saved crop. A full quota throws on write. Without the `try`, zriz rethrows that as an uncaught error, so the `try` keeps your error reporting quiet and the crop goes on working unsaved."
      ),
      excerpt("saving-state/saved-crop.tsx", [
        "<Cropper.Root",
        "</Cropper.Root>",
      ])
    ),
    section(
      "The whole file",
      p("`SavedCrop` takes a photo URL and an id to store its crop under:"),
      code("saving-state/saved-crop.tsx"),
      p(
        "The demo above saves its crop in this browser under `zriz-docs:saving-state:` and an id for the photo. Change the crop and reload the page, and it comes back. The demo never renders on the server, so it reads storage as it mounts and skips the empty render."
      ),
      p(
        "It adds the dial, rotate, flip, handles, a grid and reset, shows the angle to one decimal and uses the styles from the zriz site."
      )
    ),
  ],
  lede: "Keep the crop for each photo in local storage and bring it back on the next visit.",
});

export { SAVING_STATE_PAGE };
