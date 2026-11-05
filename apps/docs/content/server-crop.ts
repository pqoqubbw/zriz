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
      "send the file and the value",
      p(
        "`getValue()` returns the crop value, and `serialize` turns it into a small json string. send that, not the export plan, so the server works out which pixels to keep on its own. the upload button waits for `onLoad`, because a value means nothing without its photo."
      ),
      p(
        "`crop-limits.ts` holds `minSize` and `maxZoom` for `Root` and for the route, so the server recomputes the plan the client saw. change them there, and both ends stay the same."
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
        "`rotate()` with no angle turns the upload upright from its exif tag. the route reads the value with `parse`, builds a cropper at the size of that upright image and asks it for the plan. a value out of range lands inside the photo, the way it does in the browser. `toSharp` then turns the plan into steps for sharp."
      ),
      p(
        'a crop with no straighten comes back as `"extract"`: a rectangle, a flop, a turn in steps of 90° and a resize to the size of the plan. a straightened crop comes back as `"affine"`: extract the `source` window, the part of the photo the crop can touch, pad at least 2 px on each side by copying the edge, turn with a bicubic affine, then extract the crop.'
      ),
      p(
        "in one pipeline sharp runs `extend()` after `affine()`, and `affine()` after `extract()` and `rotate()`, so the route ends each stage as a raw buffer and opens a new pipeline for the next one. each new pipeline passes `limitInputPixels: false`, since the upload already passed the check and a turned crop can grow past it."
      ),
      p(
        "`toSharp` does not apply perspective, so the route answers 422 for a value with `perspective`. export those in the browser instead."
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["type Raw", "};"])
    ),
    section(
      "answer the request",
      p(
        "the route is a next.js route handler saved as `app/api/crop/route.ts`. it answers 413 for a body over 50 mb or with no `content-length`, 400 when the form lacks the file or the value, 400 when sharp cannot open the file, a photo over the pixel limit included, 422 when the crop cannot be cut, and otherwise a jpeg at quality 92 with clear pixels filled white."
      ),
      p(
        "chromium and firefox ignore the orientation tag of a webp and safari honours it, so the value can describe a different frame from the one sharp turns upright. the route answers 422 for a webp with an orientation above 1 instead of cutting the wrong pixels."
      ),
      p(
        "the value and the file come from the browser, so treat them as client input. decoding a large photo still costs memory, so keep the route behind your own auth and a rate limit."
      ),
      excerpt("server-crop/app/api/crop/route.ts", ["export const POST", "};"])
    ),
    section(
      "all three files",
      p("`crop-limits.ts` is shared by both:"),
      code("server-crop/crop-limits.ts"),
      p("`crop-upload.tsx` runs in the browser:"),
      code("server-crop/crop-upload.tsx"),
      p("`app/api/crop/route.ts` runs on the server:"),
      code("server-crop/app/api/crop/route.ts")
    ),
  ],
  lede: "send the photo and its crop value to your server, and cut the full-size original there with sharp.",
});

export { SERVER_CROP_PAGE };
