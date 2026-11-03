import { code, column, defineDoc, p, section, table } from "@/lib/doc/define";

const LOADING_IMAGES_PAGE = defineDoc({
  blocks: [
    section(
      "open a file from an input",
      p(
        "`src` on `Root` takes a url string, a `Blob`, a `File`, or `null` for an empty cropper. keep the picked file in state and pass it straight to `src`:"
      ),
      code("loading-images/picker.jsx.tsx"),
      p(
        "zriz reads the format from the first 512 bytes of the file, so a wrong name or mime type does not stop a photo from opening. when `src` changes, zriz cancels a load that is still running and keeps `onError` quiet for it. the previous photo stays on screen until the new one is ready, and stays there when the new one fails."
      )
    ),
    section(
      "start each photo from the full frame",
      p(
        "a new `src` keeps the current crop, angle and flip, and fits them to the new photo. to start every photo from the whole frame, give `Root` a `key` that changes with each pick, such as a counter you bump in `onChange`. a new `key` also frees the previous photo at once."
      ),
      code("loading-images/key.jsx.tsx")
    ),
    section(
      "open a url on another domain",
      p(
        "zriz fetches a url with `fetch` in cors mode, so the server that hosts the photo must send `Access-Control-Allow-Origin`. without it, the load fails with `cross-origin`. a 404 or any other error status fails with `decode`."
      ),
      p(
        'if that server needs cookies, pass `crossOrigin="use-credentials"`. the server then has to name your origin in `Access-Control-Allow-Origin`, not `*`, and send `Access-Control-Allow-Credentials: true`.'
      ),
      p(
        "if that server wants a token in a header, fetch the photo yourself with that header and pass the response's blob to `src`."
      )
    ),
    section(
      "check which formats open",
      table({
        columns: [column("format", "prose"), column("what happens", "prose")],
        rows: [
          ["jpeg, png, webp, avif, gif, bmp", "open in every current browser"],
          [
            "heic, jpeg xl, tiff",
            "open where the browser decodes them, and fail with `unsupported-format` elsewhere",
          ],
          [
            "svg",
            "takes its size from `width` and `height`, or from `viewBox`. without both it opens at 300 by 150. zriz draws it once at that size, at most the preview size, and exports from that drawing",
          ],
          [
            "animated gif, png, webp, avif",
            "open on their first frame. `animated` on the loaded image is `true`, and always for a gif",
          ],
        ],
      }),
      p(
        "every exif orientation opens upright. zriz measures the crop value and the export plan in the upright photo."
      )
    ),
    section(
      "handle large photos",
      p(
        "a worker decodes a preview sized for the screen. the original stays a blob until you export."
      ),
      table({
        columns: [column("limit", "prose"), column("size", "prose")],
        rows: [
          [
            "preview size",
            "twice the screen's long edge in device pixels, at most 4096 px on a touch screen and 8192 px elsewhere",
          ],
          [
            "export size",
            "16.8 megapixels on a touch screen and 268 megapixels elsewhere. a bigger crop comes out scaled down",
          ],
        ],
      }),
      p(
        "the fetch and the decode share one time limit. past it the load fails with `timeout`, and [errors](errors) gives the number. to allow more time, load the photo yourself and pass `timeout`, as in the heic section below."
      ),
      p(
        "when a content security policy blocks workers from `blob:` urls, zriz decodes on the main thread instead. add `worker-src blob:` to keep the page smooth while a large photo opens."
      )
    ),
    section(
      "open heic on every browser",
      p(
        "to decode a format the browser cannot, call `loadImage` yourself and pass a `decode` function. zriz calls it only when the browser's own decode fails. it gets the `Blob` and returns an `ImageBitmap`. save this as `decoder.ts`. its `convert` sends the file to a route on your server that turns it into jpeg. `loadImage` and `attachImage` come from `@zriz/core/dom`, so add `@zriz/core` as in [exporting](exporting):"
      ),
      code("loading-images/decoder.ts"),
      p(
        "pass a ref to `actionsRef`, leave `src` unset on `Root` and call `open()` from the file input. `onLoad` and `onError` do not fire for a photo you attach yourself, so the component tracks both from `open()`:"
      ),
      code("loading-images/heic.tsx"),
      p(
        "`ready` turns the save button on once the photo is attached. `onSave` gets the cropper for `exportCrop`, as in [exporting](exporting). a new pick aborts the load still running, so a slow file never replaces a newer one."
      ),
      p(
        "`loadImage` also takes `timeout` in milliseconds, `previewEdge`, the longest side of the preview in pixels, `crossOrigin` and an abort `signal`. it accepts an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` as its source."
      )
    ),
    section(
      "handle a failed load",
      p(
        "`onError` on `Root` gets a `ZrizError`. its `code` names the problem, such as `timeout` or `cross-origin`. `onLoad` fires instead when the photo is ready, with its `width`, `height` and `mime`. [errors](errors) lists every code with its fix."
      )
    ),
  ],
  lede: "open a photo from a file input, a url or a blob, and check which formats and sizes load.",
});

export { LOADING_IMAGES_PAGE };
