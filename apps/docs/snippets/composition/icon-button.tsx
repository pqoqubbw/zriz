import { forwardRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

type IconButtonProps = ComponentPropsWithoutRef<"button"> & {
  icon: string;
};

export const IconButton = forwardRef<
  HTMLButtonElement,
  IconButtonProps
>(function IconButton({ icon, className, ...props }, ref) {
  return (
    <button
      ref={ref}
      className={`icon-button ${className ?? ""}`}
      data-icon={icon}
      {...props}
    />
  );
});
