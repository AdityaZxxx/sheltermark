import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "./cn.js";

// BaseUI's default root is a <span role="switch"> plus a hidden checkbox, which
// only labels correctly alongside a BaseUI <Field.Label>. The options page is a
// plain form, so this renders a real button: labelable, natively keyboard-
// operable, and it puts `id` on the visible control instead of the hidden input.
function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      nativeButton
      render={<button type="button" />}
      data-slot="switch"
      className={cn(
        "group/switch relative inline-flex h-[16.6px] w-[28px] shrink-0 items-center rounded-full border border-transparent transition-all outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30 data-checked:bg-primary data-unchecked:bg-input dark:data-unchecked:bg-input/80 data-disabled:cursor-not-allowed data-disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none block size-3.5 rounded-full bg-background ring-0 transition-transform group-data-checked/switch:translate-x-[calc(100%-2px)] group-data-unchecked/switch:translate-x-0 dark:data-checked:bg-primary-foreground dark:data-unchecked:bg-foreground"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
