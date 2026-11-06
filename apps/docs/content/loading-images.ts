import { code, column, defineDoc, p, section, table } from "@/lib/doc/define";

const LOADING_IMAGES_PAGE = defineDoc({
  blocks: [
    section(
      "Open a file from an input",
      p(
        "`src` on `Root` takes a URL string, a `Blob`, a `File`, or `null` for an empty cropper. Keep the picked file in state and pass it straight to `src`:"
      ),
      code("loading-images/picker.jsx.tsx"),
      p(
        "zriz reads the format from the first 4096 bytes of the file, so a wrong name or a wrong raster mime type does not stop a photo from opening. A file declared as a raster image type never opens as SVG, and `svg={false}` on `Root` or `svg: false` on `loadImage` refuses SVG altogether. Both fail with `decode`. When `src` changes, zriz cancels a load that is still running and keeps `onError` quiet for it. The previous photo stays on screen until the new one is ready, and stays there when the new one fails."
      )
    ),
    section(
      "Start each photo from the full frame",
      p(
        "A new `src` keeps the current crop, angle and flip, and fits them to the new photo. A controlled `zoom` goes back to the prop when the new photo has another size. To start every photo from the whole frame, give `Root` a `key` that changes with each pick, such as a counter you bump in `onChange`. A new `key` also frees the previous photo at once."
      ),
      code("loading-images/key.jsx.tsx")
    ),
    section(
      "Open a URL on another domain",
      p(
        "zriz fetches a URL with `fetch` in CORS mode, so the server that hosts the photo must send `Access-Control-Allow-Origin`. Without it, the load fails with `cross-origin`. A 404 or any other error status fails with `decode`."
      ),
      p(
        'If that server needs cookies, pass `crossOrigin="use-credentials"`. The server then has to name your origin in `Access-Control-Allow-Origin`, not `*`, and send `Access-Control-Allow-Credentials: true`.'
      ),
      p(
        "If that server wants a token in a header, fetch the photo yourself with that header and pass the response's blob to `src`."
      )
    ),
    section(
      "Check which formats open",
      table({
        columns: [column("Format", "prose"), column("What happens", "prose")],
        rows: [
          ["JPEG, PNG, WebP, AVIF, GIF", "Open in every current browser"],
          [
            "BMP",
            "Opens in every current browser, but Safari cannot open some BMP files with a v4 or v5 header. Those fail with `decode`. Pass a `decode` function to open them, or convert the file to JPEG first",
          ],
          [
            "HEIC, JPEG XL, TIFF",
            "Open where the browser decodes them. They fail with `unsupported-format` elsewhere, and when the file is damaged",
          ],
          [
            "SVG",
            "Takes its size from `width` and `height` in px, in, cm, mm, q, pt or pc, or from `viewBox`. With one side and a `viewBox`, the other follows the ratio. With no `viewBox`, a missing width opens at 300 and a missing height at 150. A side in `%` or `em` counts as missing. zriz draws it once at that size, at most the preview size, and exports from that drawing",
          ],
          [
            "Animated GIF, PNG, WebP, AVIF",
            "Open on their first frame. From a file or URL, `animated` on the loaded image is `true`, and always for a GIF. A HEIC sequence also reports `true`. An `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` source always reports `false`, even an `img` showing a GIF. An `img` already playing opens on the frame it shows in Safari, so pass a `Blob` for the first frame",
          ],
        ],
      }),
      p(
        "zriz walks the structure of a JPEG, PNG, AVIF or HEIC before it decodes, so a file cut short fails with `decode` in every browser. Data after the end of the file still opens. Firefox opens a cut GIF, and Firefox and Safari open a cut BMP, with the missing part painted in."
      ),
      p(
        "zriz measures the crop value and the export plan in the photo as the browser shows it. Every EXIF orientation in a JPEG opens upright in every browser. Chromium and Firefox ignore the orientation of a WebP and Safari honours it, so a tagged WebP opens differently per browser, and the route in [server crop](server-crop) refuses it."
      )
    ),
    section(
      "Handle large photos",
      p(
        "A worker decodes a preview sized for the screen. The original stays a blob until you export."
      ),
      table({
        columns: [column("Limit", "prose"), column("Size", "prose")],
        rows: [
          [
            "Preview size",
            "Twice the screen's long edge in device pixels, at most 4096 px on a touch screen and 8192 px elsewhere. `previewEdge` on `Root` sets it",
          ],
          [
            "Export size",
            "16.8 megapixels on a touch screen and 268 megapixels elsewhere, with a long edge of at most 16383 px for WebP and 65500 px for other types. A bigger crop comes out scaled down",
          ],
        ],
      }),
      p(
        "Before it decodes, zriz reads the pixel count from the file's header. A JPEG, PNG, WebP, AVIF, HEIC, GIF, BMP or TIFF over `maxPixels` fails with `too-large`. A GIF counts its largest frame. A JPEG XL has no count zriz can read, so it fails after the decode, and so does what a `decode` function returns. The limit is 268402689 pixels, which opens every camera photo and matches sharp. Pass `maxPixels` to `loadImage` to change it. `maxPixels` does not apply to an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` source, or to an SVG, which zriz draws at most at the preview size."
      ),
      p(
        "A load has one time limit. A download stays inside it while bytes keep arriving, and the decode gets what is left after the last byte. Past it the load fails with `timeout`, and [errors](errors) gives the number. zriz runs six downloads and three decodes at a time, and a photo waiting for its turn is not on the clock. A URL that hangs holds one of the six until the limit. To allow more time, load the photo yourself and pass `timeout`, as in the HEIC section below."
      ),
      p("A content security policy needs these sources:"),
      table({
        columns: [
          column("Directive", "prose"),
          column("What it enables", "prose"),
        ],
        rows: [
          [
            "`worker-src blob:`",
            "Decoding and exporting off the main thread. Without it zriz does both on the main thread, and the page can stutter while a large photo opens",
          ],
          [
            "`img-src blob:`",
            "The moving layer during gestures and display-p3 export. Without it the photo paints on the canvas during gestures, a crop with perspective stays empty, and a display-p3 export fails with `decode`",
          ],
          [
            "`img-src data:`",
            "SVG files. Without it an SVG fails with `decode`",
          ],
          [
            "`connect-src`",
            "Each host you load photos from, plus `blob:` and `data:` if you pass those URLs as `src`. Without it the load fails with `cross-origin`",
          ],
        ],
      }),
      p(
        "With `require-trusted-types-for 'script'`, add `zriz` to `trusted-types`. zriz starts its workers through a policy of that name, and the policy only takes `blob:` URLs. Without it the page works, but decodes and exports on the main thread."
      ),
      p(
        "A strict `style-src` also refuses `style` attributes in server HTML. The parts write their own styles again during hydration, so they work after it. A `style` prop of yours on a server rendered part stays refused. Add `style-src-attr 'unsafe-inline'` to allow it, or give the part a class from your stylesheet instead."
      )
    ),
    section(
      "Open HEIC on every browser",
      p(
        "To decode a format the browser cannot, call `loadImage` yourself and pass a `decode` function. zriz calls it only when the browser's own decode fails. It gets the `Blob` and returns an `ImageBitmap`. Save this as `decoder.ts`. Its `convert` sends the file to a route on your server that turns it into JPEG, so the original leaves the device. [Security](security) says how to treat it. `loadImage` and `attachImage` come from `@zriz/core/dom`, so add `@zriz/core` as in [exporting](exporting):"
      ),
      code("loading-images/decoder.ts"),
      p(
        "Pass a ref to `actionsRef`, leave `src` unset on `Root` and call `open()` from the file input. `onLoad` and `onError` do not fire for a photo you attach yourself, so the component tracks both from `open()`:"
      ),
      code("loading-images/heic.tsx"),
      p(
        "`ready` turns the save button on once the photo is attached. `onSave` gets the cropper for `exportCrop`, as in [exporting](exporting). A new pick or an unmount aborts the load still running, so a slow file never replaces a newer one or lands on a cropper that left."
      ),
      p(
        "`loadImage` also takes `timeout` in milliseconds, `previewEdge`, the longest side of the preview in pixels, `maxPixels`, `svg`, `crossOrigin` and an abort `signal`. It accepts an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` as its source. A `video` needs a current frame, so wait for `loadeddata` or `seeked`, or the load fails with `decode`. A fully transparent frame counts as no frame."
      ),
      p(
        "`attachImage` frees a photo when it leaves its last cropper, and `destroy()` does the same for the photo on that cropper. Attaching to a destroyed cropper frees the photo at once. A freed photo cannot be attached again, so load it again. A photo that never reached a cropper holds memory until you call `discardImage(image)`, for example after your own stale check or an `exportImage` with no `attachImage`. It does nothing while a cropper holds the photo."
      ),
      p(
        "zriz never closes an `ImageBitmap` you pass as the source. Close it yourself once the photo left its cropper, and not before."
      )
    ),
    section(
      "Handle a failed load",
      p(
        "`onError` on `Root` gets a `ZrizError`. Its `code` names the problem, such as `timeout` or `cross-origin`. `onLoad` fires instead when the photo is ready, with its `width`, `height` and `mime`. [Errors](errors) lists every code with its fix."
      )
    ),
  ],
  lede: "Open a photo from a file input, a URL or a blob, and check which formats and sizes load.",
});

export { LOADING_IMAGES_PAGE };
