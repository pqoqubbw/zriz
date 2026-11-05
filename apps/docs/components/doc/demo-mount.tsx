"use client";

import { useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";

import { DEMO_LOADERS } from "@/demos/load";
import type { DemoName } from "@/demos/registry";

type DemoMountProps = {
  children: ReactNode;
  name: DemoName;
};

const ROOT_MARGIN = "600px";

const DemoMount = ({ children, name }: DemoMountProps) => {
  const box = useRef<HTMLDivElement>(null);
  const [demo, setDemo] = useState<ComponentType | null>(null);

  useEffect(() => {
    let gone = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        observer.disconnect();

        void DEMO_LOADERS[name]().then(
          (module) => {
            if (!gone) {
              setDemo(() => module.default);
            }

            return module;
          },
          () => null
        );
      },
      { rootMargin: ROOT_MARGIN }
    );

    if (box.current) {
      observer.observe(box.current);
    }

    return () => {
      gone = true;
      observer.disconnect();
    };
  }, [name]);

  const Live = demo;

  return (
    <div
      className="flex w-full flex-col items-center"
      data-live={Live ? "" : undefined}
      data-slot="demo-mount"
      ref={box}
    >
      {Live ? <Live /> : children}
    </div>
  );
};

export { DemoMount };
