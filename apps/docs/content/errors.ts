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
      "where errors arrive",
      p(
        "`Root` calls `onError` with a `ZrizError` when a photo cannot load. `ZrizError` comes from `@zriz/core/dom`, like `loadImage` and `exportCrop`. `loadImage` and `exportCrop` reject instead, so catch them where you call them:"
      ),
      code("errors/save.ts"),
      p(
        "every `ZrizError` has a `code` from the table below, and its message starts with `zriz:`. the one exception is a `decode` function you pass to `loadImage`: when it throws, `loadImage` rejects with your own error as it is."
      )
    ),
    section(
      "codes",
      table({
        columns: [
          column("code", "mono", { width: 200 }),
          column("when it fires, and the fix", "prose"),
        ],
        fix: "fix",
        rows: [
          [
            "cross-origin",
            "the server sent the photo without `Access-Control-Allow-Origin`, the network dropped, `connect-src` in a content security policy blocked the url, or an `img`, `video`, `canvas` or `ImageBitmap` you pass is tainted",
            'send the header. if the request needs cookies, pass `crossOrigin="use-credentials"` to `Root`. add the host to `connect-src`, as in [loading images](loading-images)',
          ],
          [
            "unsupported-format",
            "the browser could not decode a heic, jpeg xl or tiff file, because it does not support the format or the file is damaged, either on load or when an export decodes the original again",
            "try another copy of the file. call `loadImage` yourself with your own `decode` function, as in [loading images](loading-images), or convert the file to jpeg first",
          ],
          [
            "decode",
            "the url answered with an error status, the file cannot be read, the file is cut short, the bytes are not an image, safari refused a bmp with a v4 or v5 header, a zriz chunk failed to download, an `img`, `video` or `canvas` you pass cannot be read, a `video` has no current frame, `img-src` in a content security policy blocked an svg or a display-p3 export, the browser gave no 2d canvas, or an export could not decode the original again",
            "open the url and check the response. if you are offline, try again once the network is back. if the same error comes back, reload the page, because a browser can keep a failed chunk until then. wait for `loadeddata` before you pass a `video`. [loading images](loading-images) lists the `img-src` sources",
          ],
          [
            "too-large",
            "the file's header asks for more pixels than `maxPixels`, 268402689 by default",
            "send a smaller file. to open it anyway, load the photo yourself with a higher `maxPixels`, as in [loading images](loading-images)",
          ],
          [
            "timeout",
            "a url sent no bytes for 15 s, a photo took over 15 s to decode after its last byte, or an export took over 30 s. time spent waiting behind other photos or exports does not count",
            "send a smaller file or export a smaller `maxSize`. for a slow network, load the photo yourself with a longer `timeout`, as in [loading images](loading-images)",
          ],
          [
            "aborted",
            "the `signal` you passed fired while the photo was still attached, or a new photo arrived after the export had started drawing. `Root` also aborts its own load when `src` changes and never reports it",
            "nothing. skip this code in your catch",
          ],
          [
            "blank",
            "the browser drew an empty canvas at the export size, then at half and a quarter of it. this is the canvas memory limit, mostly on phones",
            "set `maxSize` to 2048 by 2048 or less",
          ],
          [
            "no-image",
            "an export ran before a photo loaded, the app attached a photo that was already freed, or the app has two copies of `@zriz/core` and the export came from the one that never got the photo. a detach in the same tick as the export, even with an aborted signal, gives this code",
            "disable the export button until `onLoad` fires. load a freed photo again. keep `@zriz/core` at the same version as `@zriz/react`",
          ],
        ],
      })
    ),
    section(
      "thrown errors",
      p(
        "these are plain `Error` objects that react shows in its error overlay. they mean a part or hook cannot find its cropper."
      ),
      messages("message", [
        {
          fix: "move the part inside `Root`. a part in a portal still needs `Root` above it in the react tree",
          message: "zriz: parts must be inside <Cropper.Root>",
        },
        {
          fix: "a hook such as `useCropperValue` or `useZoom` ran outside `Root`. pass it the cropper from `useCropper`, or move the component inside `Root`",
          message: "zriz: pass a cropper or render inside <Cropper.Root>",
        },
        {
          fix: "`Root` got `cropper` on its first render and none later. keep passing the same cropper, or give `Root` a new `key` to start a new one",
          message: "zriz: no cropper",
        },
      ])
    ),
    section(
      "console warnings",
      p(
        "in development, `Area`, `Dial` and `Zoom` each warn once when nothing names them, and `Dial` and `Zoom` warn once for a `locale` or `format` the browser refuses. the message has the part's name. production builds print nothing."
      ),
      messages("message", [
        {
          fix: "name the part. [accessibility](accessibility) shows how to label each part",
          message:
            "zriz: <Cropper.Area> needs aria-label or aria-labelledby. zriz ships no words, so screen readers get nothing otherwise.",
        },
        {
          fix: "pass a locale tag like `en-US` and options `Intl.NumberFormat` accepts. until then the slider speaks its default text",
          message:
            "zriz: <Cropper.Dial> ignores a locale or format the browser refuses, and speaks its default value text instead.",
        },
      ])
    ),
  ],
  lede: "every error zriz throws or reports, when it happens and how to fix it.",
});

export { ERRORS_PAGE };
