import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[4px] border border-transparent bg-clip-padding text-xs font-semibold tracking-wide whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-cn-cyan/40 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-40 aria-invalid:border-cn-danger [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-cn-cyan text-void hover:bg-cn-cyan/90 active:scale-[0.98]",
        secondary:
          "bg-transparent text-cn-cyan border border-border-active hover:bg-cn-cyan-glow active:scale-[0.98]",
        ghost:
          "bg-raised text-text-secondary border border-border-default hover:bg-overlay hover:text-text-primary active:scale-[0.98]",
        destructive:
          "bg-cn-danger/10 text-cn-danger border border-cn-danger/35 hover:bg-cn-danger/20 active:scale-[0.98]",
        outline:
          "bg-transparent border border-border-default text-text-secondary hover:bg-raised hover:text-text-primary",
        link: "text-cn-cyan underline-offset-4 hover:underline",
      },
      size: {
        default: "h-8 gap-1.5 px-4 py-1.5",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-[10px] [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-3 py-1 text-[11px] [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-10 gap-1.5 px-6",
        icon: "size-8",
        "icon-xs": "size-6 rounded-[min(var(--radius-md),10px)] [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-7 rounded-[min(var(--radius-md),12px)]",
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
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
