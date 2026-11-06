import { code, defineDoc, p, section } from "@/lib/doc/define";

const COMPOSITION_PAGE = defineDoc({
  blocks: [
    section(
      "Render your own element",
      p(
        "Every part takes `render`. Pass an element, and zriz renders that element with the part's props, ref and data attributes merged in. Your component must spread the props it gets onto its root element and forward its ref. This one uses `forwardRef`, which works in React 18 and 19. In React 19 you can take `ref` as a plain prop instead. Save it as `icon-button.tsx`, which the examples below import:"
      ),
      code("composition/icon-button.tsx"),
      p("Then pass it to a part:"),
      code("composition/element.jsx.tsx"),
      p(
        "The element's own props win over zriz's, except `className` and `style`, which merge, and event handlers, which both run. A prop set to `undefined` keeps zriz's value."
      ),
      p(
        "`Handle`, `Grid`, `Mask`, `DialTicks`, `DialValue` and `ZoomThumb` are `aria-hidden`, so render them as an element that can't take focus, such as a `<span>`. A `<button>` on `Handle` adds a tab stop that screen readers can't read."
      )
    ),
    section(
      "Change the element by state",
      p(
        "Pass a function instead, and it gets the part's props and its state. Spread the props onto what you return, because they carry the ref and the handlers:"
      ),
      code("composition/state.jsx.tsx"),
      p(
        "Each part's state is in the API table on its page. `className` takes the same state, as shown in [styling](styling)."
      )
    ),
    section(
      "Stop zriz's own handler",
      p(
        "Your handler runs first. Call `preventZrizHandler(event)` in it, and zriz skips that part's own handler for that event. `Area`, `Image`, `Mask` and `Grid` have no press handler of their own, so a press on them pans through `Viewport`. To stop that pan, veto on `Viewport` or call `event.stopPropagation()`. A press on `Handle`, `Dial`, `Zoom` or a button starts no pan:"
      ),
      code("composition/veto.jsx.tsx"),
      p(
        "`event.preventDefault()` does not stop zriz. It only stops the browser default."
      ),
      p(
        'The wheel and Safari gestures on `Viewport` are native listeners. They run before your `onWheel`, so neither a veto nor `event.stopPropagation()` in it stops them. `wheel="none"` leaves a plain wheel to the page, and Ctrl + wheel still zooms.'
      ),
      p(
        "`preventZrizHandler`, `mergeProps`, `mergeRefs` and `CropperContext` come from `@zriz/react`, like the hooks."
      )
    ),
    section(
      "Build a part of your own",
      p(
        "A part of your own reads the crop with the hooks, or takes the cropper itself from `CropperContext`, and renders with `useRender`, which applies `render` and `className` the way the zriz parts do. [Hooks](hooks) shows one. `mergeProps` merges your props with a caller's and chains handlers the same way, and `mergeRefs` joins a ref you hold with the one a caller passes. `CropperContext` is `null` outside `Root`."
      )
    ),
  ],
  lede: "Render the zriz parts as your own components, and add your own handlers next to zriz's.",
});

export { COMPOSITION_PAGE };
