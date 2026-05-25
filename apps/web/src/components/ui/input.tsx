import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-border-line bg-surface-2 px-3 py-1 text-sm text-text font-sans placeholder:text-dim transition-colors outline-none focus-visible:border-gold focus-visible:ring-2 focus-visible:ring-gold-bg disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-40 aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/20",
        className
      )}
      {...props}
    />
  )
}

export { Input }
