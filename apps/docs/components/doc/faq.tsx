"use client";

import { Accordion } from "@base-ui/react/accordion";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import { FocusTarget } from "@/components/ui/focus-target";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type FaqProps = {
  children: ReactNode;
  className: string;
  ids: readonly string[];
};

type FaqItemProps = {
  children: ReactNode;
  id: string;
  question: string;
};

const hashOf = (): string => {
  try {
    return decodeURIComponent(window.location.hash.slice(1));
  } catch {
    return "";
  }
};

const Faq = ({ children, className, ids }: FaqProps) => {
  const [open, setOpen] = useState<string[]>([]);

  useEffect(() => {
    const follow = () => {
      const id = hashOf();

      if (ids.includes(id)) {
        setOpen((current) =>
          current.includes(id) ? current : [...current, id]
        );
      }
    };

    follow();
    window.addEventListener("hashchange", follow);

    return () => {
      window.removeEventListener("hashchange", follow);
    };
  }, [ids]);

  return (
    <Accordion.Root
      className={cn("flex flex-col", className)}
      data-slot="faq"
      hiddenUntilFound
      multiple
      onValueChange={setOpen}
      value={open}
    >
      {children}
    </Accordion.Root>
  );
};

const FaqItem = ({ children, id, question }: FaqItemProps) => (
  <Accordion.Item value={id}>
    <Accordion.Header className="-mx-2" id={id}>
      <Accordion.Trigger className="group flex min-h-11 w-full items-center p-1 text-left text-body font-strong text-muted transition-color duration-150 ease-out hover:text-ink data-panel-open:text-ink motion-reduce:transition-none">
        <FocusTarget className="min-w-0 flex-1 items-center gap-3 px-1 py-2">
          <span className="min-w-0 flex-1 text-balance">{question}</span>
          <Icon
            className="size-5 shrink-0 translate-x-1.5 text-underline transition duration-200 ease-out group-hover:text-ink group-data-panel-open:rotate-180 group-data-panel-open:text-ink motion-reduce:transition-none"
            name="chevron"
          />
        </FocusTarget>
      </Accordion.Trigger>
    </Accordion.Header>
    <Accordion.Panel className="faq-panel">
      <div className="flex flex-col pb-4 text-pretty">{children}</div>
    </Accordion.Panel>
  </Accordion.Item>
);

export { Faq, FaqItem };
