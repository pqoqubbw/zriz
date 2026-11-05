import { code, column, defineDoc, p, section, table } from "@/lib/doc/define";

const SECURITY_PAGE = defineDoc({
  blocks: [
    section(
      "what zriz does on its own",
      p(
        "zriz sends nothing anywhere. the photo stays in the browser until your code uploads something. the browser decodes it in a worker, and an export draws pixels onto a canvas and encodes them, so only the crop's pixels reach the file."
      ),
      p(
        "we ran files carrying each of these blocks through `exportCrop` in chromium, firefox and webkit, through the [server crop](server-crop) route, and through plain sharp, then parsed the results:"
      ),
      table({
        columns: [
          column("in the upload", "prose"),
          column("`exportCrop`", "prose"),
          column("server crop route", "prose"),
          column("sharp with `keepMetadata()`", "prose"),
        ],
        rows: [
          ["gps and exif", "gone", "gone", "kept"],
          ["exif thumbnail of the whole photo", "gone", "gone", "kept"],
          ["xmp and iptc", "gone", "gone", "kept"],
          ["pixels outside the crop", "gone", "gone", "gone"],
          [
            "a second image, video or other bytes after the image",
            "gone",
            "gone",
            "gone",
          ],
          [
            "gain map",
            "gone",
            "gone",
            "gone, and `keepGainMap()` keeps a cropped one",
          ],
        ],
      }),
      p(
        "safari writes a small exif block of its own into a jpeg or png, with only the crop's size and colour space."
      )
    ),
    section(
      "treat the original as private",
      p(
        "cropping hides part of a photo, and the original still holds all of it. the file a person picks carries their location, the time, the camera, a thumbnail of the uncropped frame, and on many phones a short video. someone who crops a face or a street sign out expects it to be gone."
      ),
      p("what to do, best first:"),
      table({
        columns: [column("choice", "prose"), column("what you do", "prose")],
        rows: [
          [
            "upload the export",
            "send the blob from `exportCrop` and never the file. the original stays on the device",
          ],
          [
            "cut on the server and drop the original",
            "use [server crop](server-crop), store the answer and let the upload go when the request ends. don't write it to disk, to a queue or to logs",
          ],
          [
            "keep a copy to crop again later",
            "store the copy below in a private bucket, never at a public url and never beside the crop, and tell the person you keep the whole frame. delete it when they delete the crop",
          ],
        ],
      }),
      p(
        "`cleanCopy` decodes the upload and encodes it again, which drops every block in the table. it keeps every pixel and fills clear ones white, as the route does, so it is still the whole photo:"
      ),
      code("security/clean-copy.ts"),
      p(
        "on a pipeline opened from an upload, never call `keepMetadata()`, `keepExif()`, `withMetadata()`, `withExif()` or `withExifMerge()`. each one kept the exif thumbnail in our test, so a crop can carry a small picture of the frame it cut away. to write your own tags, cut the photo to raw pixels first, as the route does, and add them to a new pipeline."
      ),
      p(
        "the crop value and `details.pixelCrop` tell where the crop sits and how large the original is. keep them out of public urls when that matters."
      )
    ),
    section(
      "apple and phone formats",
      table({
        columns: [column("file", "prose"), column("what happens", "prose")],
        rows: [
          [
            "heic and heif",
            "only safari decodes them. other browsers fail with `unsupported-format`, and prebuilt sharp has no hevc decoder, so the route answers 415. a `decode` function, as in [loading images](loading-images), sends the original to your server, so the rules above apply to it",
          ],
          [
            "live photo",
            "the still and the video are two files. zriz gets the file you pass and never sees the other. if your own picker uploads both, you upload the video too",
          ],
          [
            "motion photo",
            "the video sits after the image in one file. exports and the route drop it, and the original keeps it",
          ],
          [
            "gain map, mpf",
            "a second image in the file for hdr screens, covering the whole frame. exports and the route drop it, and the exported photo is sdr",
          ],
          [
            "p3 and other icc profiles",
            "the colour is converted on decode. an export is srgb unless you ask for `display-p3`, and the only profile in the file is the browser's own",
          ],
        ],
      })
    ),
    section(
      "decoder bugs",
      p(
        "zriz has no image decoder of its own. in the browser the decoding is done by the browser and the operating system, and a page cannot patch them or see their version. bugs there are real. CVE-2023-4863 in libwebp was exploited through chrome before 116.0.5845.187, and CVE-2023-41064 in apple's imageio was used against iphones with no click. opening a file in a cropper is the same exposure as showing it in an `img`. tell people to keep their browser and system updated."
      ),
      p(
        "on your server, sharp is your decoder and you own its patches. use 0.35.5 or newer, which bundles libvips 8.18.7. versions before 0.35.0 are open to GHSA-f88m-g3jw-g9cj. run `npm audit` in ci, and turn off the decoders you don't need with `sharp.block()`, as the route does. don't point sharp at a libvips from your system, because that one brings its own loaders and its own patch level."
      ),
      p(
        "the [server crop](server-crop) route answers 413 for a photo over 120 megapixels. `MAX_PIXELS` is the one constant to raise. a photo at that limit peaked at about 2 gb in our test, so raise it only with memory to match."
      ),
      p(
        "zriz reads the pixel count before it decodes and refuses a file over `maxPixels`. lower it if your page only needs small photos, as in [loading images](loading-images). it sets no limit on bytes, so check `file.size` before you pass a file."
      )
    ),
    section(
      "svg",
      p(
        "zriz draws an svg through an `img` from a data url, so the browser runs no script in it and fetches nothing it points at. we tried scripts, event attributes, `foreignObject`, external images, stylesheets, fonts and `use` in all three engines, with no script run and no request sent. the export is a bitmap, so nothing from the svg source survives in it."
      ),
      p(
        "an svg still draws on the main thread. a file under 2 kb froze the tab for 8 to 15 seconds in our test, and `timeout` cannot stop it. pass `svg={false}` to `Root` when people upload photos and you have no use for svg."
      ),
      p(
        "the danger is your own code using the source. a blob url of a file runs with your origin when it opens as a document, so a script inside the svg acts as your site. an `img` is safe. these are not:"
      ),
      table({
        columns: [column("never do this with an uploaded file", "prose")],
        rows: [
          [
            "`dangerouslySetInnerHTML` or `innerHTML` with the text of the file",
          ],
          ["`object`, `embed` or `iframe` with its url"],
          ["a link or `window.open` to its `blob:` url"],
        ],
      })
    ),
    section(
      "serve what people upload",
      p(
        "the file name, the extension and the mime type come from the client, and a file can be a valid image and valid html at once. zriz reads the format from the bytes, and so does sharp, but your upload route decides how a file comes back to a browser."
      ),
      p("for every file you serve back:"),
      table({
        columns: [column("rule", "prose"), column("why", "prose")],
        rows: [
          [
            "encode it again and serve that, as `cleanCopy` does",
            "extra bytes in the file don't survive",
          ],
          [
            "set `content-type` from what you encoded, never from the upload",
            "a declared `text/html` or `image/svg+xml` would run",
          ],
          [
            "send `x-content-type-options: nosniff`",
            "the browser won't guess a type from the bytes",
          ],
          [
            "send `content-security-policy: default-src 'none'; sandbox`",
            "if a file does open as a document, it runs nothing",
          ],
          [
            "serve from a separate domain, such as `yourappusercontent.com`",
            "a file that slips through can't reach your cookies or your storage",
          ],
          [
            "name the stored file with a random id",
            "a name from the client can hold `../` or overwrite another file",
          ],
        ],
      }),
      code("security/serve-upload.ts")
    ),
    section(
      "set a content security policy",
      p(
        "these sources let the cropper work with its worker. merge them into your own policy. [loading images](loading-images) says what each one enables, and what falls back when it is missing."
      ),
      code("security/cropper-policy.ts"),
      p(
        "zriz injects no `style` tag and calls no `innerHTML` or `eval`, so `script-src` needs nothing for it, and `style-src` needs nothing for the parts' own styles. a `style` prop of yours on a server rendered part stays refused, and the recipes size `Viewport`, `Dial` and `Zoom` and paint `ZoomThumb` that way. add `style-src-attr 'unsafe-inline'` to allow it, or drop the `style` prop and give those parts a class from your stylesheet. the same goes for a `style` attribute in your own html, as in the [vanilla js](vanilla-js) markup. a `<style>` element in your html is refused too, and `style-src-attr` does not cover it. move its rules to your stylesheet, or list its hash in `style-src`. with trusted types, add `zriz` to `trusted-types`."
      )
    ),
    section(
      "urls you pass as src",
      p(
        "zriz fetches a string `src`, and the fetch sends cookies to your own origin. never pass a url a visitor typed, because it makes other visitors' browsers call any path on your site, and a host of the visitor's choice learns the ip address and page origin of everyone who opens it. check the host against your own list first."
      ),
      p(
        'pass `crossOrigin="use-credentials"` only for hosts you trust. to hide your page from the host, set `referrerpolicy` for the page with `<meta name="referrer" content="no-referrer">`.'
      ),
      p(
        "don't add a url field to a server route. fetching a url from a client lets them reach your internal network. the [server crop](server-crop) route takes a file for that reason."
      ),
      p(
        "a `ZrizError` message for an error status holds the url as you passed it, cut at 80 characters, without the query or fragment. a cors or network failure holds no url. if a secret sits in your path, don't log the message."
      )
    ),
    section(
      "protect the server route",
      p(
        "the [server crop](server-crop) route refuses values it cannot read, oversize bodies and unused decoders. it keeps any other value inside the photo, so a forged one can only move the crop. it can't know who is calling, so connect `canCrop` to your session check, add a rate limit per user, and set a body limit at your proxy too."
      ),
      p(
        "a saved value is client input as well. `parse` returns a clean object or `null` for anything in `localStorage` or a database, and a cropper keeps a value inside the photo, so a tampered one can only move the crop."
      )
    ),
    section(
      "report a problem",
      p(
        "report it privately at [github](https://github.com/pqoqubbw/zriz/security/advisories/new), not in a public issue."
      )
    ),
  ],
  lede: "what zriz handles about hostile files and private photos, and what stays your job.",
});

export { SECURITY_PAGE };
