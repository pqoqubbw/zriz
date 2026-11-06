import {
  code,
  column,
  defineDoc,
  messages,
  p,
  section,
  table,
} from "@/lib/doc/define";

const ERRORS_PAGE = defineDoc({
  blocks: [
    section(
      "Where errors arrive",
      p(
        "`Root` calls `onError` with a `ZrizError` when a photo cannot load. `ZrizError` comes from `@zriz/core/dom`, like `loadImage` and `exportCrop`. `attachImage` throws `no-image` at once when the photo was already freed. `loadImage` and `exportCrop` reject, so catch them where you call them:"
      ),
      code("errors/save.ts"),
      p(
        "Every `ZrizError` has a `code` from the table below, and its message starts with `zriz:`. The one exception is a `decode` function you pass to `loadImage`: when it throws, `loadImage` rejects with your own error as it is."
      )
    ),
    section(
      "Codes",
      table({
        columns: [
          column("Code", "mono", { width: 200 }),
          column("When it fires, and the fix", "prose"),
        ],
        fix: "Fix",
        rows: [
          [
            "cross-origin",
            "The server sent the photo without `Access-Control-Allow-Origin`, the network dropped, `connect-src` in a content security policy blocked the URL, or an `img`, `video`, `canvas` or `ImageBitmap` you pass is tainted",
            'Send the header. If the request needs cookies, pass `crossOrigin="use-credentials"` to `Root`. Add the host to `connect-src`, as in [loading images](loading-images)',
          ],
          [
            "unsupported-format",
            "The browser could not decode a HEIC, JPEG XL or TIFF file, because it does not support the format or the file is damaged, either on load or when an export decodes the original again",
            "Try another copy of the file. Call `loadImage` yourself with your own `decode` function, as in [loading images](loading-images), or convert the file to JPEG first",
          ],
          [
            "decode",
            "The URL answered with an error status, the file cannot be read, the file is cut short, the bytes are not an image, Safari refused a BMP with a v4 or v5 header, a zriz chunk failed to download, an `img`, `video` or `canvas` you pass cannot be read, a `video` has no current frame, `img-src` in a content security policy blocked an SVG or a display-p3 export, the browser gave no 2D canvas, or an export could not decode the original again",
            "Open the URL and check the response. If you are offline, try again once the network is back. If the same error comes back, reload the page, because a browser can keep a failed chunk until then. Wait for `loadeddata` before you pass a `video`. [Loading images](loading-images) lists the `img-src` sources",
          ],
          [
            "too-large",
            "A file's header or decoded image has more pixels than `maxPixels`, 268402689 by default. This also covers a `decode` function, but not an SVG or an `img`, `video`, `canvas`, `OffscreenCanvas` or `ImageBitmap` source",
            "Send a smaller file. To open it anyway, load the photo yourself with a higher `maxPixels`, as in [loading images](loading-images)",
          ],
          [
            "timeout",
            "A URL sent no bytes for 15 s, a photo took over 15 s to decode after its last byte, or an export took over 30 s. Time spent waiting behind other photos or exports does not count",
            "Send a smaller file or export a smaller `maxSize`. For a slow network, load the photo yourself with a longer `timeout`, as in [loading images](loading-images)",
          ],
          [
            "aborted",
            "The `signal` you passed fired, a new photo or a detach came while the export code was still downloading, or a photo from an `img`, `video`, `canvas`, SVG or `decode` function was freed while the export waited its turn. A new photo after that does not stop the export and you get the old crop, so abort with your own `signal` when the photo changes. `Root` also aborts its own load when `src` changes and never reports it",
            "Nothing. Skip this code in your catch",
          ],
          [
            "blank",
            "The browser drew an empty canvas at the export size, then at half and a quarter of it. This is the canvas memory limit, mostly on phones",
            "Set `maxSize` to 2048 by 2048 or less",
          ],
          [
            "no-image",
            "An export ran before a photo loaded, the app attached a photo that was already freed, or the app has two copies of `@zriz/core` and the export came from the one that never got the photo. A detach before the export call, even with an aborted signal, gives this code. A detach in the same tick right after the call gives `aborted`",
            "Disable the export button until `onLoad` fires. Load a freed photo again. Keep `@zriz/core` at the same version as `@zriz/react`",
          ],
        ],
      })
    ),
    section(
      "Thrown errors",
      p(
        "These are plain `Error` objects that React shows in its error overlay. The first three mean a part or hook cannot find its cropper. `toSharp` throws the last one as a `RangeError`, usually on your server."
      ),
      messages("Message", [
        {
          fix: "Move the part inside `Root`. A part in a portal still needs `Root` above it in the React tree",
          message: "zriz: parts must be inside <Cropper.Root>",
        },
        {
          fix: "A hook such as `useCropperValue` or `useZoom` ran outside `Root`. Pass it the cropper from `useCropper`, or move the component inside `Root`",
          message: "zriz: pass a cropper or render inside <Cropper.Root>",
        },
        {
          fix: "`Root` got `cropper` on its first render and none later. Keep passing the same cropper, or give `Root` a new `key` to start a new one",
          message: "zriz: no cropper",
        },
        {
          fix: "Pass `toSharp` the plan from `getPixelCrop()` or a `commit`, and the size of the same photo, both unchanged. When `pixelRect` is `null`, a bad `forward`, a side that is not a whole number of at least 1, or a crop fully outside the photo throws this. A plan with a `pixelRect` gets no check, so recompute the plan on your server as [server crop](server-crop) does",
          message: "zriz: this is not an export plan",
        },
      ])
    ),
    section(
      "Console warnings",
      p(
        "In development, `Area`, `Dial` and `Zoom` each warn once when nothing names them, `Dial` and `Zoom` warn once for a `locale` or `format` the browser refuses, and a second visible `Viewport` on one cropper warns once. The message has the part's name. Production builds print nothing."
      ),
      messages("Message", [
        {
          fix: "Name the part. [Accessibility](accessibility) shows how to label each part",
          message:
            "zriz: <Cropper.Area> needs aria-label or aria-labelledby. zriz ships no words, so screen readers get nothing otherwise.",
        },
        {
          fix: "Pass a locale tag like `en-US` and options `Intl.NumberFormat` accepts. Until then a refused locale speaks in the browser's locale and a refused format speaks the default text",
          message:
            "zriz: <Cropper.Dial> ignores a locale or format the browser refuses. A refused locale falls back to the browser's, and a refused format to the default value text.",
        },
        {
          fix: "Render one `Viewport` per cropper, and draw a live preview with `useCropperFrame`, see [viewport](viewport)",
          message:
            "zriz: one <Cropper.Viewport> per cropper. A second one takes over the layout. Draw a live preview with useCropperFrame.",
        },
      ])
    ),
  ],
  lede: "Every error zriz throws or reports, when it happens and how to fix it.",
});

export { ERRORS_PAGE };
