import { code, defineDoc, demo, p, props, section } from "@/lib/doc/define";

const EXPORTING_PAGE = defineDoc({
  blocks: [
    demo("exporting"),
    section(
      "save the crop as a file",
      p(
        "`exportCrop` comes from `@zriz/core/dom`. `@zriz/react` needs `@zriz/core` as a peer dependency and re-exports the types an editor needs, such as `CropValue`, `Cropper` and `ChangeReason`. the types of `exportCrop` and `loadImage`, such as `ExportOptions`, `ExportResult`, `LoadedImage` and `ZrizErrorCode`, come from `@zriz/core/dom` too. pure functions and the other core types, such as `parse` and `ExportPlan`, come from `@zriz/core`. [quick start](quick-start) installs it. without react, add it alone:"
      ),
      code("exporting/install.sh"),
      p(
        "keep it at the version `@zriz/react` asks for. a second copy of `@zriz/core` cannot see the photo, see `no-image` on [errors](errors)."
      ),
      p(
        "pass a ref to `actionsRef` on `Root`, and pass `cropper.current` to `exportCrop` from a save button. the button stays disabled until `onLoad` fires for this file, because an export before the photo loads rejects with `no-image`:"
      ),
      code("exporting/save-crop.tsx"),
      p(
        "an export can fail on a very large photo, so the snippet catches it. [errors](errors) lists the codes. `running` holds the export in flight. a second click does nothing, and a new file aborts it, so an old crop never downloads after the photo changed."
      ),
      p(
        "the demo above runs this export with the same `maxSize`, in the format you pick in its track, and uses the styles from the zriz site."
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
            text: "the file format. a circle crop defaults to png. jpeg has no transparency, so clear pixels come out white",
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
            text: "scales the file down to fit inside this box, never up. a box with a side that is not a positive number is ignored",
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
            text: '`"rect"` cuts a rectangle. `"circle"` cuts a circle, with transparent corners in png and webp and white ones in jpeg. defaults to `shape` on `Root`',
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
        "`exportCrop` resolves to `{ blob, type, width, height, scaled, crop }`. read `type` before you name the file, because a browser that cannot encode the type you asked for returns png. `scaled` is `true` when the file came out smaller than the crop. three things cause it: `maxSize`, the export size limit in [loading images](loading-images), and the retry at half and a quarter of the size when the browser cannot draw or encode the file. `crop` is the export plan the file was drawn from, at the scale it came out."
      ),
      p(
        "exports run one at a time, in the order you call them. an aborted export stops waiting at once, but one the browser already started holds the next one back until it ends."
      ),
      p(
        "the browser draws pixels onto a canvas and encodes them, so exif, gps, xmp, thumbnails, gain maps and bytes after the image never reach the file, and neither does 16-bit depth. safari writes a small exif block of its own, with only the crop's size and colour space. [security](security) covers the original, which keeps all of it."
      )
    ),
    section(
      "export an exact size",
      p(
        "`maxSize` never scales up, so a crop smaller than the box comes out smaller. set `minSize` on `Root` to the same size, and every crop is at least that big in source pixels. on a photo at least that big, a square crop with `minSize` and `maxSize` both at 512 by 512 exports at 512 by 512."
      ),
      p(
        "`minSize` reads along the photo's own sides, so after a quarter turn a 1200 by 630 minimum can export at 630 by 1200. while you straighten a crop of another shape than the minimum, covering the photo comes first, so that crop can drop below it. the angle stays free while the minimum's diagonal fits along each side of the photo, so only the minimum's size next to the photo counts. a bigger minimum lowers `getRotationLimit()` below 45, and on a square photo that starts at a square minimum of about 71% of its side. the crop does not grow back on its own."
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
        "call `exportCrop` with a small `maxSize` in `onLoad` and in `onValueCommit`, and show the blob with `URL.createObjectURL()`. the first photo sends no commit until someone touches it, so `onLoad` draws the first preview. a later photo commits only when it has to refit the crop. pass an `AbortController` `signal` and abort the last export on each commit, so a slow one never overwrites a newer one. revoke the old object url when a new preview replaces it:"
      ),
      code("exporting/preview.tsx")
    ),
    section(
      "cut the original on a server",
      p(
        "to cut on a server, send the crop value from `getValue()` and let the server recompute the plan, as in [server crop](server-crop). never trust a plan a client sends. `getPixelCrop()` returns the export plan in source pixels, or `null` until a photo loads, and each commit carries it as `details.pixelCrop`. use it for your own tools, and read all of it, because `pixelRect` is `null` with a straighten angle or perspective."
      ),
      props(
        [
          {
            name: "width",
            text: "the output width in pixels, never below 1 px. `getPixelCrop()` takes a scale, 1 by default and for anything but a positive number or a scale that pushes a side past `Number.MAX_SAFE_INTEGER`",
            type: "number",
          },
          {
            name: "height",
            text: "the output height in pixels at the same scale",
            type: "number",
          },
          {
            name: "pixelRect",
            text: "`{ left, top, width, height }` in the upright original, or `null` with a straighten angle or perspective",
            type: "{ left, top, width, height } | null",
          },
          {
            name: "rotateExpand",
            text: "the mirror as `flop`, the quarter turns times 90 plus the straighten angle as `degrees`, and the crop's centre from the photo's centre after that whole turn as `dx` and `dy`, in source pixels",
            type: "{ flop, degrees, dx, dy }",
          },
          {
            name: "forward",
            text: "the map from source pixels to output pixels, as `[a, b, c, d, e, f]` in canvas `setTransform()` order. alone it holds only when `homography` is `null`. with perspective, `output = forward(c + H(s - c))`, with `c` the centre of the image in source pixels",
            type: "[a, b, c, d, e, f]",
          },
          {
            name: "inverse",
            text: "the map from output pixels back to source pixels. alone it holds only when `homography` is `null`. with perspective, the source pixel is `s = c + H⁻¹(inverse(output) - c)`, with `c` as above",
            type: "[a, b, c, d, e, f]",
          },
          {
            name: "homography",
            text: "the 3 by 3 perspective matrix `H`, as 9 numbers row by row, or `null` with no perspective. divide by the third coordinate after you apply it",
            type: "number[] | null",
          },
        ],
        "field"
      ),
      p(
        "with no straighten and no perspective, the plan comes down to plain numbers that any tool can use: the rectangle, the flop and the turn. `pixelRect` is the truth for the file: its edges land on whole source pixels, so on a very small photo the frame on screen can sit up to half a source pixel from the file edge. a side never goes below 1 px, so a thin crop can come out slightly over `maxSize`."
      ),
      p(
        '`toSharp(plan, image)` from `@zriz/core` takes the plan and the upright photo\'s size and returns sharp steps with `kind` `"extract"` or `"affine"`. it ignores perspective without an error, so check `plan.homography` first. [server crop](server-crop) shows the route for a level crop and a straightened one.'
      )
    ),
  ],
  lede: "turn the crop into an image file in the browser, or send the crop value to your server and cut the original there.",
});

export { EXPORTING_PAGE };
