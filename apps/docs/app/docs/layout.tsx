import { Logo } from "@/components/shell/logo";
import { Menu } from "@/components/shell/menu";
import { NavList } from "@/components/shell/nav-list";

const DocsLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="grid grid-cols-[minmax(0,35rem)] justify-center px-4 md:grid-cols-[11rem_minmax(35rem,50rem)] md:gap-x-20 md:px-8">
    <header className="bg-page sticky top-0 z-10 row-start-1 -mx-4 flex h-11 items-center justify-between px-4 md:hidden">
      <Logo />
      <Menu logo={<Logo />} />
    </header>
    <main className="row-start-2 min-w-0 pt-6 md:col-start-2 md:row-start-1 md:w-140 md:pt-18">
      <a aria-hidden="true" className="sr-only" href="/llms.txt" tabIndex={-1}>
        llms.txt
      </a>
      <a
        className="focus-visible:bg-page sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:top-3 focus-visible:left-4 max-md:hidden"
        href="#docs"
      >
        skip to navigation
      </a>
      {children}
    </main>
    <nav
      aria-label="docs"
      id="docs"
      className="sticky top-0 -mx-1 hidden max-h-dvh [scrollbar-width:none] flex-col gap-7 self-start overflow-y-auto px-1 pt-18 pb-12 *:shrink-0 md:col-start-1 md:row-start-1 md:flex"
    >
      <Logo />
      <NavList roomy={false} />
    </nav>
  </div>
);

export default DocsLayout;
