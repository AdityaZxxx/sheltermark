"use client";

import { CommandIcon, InfoIcon } from "@phosphor-icons/react";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Kbd } from "~/components/ui/kbd";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.userAgent);

const mod = isMac ? "⌘" : "Ctrl";

interface Shortcut {
  key: string;
  label: string;
  description?: string;
}

const shortcuts: Shortcut[] = [
  { key: `${mod}+K`, label: "Search", description: "Focus search input" },
  { key: "↑", label: "Navigate Up" },
  { key: "↓", label: "Navigate Down" },
  { key: "Enter", label: "Open", description: "Open bookmark in new tab" },
  { key: `${mod}+C`, label: "Copy", description: "Copy bookmark URL" },
  { key: `${mod}+E`, label: "Rename", description: "Edit bookmark name" },
  { key: `${mod}+Backspace`, label: "Delete", description: "Delete bookmark" },
  { key: "Esc", label: "Cancel", description: "Exit selection mode" },
  { key: `${mod}+A`, label: "Select All", description: "Select all bookmarks" },
  { key: "Space", label: "Toggle", description: "Toggle selection" },
];

function ShortcutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={className}>
        {children || (
          <span className="w-full flex items-center gap-2">
            <CommandIcon className="h-4 w-4" />
            Shortcuts
          </span>
        )}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CommandIcon className="h-4 w-4" />
              Keyboard Shortcuts
            </DialogTitle>
            <DialogDescription className="flex items-center gap-1.5">
              <InfoIcon className="h-3.5 w-3.5" />
              {isMac ? "Use ⌘ key" : "Use Ctrl key"} on Windows/Linux
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            {shortcuts.map((shortcut) => (
              <div
                key={shortcut.key}
                className="flex items-center justify-between py-1.5"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{shortcut.label}</span>
                  {shortcut.description && (
                    <span className="text-xs text-muted-foreground">
                      {shortcut.description}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {shortcut.key.split("+").map((key, i, arr) => (
                    <span key={key} className="flex items-center">
                      <Kbd>{key}</Kbd>
                      {i < arr.length - 1 && (
                        <span className="mx-0.5 text-muted-foreground">+</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export { ShortcutButton };
export default ShortcutButton;
