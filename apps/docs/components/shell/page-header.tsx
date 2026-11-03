import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type PageHeaderProps = {
  children: ReactNode;
  className?: string;
  title: string;
};

const PageHeader = ({ children, className, title }: PageHeaderProps) => (
  <header className={cn("flex flex-col gap-2", className)}>
    <h1 className="text-title">{title}</h1>
    <p className="text-lede text-muted">{children}</p>
  </header>
);

export { PageHeader };
