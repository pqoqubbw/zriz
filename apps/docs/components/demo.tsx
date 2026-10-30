import { demos } from "@/demos";
import type { DemoName } from "@/demos";
import { demoSource } from "@/lib/demo-source";
import { highlight } from "@/lib/highlight";

import { Copy } from "./copy";

export const Demo = async ({ name }: { name: DemoName }) => {
  const Preview = demos[name];
  const source = await demoSource(name);
  const html = await highlight(source);
  return (
    <figure className="demo" data-demo={name}>
      <div className="demo-preview">
        <Preview />
      </div>
      <div className="demo-code">
        <Copy text={source} />
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </figure>
  );
};
