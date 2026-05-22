import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-[3px] border px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase whitespace-nowrap transition-colors [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-cn-cyan-glow text-cn-cyan border-border-active",
        secondary: "bg-raised text-text-secondary border-border-subtle",
        destructive: "bg-cn-danger/10 text-cn-danger border-cn-danger/25",
        outline: "border-border-default text-text-secondary",
        ghost: "hover:bg-raised hover:text-text-secondary",
        link: "text-cn-cyan underline-offset-4 hover:underline",
        success: "bg-cn-success/10 text-cn-success border-cn-success/25",
        warning: "bg-cn-warning/10 text-cn-warning border-cn-warning/25",
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
