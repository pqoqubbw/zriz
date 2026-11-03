import { code, defineDoc, p, qa, section } from "@/lib/doc/define";

const FAQ_PAGE = defineDoc({
  blocks: [
    section(
      "setup",
      qa(
        "what does zriz need",
        p(
          "react 18.2 or newer, 19 included, from one build. both packages ship types, and `@types/react` 18.2 or newer is an optional peer. [quick start](quick-start) has the install."
        )
      ),
      qa(
        "which browsers does it run in",
        p(
          "chrome, edge and firefox in their latest two versions, safari and ios safari 18 and newer, and chrome and samsung internet on android. a two-finger trackpad twist rotates only in safari. other browsers rotate with the dial and the keys."
        )
      ),
      qa(
        "does it work with the next.js app router",
        p(
          "yes. every part is a client component, so a server component can render them. callbacks such as `onValueCommit` are functions, so put them in a client file of your own."
        )
      ),
      qa(
        "does it render on the server",
        p(
          "yes. the server renders the parts with no photo, and the photo loads in the browser after hydration."
        )
      ),
      qa(
        "does it work with vue or svelte",
        p(
          "there are no vue or svelte parts. `@zriz/core/dom` binds a cropper to plain elements, so any framework can drive it. [vanilla js](vanilla-js) shows the setup."
        )
      ),
      qa(
        "can i use my own button component",
        p(
          "yes. pass it to `render` on any part, and zriz merges its props and ref into yours. [composition](composition) has the code."
        )
      ),
      qa(
        "why is my viewport empty",
        p(
          "`Viewport` has no height of its own, so it starts at zero height. give it a height, as in [viewport](viewport)."
        )
      ),
      qa(
        "can i test it with jsdom",
        p(
          "jsdom has no `ResizeObserver`, so `Viewport` and `DialTicks` throw when they mount. stub it in your test setup. to test crop logic with no dom at all, use `createCropper` with a manual clock, as [cropper](cropper) shows."
        ),
        code("faq/resize-observer.ts")
      )
    ),
    section(
      "photos and export",
      qa(
        "can it open heic photos from an iphone",
        p(
          "safari decodes heic, so iphone photos open there. in other browsers the load fails with `unsupported-format`. to open them everywhere, call `loadImage` yourself with a heic decoder as `decode`, as [loading images](loading-images) shows."
        )
      ),
      qa(
        "how do i get the cropped file",
        p(
          "call `exportCrop` from `@zriz/core/dom` with the cropper from `actionsRef`. it resolves with a `Blob` and its width and height. [exporting](exporting) has the code."
        )
      ),
      qa(
        "can i crop on the server",
        p(
          "yes. send the original file and the plan from `getPixelCrop()`, then turn that plan into sharp calls with `toSharp`. [server crop](server-crop) has the route."
        )
      )
    ),
  ],
  lede: "short answers, each with a link to the page that covers it in full.",
});

export { FAQ_PAGE };
