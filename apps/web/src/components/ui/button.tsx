import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-[13px] font-medium tracking-wide whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-gold/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-gold text-bg border-gold hover:bg-gold-dim active:scale-[0.98]",
        secondary:
          "bg-transparent text-text border border-border-strong hover:bg-surface-2 active:scale-[0.98]",
        ghost:
          "bg-transparent text-muted border-transparent hover:text-text hover:bg-surface-2 active:scale-[0.98]",
        tab:
          "bg-raised text-muted border-transparent hover:bg-surface-2 hover:text-text active:scale-[0.98]",
        destructive:
          "bg-transparent text-danger border border-danger/30 hover:bg-danger-bg active:scale-[0.98]",
        outline:
          "bg-transparent border border-border-strong text-muted hover:bg-surface-2 hover:text-text",
        link: "text-gold underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-4 py-1.5",
        xs: "h-6 gap-1 rounded-sm px-2 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-md px-3 py-1 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-6",
        icon: "size-8",
        "icon-xs": "size-6 rounded-sm [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-md",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  nativeButton,
  render,
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      nativeButton={nativeButton ?? render === undefined}
      render={render}
      {...props}
    />
  )
}

export { Button, buttonVariants }
