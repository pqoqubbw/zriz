import { code, defineDoc, demo, p, props, section } from "@/lib/doc/define";

export const exporting = defineDoc({
  blocks: [
    demo("exporting"),
    section(
      "save the crop as a file",
      p(
        "`exportCrop` comes from `@zriz/core/dom`. `@zriz/react` depends on `@zriz/core` and re-exports `CropValue`, `Cropper`, `CropperSnapshot`, `Aspect`, `Size`, `ChangeDetails` and `CommitDetails`. functions and the other core types, such as `ChangeReason` and `ExportPlan`, come from `@zriz/core`, so add it to your own dependencies:"
      ),
      code("exporting/install.sh"),
      p(
        "keep it at the same version as `@zriz/react`. a second copy of `@zriz/core` cannot see the photo, see `no-image` on [errors](errors)."
      ),
      p(
        "pass a ref to `actionsRef` on `Root`, and pass `cropper.current` to `exportCrop` from a save button. the button stays disabled until `onLoad` fires for this file, because an export before the photo loads rejects with `no-image`:"
      ),
      code("exporting/save-crop.tsx"),
      p(
        "an export can fail on a very large photo, so the snippet catches it. [errors](errors) lists the codes."
      ),
      p(
        "the export draws from the original, not the preview on screen. without `maxSize`, the file has the crop's size in source pixels."
      )
    ),
    section(
      "export a round avatar",
      p(
        'with `shape="circle"` on `Root`, `exportCrop` reads the shape and returns a png with transparent corners. `exportImage(cropper, image)` exports a `LoadedImage` from `loadImage` instead. it does not read the shape, so pass `shape: "circle"` yourself. [avatar](avatar) has the whole component.'
      )
    ),
    section(
      "choose size and format",
      props(
        [
          {
            default: '"image/jpeg"',
            name: "type",
            text: "the file format. a circle crop defaults to png",
            type: '"image/jpeg" | "image/png" | "image/webp"',
          },
          {
            default: "0.9",
            name: "quality",
            text: "jpeg and webp quality, from 0 to 1",
            type: "number",
          },
          {
            name: "maxSize",
            text: "scales the file down to fit inside this box, never up",
            type: "{ width, height }",
          },
          {
            default: '"srgb"',
            name: "colorSpace",
            text: '`"display-p3"` keeps wide colour when the photo came from a file or url. it decodes on the main thread',
            type: '"srgb" | "display-p3"',
          },
          {
            name: "shape",
            text: '`"rect"` cuts a rectangle. `"circle"` cuts a circle with transparent corners. defaults to `shape` on `Root`',
            type: '"rect" | "circle"',
          },
          {
            name: "signal",
            text: "cancels a running export, which then rejects with `aborted`",
            type: "AbortSignal",
          },
        ],
        "option"
      ),
      p(
        "`exportCrop` resolves to `{ blob, type, width, height, scaled, crop }`. read `type` before you name the file, because a browser that cannot encode the type you asked for returns png. `scaled` is `true` when the file came out smaller than the crop. three things cause it: `maxSize`, the export size limit in [loading images](loading-images), and the `blank` retry on [errors](errors). `crop` is the export plan the file was drawn from, at the scale it came out."
      ),
      p("the browser drops exif, gps data and 16-bit depth from the file.")
    ),
    section(
      "export an exact size",
      p(
        "`maxSize` never scales up, so a crop smaller than the box comes out smaller. set `minSize` on `Root` to the same size, and every crop is at least that big in source pixels. on a photo at least that big, a square crop with `minSize` and `maxSize` both at 512 by 512 exports at 512 by 512."
      )
    ),
    section(
      "handle a failed export",
      p(
        "`exportCrop` rejects with a `ZrizError`. [errors](errors) lists each code an export can fail with, when it fires and how to fix it."
      ),
      p(
        "after the first photo appears, zriz loads the export code in the background, so the first export does not wait for a download."
      )
    ),
    section(
      "show a small preview of the crop",
      p(
        "call `exportCrop` with a small `maxSize` in `onLoad` and in `onValueCommit`, and show the blob with `URL.createObjectURL()`. a photo nobody touches sends no commit, so `onLoad` draws the first preview. pass an `AbortController` `signal` and abort the last export on each commit, so a slow one never overwrites a newer one. revoke the old object url when a new preview replaces it:"
      ),
      code("exporting/preview.tsx")
    ),
    section(
      "cut the original on a server",
      p(
        "call `getPixelCrop()` when you upload, because a photo the user never touches sends no commit. it returns the export plan in source pixels, or `null` until a photo loads. each commit also carries it as `details.pixelCrop`. send the whole plan with the file, because `pixelRect` is `null` with a straighten angle or perspective."
      ),
      props(
        [
          {
            name: "width",
            text: "the output width in pixels, never below 1 px. `getPixelCrop()` takes a scale, 1 by default.",
            type: "number",
          },
          {
            name: "height",
            text: "the output height in pixels at the same scale.",
            type: "number",
          },
          {
            name: "pixelRect",
            text: "`{ left, top, width, height }` in the upright original, or `null` with a straighten angle or perspective.",
            type: "PixelRect | null",
          },
          {
            name: "rotateExpand",
            text: "the mirror as `flop`, the quarter turns times 90 plus the straighten angle as `degrees`, and the crop's centre from the photo's centre after that whole turn as `dx` and `dy`, in source pixels.",
            type: "{ flop, degrees, dx, dy }",
          },
          {
            name: "forward",
            text: "the map from source pixels to output pixels, as `[a, b, c, d, e, f]` in canvas `setTransform()` order.",
            type: "AffineMatrix",
          },
          {
            name: "inverse",
            text: "the map from output pixels back to source pixels.",
            type: "AffineMatrix",
          },
          {
            name: "homography",
            text: "the 3 by 3 perspective matrix, or `null` with no perspective.",
            type: "Matrix3 | null",
          },
        ],
        "field"
      ),
      p(
        "with no straighten and no perspective, the plan comes down to plain numbers that any tool can use: the rectangle, the flop and the turn."
      ),
      p(
        "`toSharp` from `@zriz/core` turns the plan into sharp steps. [server crop](server-crop) shows the route for a level crop and a straightened one."
      )
    ),
  ],
  lede: "turn the crop into an image file in the browser, or send the export plan to your server and cut the original there.",
});
