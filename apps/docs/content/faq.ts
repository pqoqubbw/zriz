import { code, defineDoc, p, qa, section } from "@/lib/doc/define";

const FAQ_PAGE = defineDoc({
  blocks: [
    section(
      "Setup",
      qa(
        "What does zriz need",
        p(
          "React 18.2 or newer, 19 included, from one build. Both packages ship types, and `@types/react` 18.2.6 or newer is an optional peer. [Quick start](quick-start) has the install."
        )
      ),
      qa(
        "Which browsers does it run in",
        p(
          "Chrome, Edge and Firefox in their latest two versions, Safari and iOS Safari 18 and newer, and Chrome and Samsung Internet on Android. A two-finger trackpad twist rotates only in Safari. On a trackpad in other browsers, rotate with the dial and the keys. Two fingers on a touch screen rotate in every browser."
        )
      ),
      qa(
        "Does it work without a bundler",
        p(
          "Yes, with an import map. Map `react`, `react/jsx-runtime`, `@zriz/react`, `@zriz/react/cropper`, `@zriz/core` and `@zriz/core/dom`. The parts also import `@zriz/react/warn`, so point that at `@zriz/react/dist/warn-off.js`."
        ),
        p(
          "To keep the warnings during development, point it at `dist/warn.js` and run `window.process = { env: {} }` before the modules load. Without a `process` global, `dist/warn.js` stays silent too."
        )
      ),
      qa(
        "Does it work with the Next.js app router",
        p(
          "Yes. Every part is a client component, so a server component can render them. Callbacks such as `onValueCommit` are functions, so put them in a client file of your own."
        )
      ),
      qa(
        "Does it render on the server",
        p(
          "Yes. The server renders the parts with no photo, and the photo loads in the browser after hydration."
        )
      ),
      qa(
        "Does it work with Vue or Svelte",
        p(
          "There are no Vue or Svelte parts. `@zriz/core/dom` binds a cropper to plain elements, so any framework can drive it. [Vanilla JS](vanilla-js) shows the setup."
        )
      ),
      qa(
        "Can I use my own button component",
        p(
          "Yes. Pass it to `render` on any part, and zriz merges its props and ref into yours. [Composition](composition) has the code."
        )
      ),
      qa(
        "Why is my viewport empty",
        p(
          "`Viewport` has no height of its own, so it starts at zero height. Give it a height, as in [viewport](viewport)."
        )
      ),
      qa(
        "Can I test it with jsdom",
        p(
          "jsdom has no `ResizeObserver`, so `Viewport`, `Image` and `DialTicks` throw when they mount. Stub it in your test setup. To test crop logic with no DOM at all, use `createCropper` with a manual clock, as [cropper](cropper) shows."
        ),
        code("faq/resize-observer.ts")
      ),
      qa(
        "Why do Node and Jest fail on the stylesheet",
        p(
          "Node cannot import a `.css` file, and Jest cannot either until you map it. Point `\\.css$` at an empty module with `moduleNameMapper` in your Jest config. Vitest and Bun load the import as it is, and in an app your bundler handles it."
        )
      )
    ),
    section(
      "Photos and export",
      qa(
        "Can it open HEIC photos from an iPhone",
        p(
          "Safari decodes HEIC, so iPhone photos open there. In other browsers the load fails with `unsupported-format`. To open them everywhere, call `loadImage` yourself with a HEIC decoder as `decode`, as [loading images](loading-images) shows."
        )
      ),
      qa(
        "How do I get the cropped file",
        p(
          "Call `exportCrop` from `@zriz/core/dom` with the cropper from `actionsRef`. It resolves with an object that holds the file in `blob`, next to its `width` and `height`. [Exporting](exporting) has the code."
        )
      ),
      qa(
        "Can I put it in a dialog or a drawer",
        p(
          "Yes. A native `<dialog>` does not lock the page, so a wheel at the pan limit or over the dial scrolls what is behind it. `html:has(dialog[open]) { overflow: hidden; }` holds the page. Keep `Announcer` inside the dialog, see [accessibility](accessibility)."
        ),
        p(
          "Radix `forceMount` with CSS hiding keeps `aria-hidden` on your app and the scroll lock while closed, so mount the dialog only when it is open. Base UI `keepMounted` leaves the page clean."
        ),
        p(
          "Vaul starts with focus on the page, and the first presses of tab land behind the drawer. Pass `autoFocus` to `Drawer.Root`. [Viewport](viewport) and [root](root) have the layout and swipe notes."
        )
      ),
      qa(
        "Can I crop on the server",
        p(
          "Yes. Send the original file and the value from `getValue()`, recompute the plan on the server, then turn that plan into sharp calls with `toSharp`. [Server crop](server-crop) has the route."
        )
      )
    ),
  ],
  lede: "Short answers, each with a link to the page that covers it in full.",
});

export { FAQ_PAGE };
