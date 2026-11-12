import Link from "next/link";

import { Install } from "@/components/shell/install";
import { StarNudge } from "@/components/shell/star-nudge";
import { Brand } from "@/components/ui/icon";
import type { BrandName } from "@/components/ui/icon";
import { RELEASES } from "@/content/releases";
import { SITE_LINKS } from "@/lib/site";

type ProjectLinkProps = {
  children: string;
  detail?: string | undefined;
  href: string;
  icon: BrandName;
  nudge?: boolean | undefined;
};

type ProjectProps = {
  nudge?: boolean;
};

const INSTALL_COMMAND = "npm i @zriz/react";

const ProjectLink = ({
  children,
  detail,
  href,
  icon,
  nudge = false,
}: ProjectLinkProps) => {
  const label = (
    <>
      <Brand
        className="size-3.5 shrink-0 opacity-70 group-hover:opacity-100 group-focus-visible:opacity-100"
        name={icon}
      />
      {children}
    </>
  );

  return (
    <li>
      <Link
        className="group flex items-center gap-2 py-0.5 text-nav text-muted hover:text-ink"
        href={href}
        prefetch={false}
      >
        {nudge ? <StarNudge>{label}</StarNudge> : label}
        {detail !== undefined && (
          <span className="font-mono text-cell-mono leading-5 text-group">
            {detail}
          </span>
        )}
      </Link>
    </li>
  );
};

const Project = ({ nudge = false }: ProjectProps) => (
  <div className="flex flex-col gap-7">
    <Install command={INSTALL_COMMAND} />
    <ul className="-my-0.5">
      <ProjectLink href={SITE_LINKS.github} icon="github" nudge={nudge}>
        GitHub
      </ProjectLink>
      <ProjectLink
        detail={RELEASES[0]?.version}
        href={SITE_LINKS.npm}
        icon="npm"
      >
        npm
      </ProjectLink>
    </ul>
  </div>
);

export { Project };
