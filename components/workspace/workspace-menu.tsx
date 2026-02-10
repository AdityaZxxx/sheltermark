"use client";

import {
  CaretUpDownIcon,
  GlobeIcon,
  PlusIcon,
  TrashIcon,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const workspaces = [
  {
    id: "1",
    name: "Personal",
    is_default: true,
    bookmarks_count: 10,
  },
  {
    id: "2",
    name: "Work",
    is_default: false,
    bookmarks_count: 20,
  },
  {
    id: "3",
    name: "College",
    is_default: false,
    bookmarks_count: 0,
  },
];

export function WorkspaceMenu() {
  const activeWorkspaceName = workspaces.find((ws) => ws.is_default)?.name;
  const [activeWorkspace, setActiveWorkspace] = useState(activeWorkspaceName);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" className="gap-2 justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-2.5 h-2.5 rounded-full ${getPastelColor(activeWorkspace)}`}
              />
              <span className="truncate">{activeWorkspace}</span>
            </div>
            <CaretUpDownIcon className="h-4 w-4 text-muted-foreground" />
          </Button>
        }
      />
      <DropdownMenuContent align="start" sideOffset={8}>
        <DropdownMenuGroup>
          <DropdownMenuLabel className="sr-only">Workspaces</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeWorkspace}
            onValueChange={setActiveWorkspace}
          >
            {workspaces.map((ws) => (
              <DropdownMenuRadioItem value={ws.name} key={ws.id}>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${getPastelColor(ws.name)}`}
                  />
                  {ws.name}
                </div>
                {activeWorkspace !== ws.name && (
                  <span className="absolute right-2 text-xs text-muted-foreground">
                    {ws.bookmarks_count}
                  </span>
                )}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />

        <DropdownMenuItem>
          <PlusIcon className="h-4 w-4" />
          Add Workspace
        </DropdownMenuItem>

        <DropdownMenuItem>
          <GlobeIcon className="h-4 w-4" />
          Make Public
        </DropdownMenuItem>

        {workspaces.length > 1 && (
          <DropdownMenuItem variant="destructive" className="">
            <TrashIcon className="h-4 w-4" />
            Delete Current
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const PASTEL_COLORS = [
  "bg-red-300",
  "bg-orange-300",
  "bg-amber-300",
  "bg-yellow-300",
  "bg-lime-300",
  "bg-green-300",
  "bg-emerald-300 ",
  "bg-teal-300 ",
  "bg-cyan-300 ",
  "bg-sky-300 ",
  "bg-blue-300 ",
  "bg-indigo-300 ",
  "bg-violet-300 ",
  "bg-purple-300 ",
  "bg-fuchsia-300 ",
  "bg-pink-300 ",
  "bg-rose-300 ",
];

function getPastelColor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PASTEL_COLORS.length;
  return PASTEL_COLORS[index];
}
