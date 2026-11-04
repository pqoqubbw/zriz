import "@zriz/react/styles.css";
import { mergeRefs, useRender } from "@zriz/react";
import type { AreaProps, RotateProps } from "@zriz/react";
import * as Cropper from "@zriz/react/cropper";
import { createRef, forwardRef, useRef } from "react";
import type { ReactElement } from "react";

const OwnArea = forwardRef<HTMLDivElement, AreaProps>(
  function OwnArea(props, ref) {
    return <Cropper.Area {...props} ref={ref} />;
  }
);

const OwnButton = (props: RotateProps): ReactElement => {
  const ref = useRef<HTMLButtonElement>(null);
  return useRender({
    props: { ...props },
    ref,
    render: <button aria-label="own" type="button" />,
    state: {},
    tag: "button",
  });
};

export const App = (): ReactElement => {
  const area = useRef<HTMLDivElement>(null);
  const span = createRef<HTMLSpanElement>();
  const button = createRef<HTMLButtonElement>();
  return (
    <Cropper.Root
      actionsRef={(api) => {
        api?.reset();
      }}
      ref={area}
      shape="circle"
      src={null}
    >
      <Cropper.Viewport
        ref={(node: HTMLDivElement | null) => {
          node?.focus();
        }}
      >
        <Cropper.Image alt="" />
        <Cropper.Mask />
        <Cropper.Area
          aria-label="Crop"
          className={(state) => (state.interacting ? "on" : "off")}
          ref={area}
          render={<section />}
        >
          <Cropper.Grid />
          <Cropper.Handle position="top-left" />
        </Cropper.Area>
        <OwnArea ref={area} />
      </Cropper.Viewport>
      <Cropper.Dial aria-label="Straighten">
        <Cropper.DialTicks />
        <Cropper.DialValue ref={span} />
      </Cropper.Dial>
      <Cropper.Zoom aria-label="Zoom" max={8}>
        <Cropper.ZoomThumb />
      </Cropper.Zoom>
      <Cropper.ZoomStep factor={2} ref={button}>
        in
      </Cropper.ZoomStep>
      <Cropper.Rotate
        ref={(node) => {
          mergeRefs(button, (own: HTMLButtonElement | null) => {
            own?.blur();
          })(node);
        }}
      >
        rotate
      </Cropper.Rotate>
      <Cropper.Flip axis="y">flip</Cropper.Flip>
      <Cropper.Reset>reset</Cropper.Reset>
      <Cropper.Orientation>turn</Cropper.Orientation>
      <Cropper.AspectGroup aria-label="Aspect">
        <Cropper.AspectItem value={1}>square</Cropper.AspectItem>
      </Cropper.AspectGroup>
      <Cropper.Instructions>drag to move</Cropper.Instructions>
      <Cropper.Announcer announce={() => null} />
      <OwnButton>own</OwnButton>
    </Cropper.Root>
  );
};
