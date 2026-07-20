"use client";

import { TagIcon } from "@phosphor-icons/react";
import { useWorkspaceTagsWithCount } from "~/hooks/use-user-tags";
import { cn } from "~/lib/utils";

interface BookmarkTagFilterProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onManageTags?: () => void;
  workspaceId?: string;
}

export function BookmarkTagFilter({
  selectedTagIds,
  onChange,
  onManageTags,
  workspaceId,
}: BookmarkTagFilterProps) {
  const { tags, isLoading } = useWorkspaceTagsWithCount(workspaceId);

  if (isLoading) return null;
  if (tags.length === 0) return null;

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-nowrap overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&::-webkit-scrollbar]:hidden">
      {onManageTags && (
        <button
          type="button"
          onClick={onManageTags}
          aria-label="Manage tags"
          className="inline-flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97]"
        >
          <TagIcon className="size-3.5" aria-hidden="true" />
        </button>
      )}
      {tags.map((tag) => {
        const isActive = selectedTagIds.includes(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag.id)}
            className={cn(
              "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-[10px] font-medium transition-colors active:scale-[0.97]",
              isActive
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            #{tag.name}
          </button>
        );
      })}
      {selectedTagIds.length > 0 && (
        <button
          type="button"
          onClick={() => onChange([])}
          className="ml-1 shrink-0 text-[10px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors"
        >
          Clear
        </button>
      )}
    </div>
  );
}
