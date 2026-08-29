"use client";

import { CommandIcon, InfoIcon } from "@phosphor-icons/react";
import { useRef, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Kbd } from "~/components/ui/kbd";

const isMac =
  "navigator" in globalThis && /Mac|iPhone|iPad/.test(navigator.userAgent);

const mod = isMac ? "⌘" : "Ctrl";

interface Shortcut {
  key: string;
  label: string;
  description?: string;
}

const shortcuts: Shortcut[] = [
  { key: `${mod}+K`, label: "Search", description: "Focus search input" },
  {
    key: `${mod}+V`,
    label: "Paste",
    description: "Add copied URL as bookmark",
  },
  { key: "↑ ↓", label: "Navigate", description: "← → in gallery view" },
  { key: "Home End", label: "Jump", description: "First / last bookmark" },
  { key: "PgUp PgDn", label: "Page", description: "Jump a page at a time" },
  {
    key: "Enter",
    label: "Preview",
    description: "Open bookmark in the preview panel",
  },
  {
    key: `${mod}+↵`,
    label: "New tab",
    description: "Open bookmark in a new tab",
  },
  {
    key: "Shift+↓",
    label: "Extend selection",
    description: "Starts selection mode",
  },
  { key: "X", label: "Select", description: "Toggle focused bookmark" },
  { key: "Space", label: "Toggle", description: "Toggle selection" },
  { key: `${mod}+A`, label: "Select All", description: "Select all bookmarks" },
  {
    key: "Esc",
    label: "Cancel",
    description: "Exit selection mode or close preview",
  },
  { key: `${mod}+E`, label: "Rename", description: "Edit bookmark name" },
  { key: "M", label: "Move", description: "Move to another workspace" },
  { key: `${mod}+C`, label: "Copy", description: "Copy bookmark URL" },
  { key: `${mod}+Backspace`, label: "Delete", description: "Delete bookmark" },
  { key: "?", label: "Shortcuts", description: "Toggle this panel" },
];

export function KeyboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[85vh] flex flex-col"
        initialFocus={listRef}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CommandIcon className="h-4 w-4" />
            Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            <InfoIcon className="h-3.5 w-3.5" />
            {isMac ? "Use ⌘ key" : "Use Ctrl key"}
          </DialogDescription>
        </DialogHeader>
        <div
          ref={listRef}
          // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable region must be keyboard-focusable to scroll with arrow keys
          tabIndex={0}
          aria-label="Keyboard shortcuts list"
          className="min-h-0 flex-1 space-y-1 overflow-y-auto outline-none"
        >
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
  );
}

export function ShortcutButton({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const openShortcutsDialog = (e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      <button type="button" onClick={openShortcutsDialog} className={className}>
        {children || (
          <span className="w-full flex items-center gap-2">
            <CommandIcon className="h-4 w-4" />
            Shortcuts
          </span>
        )}
      </button>
      <KeyboardShortcutsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
