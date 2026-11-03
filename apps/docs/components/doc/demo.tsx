import { cva } from "class-variance-authority";

import { Panel } from "@/components/ui/panel";
import { TALL_DEMO } from "@/demos/registry";
import type { DemoName } from "@/demos/registry";
import type { DemoSpace } from "@/lib/doc/schema";

type DemoProps = {
  className: string;
  name: DemoName;
  space?: DemoSpace;
};

const demoVariants = cva("text-caption text-muted", {
  variants: {
    space: {
      40: "mb-10",
      48: "mb-12",
      56: "mb-14",
    } satisfies Record<DemoSpace, string>,
    tall: { false: "h-80", true: "h-113.5" },
  },
});

const Demo = ({ className, name, space }: DemoProps) => (
  <Panel
    className={demoVariants({ className, space, tall: name === TALL_DEMO })}
    data-demo={name}
    data-markdown-ignore=""
    layout="center"
    radius="demo"
  >
    demo
  </Panel>
);

export { Demo };
