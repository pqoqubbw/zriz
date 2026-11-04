import { code, defineDoc, demo, excerpt, p, section } from "@/lib/doc/define";

const SERVER_CROP_PAGE = defineDoc({
  blocks: [
    demo("server-crop", 56),
    section(
      "install sharp",
      p(
        "a browser export can come out smaller than the crop. [loading images](loading-images) has the size limits, and [errors](errors) explains `blank`. sharp has no canvas and never retries smaller, so cut on the server when you need the full‑size crop. sharp refuses photos over about 268 megapixels unless you raise `limitInputPixels`."
      ),
      p(
        "the route runs on your server and needs `sharp`. add it and `@zriz/core` as in [exporting](exporting):"
      ),
      code("server-crop/install.sh")
    ),
    section(
      "send the file and the plan",
      p(
        "`getPixelCrop()` returns the export plan, a small json object that says which source pixels to keep. it returns `null` until the photo loads, so upload waits for `onLoad`."
      ),
      p(
        "a bad request comes back as text, and the alert shows it. a photo the browser cannot open shows the same alert."
      ),
      p(
        "each pick bumps a counter that `Root` takes as its `key`, so every photo starts from the full frame. [loading images](loading-images) explains why. safari fires no `change` for the same file twice, so `onClick` clears the input first."
      ),
      p(
        "`last` holds the upload in flight. a new upload, a new pick or an unmount aborts it, so an answer for an old photo never shows under a new one. starting an upload clears the old result and error, and the effect on `result` revokes each url it leaves behind."
      ),
      excerpt(
        "server-crop/crop-upload.tsx",
        ["const unreadable", '"this photo'],
        ["const [picks", null],
        ["const last", null],
        ["useEffect(() => () => last", "[result]"],
        ["const upload", "};"],
        ["<input", "/>"],
        ["<Cropper.Root", ">"],
        ["<button", "</button>"]
      )
    ),
    section(
      "cut the original with sharp",
      p(
        "`rotate()` with no angle turns the upload upright from its exif tag. `toSharp` takes the plan and the size of that upright image and returns the steps for sharp."
      ),
      p(
        'a crop with no straighten and no perspective comes back as `"extract"`: a rectangle, a flop and a turn in steps of 90°. any other crop comes back as `"affine"`: pad at least 2 px on each side by copying the edge, turn with a bicubic affine, then extract the crop.'
      ),
      p(
        "in one pipeline sharp runs `extend()` after `affine()`, and `affine()` after `extract()` and `rotate()`, so the route ends each stage as a raw buffer and opens a new pipeline for the next one. each new pipeline passes `limitInputPixels: false`, since the upload already passed the check and a turned crop can grow past it."
      ),
      p(
        "`toSharp` does not apply perspective. if you set `perspective` with `setValue()`, export in the browser instead."
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["type Raw", "};"])
    ),
    section(
      "answer the request",
      p(
        "the route is a next.js route handler saved as `app/api/crop/route.ts`. it answers 400 when the form lacks the file or the plan, 400 when sharp cannot open the file, a photo over the pixel limit included, 422 when the plan does not fit it, and otherwise a jpeg at quality 92 with clear pixels filled white. `toSharp` throws a `RangeError` on a plan with no `pixelRect` that is not a plain turn and scale of the photo. it does not check a plan with a `pixelRect`, and a plan that is not an object throws a `TypeError`. the route's catch answers all of these with 422 too."
      ),
      p(
        "the plan comes from the browser, so treat it as client input. a plan that passes `toSharp` can still need far more memory than the photo, so keep the route behind your own auth and a rate limit."
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["export const POST", "};"])
    ),
    section(
      "both files",
      p("`crop-upload.tsx` runs in the browser:"),
      code("server-crop/crop-upload.tsx"),
      p("`app/api/crop/route.ts` runs on the server:"),
      code("server-crop/app/api/crop/route.ts")
    ),
  ],
  lede: "send the photo and its crop plan to your server, and cut the full-size original there with sharp.",
});

export { SERVER_CROP_PAGE };
