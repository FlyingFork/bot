import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-[4px] border border-border-default bg-raised px-3 py-1 text-xs text-text-primary font-sans placeholder:text-text-muted transition-colors outline-none focus-visible:border-border-active focus-visible:ring-2 focus-visible:ring-cn-cyan/15 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-cn-danger aria-invalid:ring-2 aria-invalid:ring-cn-danger/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
