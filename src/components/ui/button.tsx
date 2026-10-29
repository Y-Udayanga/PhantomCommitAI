import { Slot } from "@radix-ui/react-slot";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ButtonHTMLAttributes } from "react";
// shadcn/ui composition: Radix Slot + class merging, owned by this project.
export function Button({
  className,
  asChild = false,
  variant = "default",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost";
}) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      className={twMerge(
        clsx(
          "btn",
          variant === "outline" && "btn-outline",
          variant === "ghost" && "btn-ghost",
          className,
        ),
      )}
      {...props}
    />
  );
}
