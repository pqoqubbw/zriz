import { code, defineDoc, p, section } from "@/lib/doc/define";

const COMPOSITION_PAGE = defineDoc({
  blocks: [
    section(
      "render your own element",
      p(
        "every part takes `render`. pass an element, and zriz renders that element with the part's props, ref and data attributes merged in. your component must spread the props it gets onto its root element and forward its ref. this one uses `forwardRef`, which works in react 18 and 19. in react 19 you can take `ref` as a plain prop instead:"
      ),
      code("composition/icon-button.tsx"),
      p("then pass it to a part:"),
      code("composition/element.jsx.tsx"),
      p(
        "the element's own props win over zriz's, except `className` and `style`, which merge, and event handlers, which both run. a prop set to `undefined` keeps zriz's value."
      )
    ),
    section(
      "change the element by state",
      p(
        "pass a function instead, and it gets the part's props and its state. spread the props onto what you return, because they carry the ref and the handlers:"
      ),
      code("composition/state.jsx.tsx"),
      p(
        "each part's state is in the api table on its page. `className` takes the same state, as shown in [styling](styling)."
      )
    ),
    section(
      "stop zriz's own handler",
      p(
        "your handler runs first. call `preventZrizHandler(event)` in it, and zriz skips that part's own handler for that event. a press still bubbles to `Viewport`, so veto there to stop a pan, or call `event.stopPropagation()`:"
      ),
      code("composition/veto.jsx.tsx"),
      p(
        "`event.preventDefault()` does not stop zriz. it only stops the browser default."
      ),
      p(
        "`preventZrizHandler`, `mergeProps`, `mergeRefs` and `CropperContext` come from `@zriz/react`, like the hooks."
      )
    ),
    section(
      "build a part of your own",
      p(
        "a part of your own reads the crop with the hooks, or takes the cropper itself from `CropperContext`, and renders with `useRender`, which applies `render` and `className` the way the zriz parts do. [hooks](hooks) shows one. `mergeProps` merges your props with a caller's and chains handlers the same way, and `mergeRefs` joins a ref you hold with the one a caller passes. `CropperContext` is `null` outside `Root`."
      )
    ),
  ],
  lede: "render the zriz parts as your own components, and add your own handlers next to zriz's.",
});

export { COMPOSITION_PAGE };
