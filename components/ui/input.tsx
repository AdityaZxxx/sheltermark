import * as React from "react"
import { Input as InputPrimitive } from "@base-ui/react/input"

import { cn } from "~/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-7 w-full min-w-0 rounded-md border border-border/70 bg-card px-2 py-0.5 text-sm shadow-xs transition-[border-color,box-shadow] outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-border focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10 md:text-xs/relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Input }
