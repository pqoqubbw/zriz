import {
  code,
  column,
  defineDoc,
  demo,
  excerpt,
  p,
  section,
  table,
} from "@/lib/doc/define";

const SERVER_CROP_PAGE = defineDoc({
  blocks: [
    demo("server-crop", 56),
    section(
      "Install sharp",
      p(
        "A browser export can come out smaller than the crop. [Loading images](loading-images) has the size limits, and [errors](errors) explains `blank`. sharp has no canvas and never retries smaller, so cut on the server when you need the full‑size crop."
      ),
      p(
        "The route runs on your server and needs `sharp`. Add it and `@zriz/core` as in [exporting](exporting):"
      ),
      code("server-crop/install.sh"),
      p(
        "Use sharp 0.35.5 or newer and keep it updated. It bundles libvips and every image decoder, so an old sharp means old decoders. [Security](security) lists the advisories."
      )
    ),
    section(
      "Send the file and the value",
      p(
        "The demo above uploads nothing. Its send button works out the plan in the browser, the way the route does, and shows the value and the `toSharp` steps under the dial, with numbers rounded to four places."
      ),
      p(
        "`getValue()` returns the crop value, and `serialize` turns it into a small JSON string. Send that, not the export plan, so the server works out which pixels to keep on its own. The upload button waits for `onLoad`, because a value means nothing without its photo."
      ),
      p(
        "`crop-limits.ts` holds `minSize` and `maxZoom` for `Root` and for the route, so the server recomputes the plan the client saw. Change them there, and both ends stay the same."
      ),
      p(
        "A bad request comes back as text, and the alert shows it. A photo the browser cannot open shows the same alert."
      ),
      p(
        "Each pick bumps a counter that `Root` takes as its `key`, so every photo starts from the full frame. [Loading images](loading-images) explains why. Safari fires no `change` for the same file twice, so `onClick` clears the input first."
      ),
      p(
        "`last` holds the upload in flight. A new upload, a new pick or an unmount aborts it, so an answer for an old photo never shows under a new one. Starting an upload clears the old result and error, and the effect on `result` revokes each URL it leaves behind."
      ),
      excerpt(
        "server-crop/crop-upload.tsx",
        ["const unreadable", '"This photo'],
        ["const [picks", null],
        ["const last", null],
        ["useEffect(() => () => last", ");"],
        ["const upload", "};"],
        ["<input", "/>"],
        ["<Cropper.Root", ">"],
        ["<button", "</button>"]
      )
    ),
    section(
      "Cut the original with sharp",
      p(
        "`rotate()` with no angle turns the upload upright from its EXIF tag. The route reads the value with `parse`, builds a cropper at the size of that upright image and asks it for the plan. A value out of range lands inside the photo, the way it does in the browser. `toSharp` then turns the plan into steps for sharp."
      ),
      p(
        'A crop with no straighten comes back as `"extract"`: a rectangle, a flop, a turn in steps of 90° and a resize to the size of the plan. A straightened crop comes back as `"affine"`: extract the `source` window, the part of the photo the crop can touch, pad at least 2 px on each side by copying the edge, turn with a bicubic affine, then extract the crop.'
      ),
      p(
        "In one pipeline sharp runs `extend()` after `affine()`, and `affine()` after `extract()` and `rotate()`, so the route ends each stage as a raw buffer and opens a new pipeline for the next one. Each new pipeline passes `limitInputPixels: false`, since the upload already passed the check and a turned crop can grow past it. The first one holds the limit."
      ),
      p(
        "`toSharp` does not apply perspective, so the route answers 422 for a value with `perspective`. Export those in the browser instead."
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["type Raw", "};"]),
      p(
        "The upload is cut as pixels, and each stage drops everything else, so EXIF, GPS, XMP, thumbnails, gain maps and bytes after the image never reach the answer. Don't add `keepMetadata()` or `keepExif()`. [Security](security) explains why."
      )
    ),
    section(
      "Answer the request",
      p(
        "The route is a Next.js route handler saved as `app/api/crop/route.ts`. A JPEG at quality 92 with clear pixels filled white comes back when all goes well. Otherwise:"
      ),
      table({
        columns: [
          column("Status", "mono", { width: 80 }),
          column("When", "prose"),
        ],
        rows: [
          [
            "400",
            "The form lacks the file or the value, or sharp cannot open the file",
          ],
          ["401", "`canCrop` says no"],
          [
            "413",
            "The body is over 50 MB or declares no `content-length`, or the photo is over `MAX_PIXELS`",
          ],
          [
            "415",
            "A HEIC or other HEIF that is not AVIF, because prebuilt sharp has no HEVC decoder",
          ],
          [
            "422",
            "The crop cannot be cut, or the value is over 4096 characters",
          ],
          ["503", "`MAX_RUNNING` crops are already running in this process"],
        ],
      }),
      p(
        "Chromium and Firefox ignore the orientation tag of a WebP and Safari honours it, so the value can describe a different frame from the one sharp turns upright. The route answers 422 for a WebP with an orientation above 1 instead of cutting the wrong pixels."
      ),
      p(
        "`canCrop` in `can-crop.ts` answers `false` until you connect your session check, so a copied route refuses everyone. Replace its body before you ship."
      ),
      p(
        "The value and the file come from the browser, so treat both as hostile. The top of the route holds the limits:"
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["const MAX_BODY", "});"]),
      p(
        "A small PNG can ask for a huge image, and the bytes on the wire say nothing about the memory it takes. A photo at `MAX_PIXELS` peaked at about 2 GB in our test, for a 460 kB upload at a 45° tilt, so give the server that much per running crop. `MAX_PIXELS` is the one constant to raise, and only with memory to match. 120 million covers a 108 megapixel phone photo, and a 200 megapixel one gets 413. `MAX_RUNNING` counts one process, so add a rate limit per user on top."
      ),
      p(
        "`sharp.block()` turns off every decoder but JPEG, PNG, WebP and AVIF for the whole process, because the route never needs SVG, TIFF, GIF or the others. Move it if another route in the same process does."
      ),
      excerpt(
        "server-crop/app/api/crop/route.ts",
        ["const readForm", "};"],
        ["const answer", "};"]
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["export const POST", "};"])
    ),
    section(
      "All four files",
      p(
        "Save `crop-limits.ts`, `can-crop.ts` and `crop-upload.tsx` next to the `app` folder. That is where the imports look for them."
      ),
      p("`crop-limits.ts` is shared by both:"),
      code("server-crop/crop-limits.ts"),
      p("`can-crop.ts` runs on the server. Connect your session check here:"),
      code("server-crop/can-crop.ts"),
      p("`crop-upload.tsx` runs in the browser:"),
      code("server-crop/crop-upload.tsx"),
      p("`app/api/crop/route.ts` runs on the server:"),
      code("server-crop/app/api/crop/route.ts"),
      p(
        "The demo above keeps the limits and parts of `crop-upload.tsx`. It adds rotate, flip, handles, a grid and reset, shows the angle to one decimal and uses the styles from the zriz site."
      )
    ),
  ],
  lede: "Send the photo and its crop value to your server, and cut the full-size original there with sharp.",
});

export { SERVER_CROP_PAGE };
