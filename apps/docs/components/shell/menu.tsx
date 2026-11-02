"use client";

import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/doc/icon";
import { NavList } from "@/components/shell/nav-list";

const button =
  "-mr-3 flex size-11 cursor-pointer items-center justify-center rounded-control";

export const Menu = ({ logo }: { logo: React.ReactNode }) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        element?.close();
      }
    };
    element?.addEventListener("click", handleClick);
    return () => {
      element?.removeEventListener("click", handleClick);
    };
  }, []);
  return (
    <>
      <button
        aria-label="Menu"
        className={button}
        onClick={() => {
          dialog.current?.showModal();
          setOpen(true);
        }}
        type="button"
      >
        <Icon className="size-5" name="menu" />
      </button>
      <dialog
        aria-label="menu"
        className="bg-page text-ink m-0 h-dvh max-h-none w-full max-w-none backdrop:bg-transparent"
        onClose={() => {
          setOpen(false);
        }}
        ref={dialog}
      >
        <div className="mx-auto flex h-full w-[min(35rem,100%-2rem)] flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between">
            {logo}
            <button
              aria-label="Close menu"
              className={button}
              onClick={() => {
                dialog.current?.close();
              }}
              type="button"
            >
              <Icon className="size-5" name="close" />
            </button>
          </div>
          <nav
            aria-label="docs"
            className="-mx-1 flex-1 overflow-y-auto px-1 pt-3 pb-12"
          >
            {open && <NavList roomy />}
          </nav>
        </div>
      </dialog>
    </>
  );
};
