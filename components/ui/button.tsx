import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Button, after shadcn/ui (cva variants, Radix Slot for links), in FireStrain's
 * own styling: one signal-orange action per screen, square-ish 6 px corners,
 * a 1 px press.
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-md font-bold transition-[background-color,border-color,color,transform] duration-200 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        signal: "bg-signal text-on-signal hover:bg-[color-mix(in_oklab,var(--signal),white_14%)]",
        outline: "border border-rule-strong bg-transparent text-ink hover:border-ink-3 hover:bg-raised",
        ghost: "text-ink-2 hover:bg-raised hover:text-ink",
        link: "px-0 text-signal-ink underline underline-offset-4 hover:text-ink",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-9",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: ComponentProps<"button"> & VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Component = asChild ? Slot.Root : "button";
  return <Component className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export { buttonVariants };
