import { cva } from "class-variance-authority";

import { DemoMount } from "@/components/doc/demo-mount";
import { Panel } from "@/components/ui/panel";
import { DEMO_SPECS } from "@/demos/registry";
import type { DemoName } from "@/demos/registry";
import { Frame } from "@/demos/shell/frame";
import { photoUrl } from "@/demos/shell/photo";
import type { DemoSpace } from "@/lib/doc/schema";

type DemoProps = {
  className: string;
  name: DemoName;
  space?: DemoSpace;
};

const demoVariants = cva("@container flex flex-col items-center p-1", {
  variants: {
    space: {
      40: "mb-10",
      48: "mb-12",
      56: "mb-14",
    } satisfies Record<DemoSpace, string>,
  },
});

const Demo = ({ className, name, space }: DemoProps) => {
  const spec = DEMO_SPECS[name];

  return (
    <Panel
      className={demoVariants({ className, space })}
      data-demo={name}
      data-markdown-ignore=""
      radius="demo"
    >
      <DemoMount name={name} preload={spec.below ? null : photoUrl(spec.photo)}>
        <Frame name={name} />
      </DemoMount>
    </Panel>
  );
};

export { Demo };
