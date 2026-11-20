import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/**
 * Button, after shadcn/ui (cva variants, Radix Slot for links), in FireStrain's
 * own styling: one signal-orange action per screen, square-ish 6 px corners.
 * Motion: a 97 % press; on the signal button a lighter fill slides in from the
 * left on hover (after Magic UI's Interactive Hover Button, without its arrow).
 */
const buttonVariants = cva(
  "relative isolate inline-flex shrink-0 items-center justify-center gap-2 overflow-hidden whitespace-nowrap rounded-md font-bold transition-[background-color,border-color,color,transform] duration-200 ease-out active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        signal:
          "bg-signal text-on-signal before:absolute before:inset-0 before:-z-10 before:-translate-x-full before:bg-[color-mix(in_oklab,var(--signal),white_18%)] before:transition-transform before:duration-300 before:ease-out hover:before:translate-x-0",
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
