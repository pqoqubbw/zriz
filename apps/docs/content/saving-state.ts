import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

export const savingState = defineDoc({
  blocks: [
    demo("saving-state", 56),
    section(
      "read the saved crop before the cropper mounts",
      p(
        "each photo gets its own key, built from an `id` you pass, such as the photo's id in your database. `parse` turns the stored string back into a crop, or returns `null` when there is none. [value](value) shows what it does with broken input."
      ),
      p(
        "`parse` and `serialize` come from `@zriz/core`. add it as in [exporting](exporting)."
      ),
      p(
        "`Root` reads `defaultValue` once, when it mounts. the component renders nothing until it has read storage for this `id`. that empty render unmounts the old cropper, so each photo starts fresh."
      ),
      excerpt(
        "saving-state/saved-crop.tsx",
        ["const key", null],
        ["const [saved", null],
        ["useEffect(", "}, [id, key]);"],
        ["if (saved?.id", null]
      )
    ),
    section(
      "start from it and save each commit",
      p(
        "`serialize` writes a json string with a version field and stores the crop as fractions of the photo, so it fits any viewport size. to keep it in a database instead, send the same string with `fetch`."
      ),
      p(
        "`Reset` goes back to `defaultValue`, which is now the saved crop. to keep `Reset` on the whole photo, pass `saved.value ?? undefined` as `value` instead. it stays the same object, so it moves the crop only once, see [value](value)."
      ),
      excerpt("saving-state/saved-crop.tsx", [
        "<Cropper.Root",
        "</Cropper.Root>",
      ])
    ),
    section(
      "the whole file",
      p("`SavedCrop` takes a photo url and an id to store its crop under:"),
      code("saving-state/saved-crop.tsx")
    ),
  ],
  lede: "keep the crop for each photo in local storage and bring it back on the next visit.",
});
