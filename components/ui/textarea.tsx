import * as React from "react"

import { cn } from "~/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-16 w-full resize-none rounded-md border border-border/70 bg-card px-2 py-2 text-sm shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground hover:border-border focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-4 aria-invalid:ring-destructive/10 md:text-xs/relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
