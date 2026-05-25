import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border px-2.5 py-0.5 text-[11px] font-medium tracking-[0.04em] whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-gold-bg text-gold border-gold-border",
        secondary: "bg-surface-2 text-muted border-border-line",
        destructive: "bg-danger-bg text-danger border-danger/25",
        outline: "border-border-line text-muted",
        ghost: "hover:bg-surface-2 hover:text-muted",
        link: "text-gold underline-offset-4 hover:underline",
        success: "bg-success-bg text-success border-success/25",
        warning: "bg-gold-bg text-gold border-gold-border",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  })
}

export { Badge, badgeVariants }
