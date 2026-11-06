import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";

import { cn } from "@/lib/cn";

type HeadingProps = ComponentProps<"h2"> &
  VariantProps<typeof headingVariants> & {
    level: 2 | 3 | 4;
  };

const headingVariants = cva("", {
  defaultVariants: { variant: "section" },
  variants: {
    variant: {
      mono: "font-mono text-body font-semibold",
      question: "text-body font-strong",
      section: "text-heading",
      "section-mono": "font-mono text-heading-mono",
    },
  },
});

const Heading = ({
  children,
  className,
  id,
  level,
  variant,
  ...props
}: HeadingProps) => {
  const Tag = `h${level}` as const;

  return (
    <Tag
      className={cn(headingVariants({ className, variant }))}
      data-slot="heading"
      id={id}
      {...props}
    >
      {id === undefined ? (
        children
      ) : (
        <a
          className="decoration-underline decoration-1 hover:underline"
          href={`#${id}`}
        >
          {children}
        </a>
      )}
    </Tag>
  );
};

export type { HeadingProps };
export { Heading, headingVariants };
