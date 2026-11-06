import { code, column, defineDoc, p, section, table } from "@/lib/doc/define";

const SECURITY_PAGE = defineDoc({
  blocks: [
    section(
      "What zriz does on its own",
      p(
        "zriz sends nothing anywhere. The photo stays in the browser until your code uploads something. The browser decodes it in a worker, and an export draws pixels onto a canvas and encodes them, so only the crop's pixels reach the file."
      ),
      p(
        "We ran files carrying each of these blocks through `exportCrop` in Chromium, Firefox and WebKit, through the [server crop](server-crop) route, and through plain sharp, then parsed the results:"
      ),
      table({
        columns: [
          column("In the upload", "prose"),
          column("`exportCrop`", "prose"),
          column("Server crop route", "prose"),
          column("sharp with `keepMetadata()`", "prose"),
        ],
        rows: [
          ["GPS and EXIF", "Gone", "Gone", "Kept"],
          ["EXIF thumbnail of the whole photo", "Gone", "Gone", "Kept"],
          ["XMP and IPTC", "Gone", "Gone", "Kept"],
          ["Pixels outside the crop", "Gone", "Gone", "Gone"],
          [
            "A second image, video or other bytes after the image",
            "Gone",
            "Gone",
            "Gone",
          ],
          [
            "Gain map",
            "Gone",
            "Gone",
            "Gone, and `keepGainMap()` keeps a cropped one",
          ],
        ],
      }),
      p(
        "Safari writes a small EXIF block of its own into a JPEG or PNG, with only the crop's size and colour space."
      )
    ),
    section(
      "Treat the original as private",
      p(
        "Cropping hides part of a photo, and the original still holds all of it. The file a person picks carries their location, the time, the camera, a thumbnail of the uncropped frame, and on many phones a short video. Someone who crops a face or a street sign out expects it to be gone."
      ),
      p("What to do, best first:"),
      table({
        columns: [column("Choice", "prose"), column("What you do", "prose")],
        rows: [
          [
            "Upload the export",
            "Send the blob from `exportCrop` and never the file. The original stays on the device",
          ],
          [
            "Cut on the server and drop the original",
            "Use [server crop](server-crop), store the answer and let the upload go when the request ends. Don't write it to disk, to a queue or to logs",
          ],
          [
            "Keep a copy to crop again later",
            "Store the copy below in a private bucket, never at a public URL and never beside the crop, and tell the person you keep the whole frame. Delete it when they delete the crop",
          ],
        ],
      }),
      p(
        "`cleanCopy` decodes the upload and encodes it again, which drops every block in the table. It keeps every pixel and fills clear ones white, as the route does, so it is still the whole photo:"
      ),
      code("security/clean-copy.ts"),
      p(
        "On a pipeline opened from an upload, never call `keepMetadata()`, `keepExif()`, `withMetadata()`, `withExif()` or `withExifMerge()`. Each one kept the EXIF thumbnail in our test, so a crop can carry a small picture of the frame it cut away. To write your own tags, cut the photo to raw pixels first, as the route does, and add them to a new pipeline."
      ),
      p(
        "The crop value and `details.pixelCrop` tell where the crop sits and how large the original is. Keep them out of public URLs when that matters."
      )
    ),
    section(
      "Apple and phone formats",
      table({
        columns: [column("File", "prose"), column("What happens", "prose")],
        rows: [
          [
            "HEIC and HEIF",
            "Only Safari decodes them. Other browsers fail with `unsupported-format`, and prebuilt sharp has no HEVC decoder, so the route answers 415. A `decode` function, as in [loading images](loading-images), sends the original to your server, so the rules above apply to it",
          ],
          [
            "Live photo",
            "The still and the video are two files. zriz gets the file you pass and never sees the other. If your own picker uploads both, you upload the video too",
          ],
          [
            "Motion photo",
            "The video sits after the image in one file. Exports and the route drop it, and the original keeps it",
          ],
          [
            "Gain map, MPF",
            "A second image in the file for HDR screens, covering the whole frame. Exports and the route drop it, and the exported photo is SDR",
          ],
          [
            "P3 and other ICC profiles",
            "The colour is converted on decode. An export is sRGB unless you ask for `display-p3`, and the only profile in the file is the browser's own",
          ],
        ],
      })
    ),
    section(
      "Decoder bugs",
      p(
        "zriz has no image decoder of its own. In the browser the decoding is done by the browser and the operating system, and a page cannot patch them or see their version. Bugs there are real. CVE-2023-4863 in libwebp was exploited through Chrome before 116.0.5845.187, and CVE-2023-41064 in Apple's ImageIO was used against iPhones with no click. Opening a file in a cropper is the same exposure as showing it in an `img`. Tell people to keep their browser and system updated."
      ),
      p(
        "On your server, sharp is your decoder and you own its patches. Use 0.35.5 or newer, which bundles libvips 8.18.7. Versions before 0.35.0 are open to GHSA-f88m-g3jw-g9cj. Run `npm audit` in CI, and turn off the decoders you don't need with `sharp.block()`, as the route does. Don't point sharp at a libvips from your system, because that one brings its own loaders and its own patch level."
      ),
      p(
        "The [server crop](server-crop) route answers 413 for a photo over 120 megapixels. `MAX_PIXELS` is the one constant to raise. A photo at that limit peaked at about 2 GB in our test, so raise it only with memory to match."
      ),
      p(
        "zriz reads the pixel count before it decodes and refuses a file over `maxPixels`. Lower it if your page only needs small photos, as in [loading images](loading-images). It sets no limit on bytes, so check `file.size` before you pass a file."
      )
    ),
    section(
      "SVG",
      p(
        "zriz draws an SVG through an `img` from a data URL, so the browser runs no script in it and fetches nothing it points at. We tried scripts, event attributes, `foreignObject`, external images, stylesheets, fonts and `use` in all three engines, with no script run and no request sent. The export is a bitmap, so nothing from the SVG source survives in it."
      ),
      p(
        "An SVG still draws on the main thread. A file under 2 kB froze the tab for 8 to 15 seconds in our test, and `timeout` cannot stop it. Pass `svg={false}` to `Root` when people upload photos and you have no use for SVG."
      ),
      p(
        "The danger is your own code using the source. A blob URL of a file runs with your origin when it opens as a document, so a script inside the SVG acts as your site. An `img` is safe. These are not:"
      ),
      table({
        columns: [column("Never do this with an uploaded file", "prose")],
        rows: [
          [
            "`dangerouslySetInnerHTML` or `innerHTML` with the text of the file",
          ],
          ["`object`, `embed` or `iframe` with its URL"],
          ["A link or `window.open` to its `blob:` URL"],
        ],
      })
    ),
    section(
      "Serve what people upload",
      p(
        "The file name, the extension and the mime type come from the client, and a file can be a valid image and valid HTML at once. zriz reads the format from the bytes, and so does sharp, but your upload route decides how a file comes back to a browser."
      ),
      p("For every file you serve back:"),
      table({
        columns: [column("Rule", "prose"), column("Why", "prose")],
        rows: [
          [
            "Encode it again and serve that, as `cleanCopy` does",
            "Extra bytes in the file don't survive",
          ],
          [
            "Set `content-type` from what you encoded, never from the upload",
            "A declared `text/html` or `image/svg+xml` would run",
          ],
          [
            "Send `x-content-type-options: nosniff`",
            "The browser won't guess a type from the bytes",
          ],
          [
            "Send `content-security-policy: default-src 'none'; sandbox`",
            "If a file does open as a document, it runs nothing",
          ],
          [
            "Serve from a separate domain, such as `yourappusercontent.com`",
            "A file that slips through can't reach your cookies or your storage",
          ],
          [
            "Name the stored file with a random id",
            "A name from the client can hold `../` or overwrite another file",
          ],
        ],
      }),
      code("security/serve-upload.ts")
    ),
    section(
      "Set a content security policy",
      p(
        "These sources let the cropper work with its worker. Merge them into your own policy. [Loading images](loading-images) says what each one enables, and what falls back when it is missing."
      ),
      code("security/cropper-policy.ts"),
      p(
        "zriz injects no `style` tag and calls no `innerHTML` or `eval`, so `script-src` needs nothing for it, and `style-src` needs nothing for the parts' own styles. A `style` prop of yours on a server rendered part stays refused, and the recipes size `Viewport`, `Dial` and `Zoom` and paint `ZoomThumb` that way. Add `style-src-attr 'unsafe-inline'` to allow it, or drop the `style` prop and give those parts a class from your stylesheet. The same goes for a `style` attribute in your own HTML, as in the [vanilla JS](vanilla-js) markup. A `<style>` element in your HTML is refused too, and `style-src-attr` does not cover it. Move its rules to your stylesheet, or list its hash in `style-src`. With trusted types, add `zriz` to `trusted-types`."
      )
    ),
    section(
      "URLs you pass as src",
      p(
        "zriz fetches a string `src`, and the fetch sends cookies to your own origin. Never pass a URL a visitor typed, because it makes other visitors' browsers call any path on your site, and a host of the visitor's choice learns the IP address and page origin of everyone who opens it. Check the host against your own list first."
      ),
      p(
        'Pass `crossOrigin="use-credentials"` only for hosts you trust. To hide your page from the host, set `referrerpolicy` for the page with `<meta name="referrer" content="no-referrer">`.'
      ),
      p(
        "Don't add a URL field to a server route. Fetching a URL from a client lets them reach your internal network. The [server crop](server-crop) route takes a file for that reason."
      ),
      p(
        "A `ZrizError` message for an error status holds the URL as you passed it, cut at 80 characters, without the query or fragment. A CORS or network failure holds no URL. If a secret sits in your path, don't log the message."
      )
    ),
    section(
      "Protect the server route",
      p(
        "The [server crop](server-crop) route refuses values it cannot read, oversize bodies and unused decoders. It keeps any other value inside the photo, so a forged one can only move the crop. It can't know who is calling, so connect `canCrop` to your session check, add a rate limit per user, and set a body limit at your proxy too."
      ),
      p(
        "A saved value is client input as well. `parse` returns a clean object or `null` for anything in `localStorage` or a database, and a cropper keeps a value inside the photo, so a tampered one can only move the crop."
      )
    ),
    section(
      "Report a problem",
      p(
        "Report it privately at [GitHub](https://github.com/pqoqubbw/zriz/security/advisories/new), not in a public issue."
      )
    ),
  ],
  lede: "What zriz handles about hostile files and private photos, and what stays your job.",
});

export { SECURITY_PAGE };
