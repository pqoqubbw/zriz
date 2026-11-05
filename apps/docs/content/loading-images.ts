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
        "zriz reads the format from the first 4096 bytes of the file, so a wrong name or a wrong raster mime type does not stop a photo from opening. a file declared as a raster image type never opens as svg, and `svg={false}` on `Root` or `svg: false` on `loadImage` refuses svg altogether. both fail with `decode`. when `src` changes, zriz cancels a load that is still running and keeps `onError` quiet for it. the previous photo stays on screen until the new one is ready, and stays there when the new one fails."
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
          ["jpeg, png, webp, avif, gif", "open in every current browser"],
          [
            "bmp",
            "opens in every current browser, but safari cannot open some bmp files with a v4 or v5 header. those fail with `decode`. pass a `decode` function to open them, or convert the file to jpeg first",
          ],
          [
            "heic, jpeg xl, tiff",
            "open where the browser decodes them. they fail with `unsupported-format` elsewhere, and when the file is damaged",
          ],
          [
            "svg",
            "takes its size from `width` and `height` in px, in, cm, mm, q, pt or pc, or from `viewBox`. a missing width opens at 300 and a missing height at 150. zriz draws it once at that size, at most the preview size, and exports from that drawing",
          ],
          [
            "animated gif, png, webp, avif",
            "open on their first frame. `animated` on the loaded image is `true`, and always for a gif. an `img` already playing opens on the frame it shows in safari, so pass a `Blob` for the first frame",
          ],
        ],
      }),
      p(
        "zriz walks the structure of a jpeg, png, avif or heic before it decodes, so a file cut short fails with `decode` in every browser. data after the end of the file still opens. firefox opens a cut gif, and firefox and safari open a cut bmp, with the missing part painted in."
      ),
      p(
        "zriz measures the crop value and the export plan in the photo as the browser shows it. every exif orientation in a jpeg opens upright in every browser. chromium and firefox ignore the orientation of a webp and safari honours it, so a tagged webp opens differently per browser, and the route in [server crop](server-crop) refuses it."
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
            "twice the screen's long edge in device pixels, at most 4096 px on a touch screen and 8192 px elsewhere. `previewEdge` on `Root` sets it",
          ],
          [
            "export size",
            "16.8 megapixels on a touch screen and 268 megapixels elsewhere, with a long edge of at most 16383 px for webp and 65500 px for other types. a bigger crop comes out scaled down",
          ],
        ],
      }),
      p(
        "before it decodes, zriz reads the pixel count from the file's header. a jpeg, png, webp, avif, heic, gif, bmp or tiff over `maxPixels` fails with `too-large`. a gif counts its largest frame. a jpeg xl has no count zriz can read, so it fails after the decode, and so does what a `decode` function returns. the limit is 268402689 pixels, which opens every camera photo and matches sharp. pass `maxPixels` to `loadImage` to change it."
      ),
      p(
        "a load has one time limit. a download stays inside it while bytes keep arriving, and the decode gets what is left after the last byte. past it the load fails with `timeout`, and [errors](errors) gives the number. zriz runs six downloads and three decodes at a time, and a photo waiting for its turn is not on the clock. a url that hangs holds one of the six until the limit. to allow more time, load the photo yourself and pass `timeout`, as in the heic section below."
      ),
      p("a content security policy needs these sources:"),
      table({
        columns: [
          column("directive", "prose"),
          column("what it enables", "prose"),
        ],
        rows: [
          [
            "`worker-src blob:`",
            "decoding and exporting off the main thread. without it zriz does both on the main thread, and the page can stutter while a large photo opens",
          ],
          [
            "`img-src blob:`",
            "the moving layer during gestures and display-p3 export. without it the photo paints on the canvas during gestures, a crop with perspective stays empty, and a display-p3 export fails with `decode`",
          ],
          [
            "`img-src data:`",
            "svg files. without it an svg fails with `decode`",
          ],
          [
            "`connect-src`",
            "each host you load photos from, plus `blob:` and `data:` if you pass those urls as `src`. without it the load fails with `cross-origin`",
          ],
        ],
      }),
      p(
        "with `require-trusted-types-for 'script'`, add `zriz` to `trusted-types`. zriz starts its workers through a policy of that name, and the policy only takes `blob:` urls. without it the page works, but decodes and exports on the main thread."
      ),
      p(
        "a strict `style-src` also refuses `style` attributes in server html. the parts write their own styles again during hydration, so they work after it. a `style` prop of yours on a server rendered part stays refused. add `style-src-attr 'unsafe-inline'` to allow it."
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
        "`ready` turns the save button on once the photo is attached. `onSave` gets the cropper for `exportCrop`, as in [exporting](exporting). a new pick or an unmount aborts the load still running, so a slow file never replaces a newer one or lands on a cropper that left."
      ),
      p(
        "`loadImage` also takes `timeout` in milliseconds, `previewEdge`, the longest side of the preview in pixels, `maxPixels`, `svg`, `crossOrigin` and an abort `signal`. it accepts an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` as its source. a `video` needs a current frame, so wait for `loadeddata` or `seeked`, or the load fails with `decode`. a frame with nothing opaque in it counts as no frame."
      ),
      p(
        "`attachImage` frees a photo when it leaves its last cropper, and `destroy()` does the same for the photo on that cropper. attaching to a destroyed cropper frees the photo at once. a freed photo cannot be attached again, so load it again. a photo that never reached a cropper holds memory until you call `discardImage(image)`, for example after your own stale check or an `exportImage` with no `attachImage`. it does nothing while a cropper holds the photo."
      ),
      p(
        "zriz never closes an `ImageBitmap` you pass as the source. close it yourself once the photo left its cropper, and not before."
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
