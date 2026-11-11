import type { ReactNode } from "react";

import { Logo } from "@/components/shell/logo";
import { Menu } from "@/components/shell/menu";
import { NavList } from "@/components/shell/nav-list";
import { Project } from "@/components/shell/project";

type DocsLayoutProps = {
  children: ReactNode;
};

const DocsLayout = ({ children }: DocsLayoutProps) => (
  <div className="grid grid-cols-[minmax(0,var(--container-page))] justify-center px-4 md:grid-cols-[11rem_minmax(var(--container-page),50rem)] md:gap-x-20 md:px-8 lg:grid-cols-[11rem_var(--container-page)_10rem]">
    <header className="sticky top-0 z-10 row-start-1 -mx-4 flex h-11 items-center justify-between bg-page px-4 md:hidden">
      <Logo />
      <Menu foot={<Project />} logo={<Logo />} />
    </header>
    <main className="row-start-2 min-w-0 pt-6 md:col-start-2 md:row-start-1 md:w-page md:pt-18">
      <a aria-hidden="true" className="sr-only" href="/llms.txt" tabIndex={-1}>
        llms.txt
      </a>
      <a
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-4 focus-visible:bg-page max-md:hidden"
        href="#docs"
      >
        Skip to navigation
      </a>
      {children}
    </main>
    <nav
      aria-label="Docs"
      id="docs"
      className="sticky top-0 -mx-1 hidden max-h-dvh scrollbar-none flex-col gap-7 self-start overflow-y-auto px-1 pt-18 pb-12 *:shrink-0 md:col-start-1 md:row-start-1 md:flex"
    >
      <Logo />
      <NavList roomy={false} />
    </nav>
    <aside
      aria-label="Project"
      className="sticky top-0 hidden self-start pt-18 lg:col-start-3 lg:row-start-1 lg:block"
    >
      <Project />
    </aside>
  </div>
);

export default DocsLayout;
