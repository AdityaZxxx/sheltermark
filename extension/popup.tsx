import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  type CheckResult,
  MESSAGE_TYPES,
  type PopupInfo,
  type TabInfo,
  type TagWithCount,
  type Workspace,
} from "./constants.js";
import {
  checkResultSchema,
  popupInfoSchema,
  tagsResultSchema,
} from "./schema.js";
import {
  getBaseUrl,
  getCachedTags,
  getCachedWorkspaces,
  getLastWorkspace,
  setLastWorkspace,
} from "./storage.js";
import { Button } from "./ui/button.js";
import { cn } from "./ui/cn.js";
import { Input } from "./ui/input.js";
import { Logo } from "./ui/logo.js";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select.js";

function getCurrentTabInfo(): Promise<TabInfo | null> {
  // Query tabs directly from the popup ("tabs" permission covers url/title)
  // instead of a message round-trip through the service worker — one less
  // hop, and no dependency on the worker being awake for first paint.
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (chrome.runtime.lastError || !tab) {
        resolve(null);
        return;
      }
      resolve({
        url: tab.url,
        title: tab.title,
        favIconUrl: tab.favIconUrl,
      });
    });
  });
}

function App() {
  const [authRequired, setAuthRequired] = useState(false);
  const [title, setTitle] = useState("");
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [showWorkspaceSelect, setShowWorkspaceSelect] = useState(false);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(
    null,
  );
  const [allTags, setAllTags] = useState<TagWithCount[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const [suggestionsClosed, setSuggestionsClosed] = useState(false);
  const [savedLabel, setSavedLabel] = useState<"Saved!" | "Already saved">(
    "Saved!",
  );
  const [isSaved, setIsSaved] = useState(false);
  const [status, setStatus] = useState<{
    msg: string;
    kind: "success" | "error";
  } | null>(null);

  // Track whether the user actually edited fields. Untouched title sends
  // `null` so the server falls back to fetched metadata; untouched tags keep
  // the payload identical to the fast flows.
  const userEditedTitle = useRef(false);
  const userEditedTags = useRef(false);
  const currentUrl = useRef<string | null>(null);
  const workspacesRef = useRef<Workspace[]>([]);
  const selectedRef = useRef<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const q = tagDraft.trim();
  const used = new Set(selectedTags.map((t) => t.toLowerCase()));
  const suggestions = allTags
    .filter(
      (t) =>
        !used.has(t.name.toLowerCase()) &&
        (!q || t.name.toLowerCase().includes(q.toLowerCase())),
    )
    .slice(0, 8);
  const canCreate =
    q.length > 0 &&
    !selectedTags.some((t) => t.toLowerCase() === q.toLowerCase()) &&
    !allTags.some((t) => t.name.toLowerCase() === q.toLowerCase());
  const suggestionsOpen =
    !suggestionsClosed && q.length > 0 && (suggestions.length > 0 || canCreate);

  // Single writer of the workspace selection, used by both the cache phase
  // and the network phase. A still-valid selection is never overridden by
  // the network patch.
  const applyWorkspaces = useCallback(
    (list: Workspace[], preferredId: string | null) => {
      workspacesRef.current = list;
      setWorkspaces(list);

      if (list.length === 0) {
        setShowWorkspaceSelect(false);
        return;
      }
      if (list.length === 1) {
        setShowWorkspaceSelect(false);
        const only = list[0]?.id ?? null;
        if (only && only !== selectedRef.current) {
          selectedRef.current = only;
          setSelectedWorkspaceId(only);
          void setLastWorkspace(only);
        }
        return;
      }
      setShowWorkspaceSelect(true);
      const current = selectedRef.current;
      const chosen =
        current && list.some((w) => w.id === current)
          ? current
          : preferredId && list.some((w) => w.id === preferredId)
            ? preferredId
            : (list.find((w) => w.is_default)?.id ?? list[0]?.id ?? null);
      selectedRef.current = chosen;
      setSelectedWorkspaceId(chosen);
    },
    [],
  );

  const initPopup = useCallback(
    async (preferredId: string | null) => {
      let popupInfo: PopupInfo;
      try {
        popupInfo = popupInfoSchema.parse(
          await chrome.runtime.sendMessage({
            type: MESSAGE_TYPES.GET_POPUP,
            data: { url: currentUrl.current ?? "", workspaceId: preferredId },
          }),
        );
      } catch {
        setStatus({
          msg: "Couldn't load. Check your connection and try again.",
          kind: "error",
        });
        return;
      }

      if (!popupInfo.authenticated) {
        setAuthRequired(true);
        return;
      }
      setAuthRequired(false);
      applyWorkspaces(
        popupInfo.workspaces ?? workspacesRef.current,
        popupInfo.lastWorkspace ?? selectedRef.current,
      );
      if (popupInfo.alreadySaved) {
        setIsSaved(true);
        setSavedLabel("Already saved");
      }
    },
    [applyWorkspaces],
  );

  const fetchTags = useCallback(async () => {
    try {
      const result = tagsResultSchema.safeParse(
        await chrome.runtime.sendMessage({ type: MESSAGE_TYPES.GET_TAGS }),
      );
      if (result.success && result.data.tags) setAllTags(result.data.tags);
    } catch {
      // Suggestions are optional; the input still works without them.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [tabInfo, cachedWorkspaces, cachedTags, lastWorkspaceId] =
        await Promise.all([
          getCurrentTabInfo(),
          getCachedWorkspaces(),
          getCachedTags(),
          getLastWorkspace(),
        ]);
      if (cancelled) return;

      currentUrl.current = tabInfo?.url ?? null;
      if (cachedTags) setAllTags(cachedTags.value);
      if (cachedWorkspaces) {
        applyWorkspaces(cachedWorkspaces.value, lastWorkspaceId);
      }
      setTitle(tabInfo?.title ?? "");
      // Select the whole pre-filled title so typing immediately replaces it.
      requestAnimationFrame(() => {
        const el = titleRef.current;
        if (!el) return;
        el.focus();
        if (el.value.length > 0) el.setSelectionRange(0, el.value.length);
      });

      // With a warm cache the UI is already usable; this refreshes
      // workspaces, tags, and the "already saved" flag.
      void initPopup(lastWorkspaceId);
      void fetchTags();
    })();
    return () => {
      cancelled = true;
    };
  }, [applyWorkspaces, fetchTags, initPopup]);

  // Re-check auth and tab info when the popup regains focus (e.g. after
  // logging in through the auth tab).
  useEffect(() => {
    const refresh = async () => {
      const [tabInfo, cachedTagsEntry] = await Promise.all([
        getCurrentTabInfo(),
        getCachedTags(),
      ]);
      currentUrl.current = tabInfo?.url ?? null;
      if (cachedTagsEntry) setAllTags(cachedTagsEntry.value);
      if (!userEditedTitle.current) setTitle(tabInfo?.title ?? "");
      await Promise.all([initPopup(selectedRef.current), fetchTags()]);
    };
    const onFocus = () => void refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchTags, initPopup]);

  useEffect(() => {
    if (activeIndex < 0) return;
    document
      .getElementById(`tag-suggestion-${activeIndex}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function addTag(name: string) {
    const key = name.trim().toLowerCase();
    if (!key) return;
    setSelectedTags((prev) =>
      prev.some((t) => t.toLowerCase() === key) ? prev : [...prev, name.trim()],
    );
    userEditedTags.current = true;
  }

  function commitTypedTag() {
    const name = tagDraft.trim();
    if (!name) return;
    addTag(name);
    setTagDraft("");
    setActiveIndex(-1);
  }

  function commitSuggestion(tag: TagWithCount) {
    addTag(tag.name);
    setTagDraft("");
    setActiveIndex(-1);
    tagInputRef.current?.focus();
  }

  function removeTag(index: number) {
    setSelectedTags((prev) => prev.filter((_, i) => i !== index));
    userEditedTags.current = true;
  }

  function closeSuggestions() {
    setSuggestionsClosed(true);
    setActiveIndex(-1);
  }

  function moveSuggestion(delta: number) {
    if (suggestions.length === 0) return;
    setSuggestionsClosed(false);
    setActiveIndex(
      (prev) => (prev + delta + suggestions.length) % suggestions.length,
    );
  }

  function onTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      // Enter commits the highlighted suggestion, else the raw text.
      const item = activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (item) commitSuggestion(item);
      else commitTypedTag();
      return;
    }
    if (e.key === "Backspace" && !tagDraft && selectedTags.length > 0) {
      e.preventDefault();
      removeTag(selectedTags.length - 1);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveSuggestion(1);
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      moveSuggestion(-1);
      return;
    }
    if (e.key === "Escape") {
      closeSuggestions();
    }
  }

  function handleSave() {
    if (isSaved || !currentUrl.current) return;

    const typedTitle = title.trim();
    if (userEditedTitle.current && !typedTitle) {
      setStatus({ msg: "Title cannot be empty", kind: "error" });
      titleRef.current?.focus();
      return;
    }

    setIsSaved(true);
    setSavedLabel("Saved!");
    setStatus({ msg: "Saved!", kind: "success" });

    // Commit any half-typed tag so it isn't silently dropped.
    const typedTag = tagDraft.trim();
    const tags =
      typedTag &&
      !selectedTags.some((t) => t.toLowerCase() === typedTag.toLowerCase())
        ? [...selectedTags, typedTag]
        : selectedTags;
    if (typedTag) userEditedTags.current = true;

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SAVE_BOOKMARK,
      data: {
        url: currentUrl.current,
        // Untouched title → null so metadata wins server-side.
        title: userEditedTitle.current ? typedTitle : null,
        workspaceId: selectedWorkspaceId,
        tags: userEditedTags.current || tags.length > 0 ? tags : [],
      },
    });

    setTimeout(() => window.close(), 400);
  }

  async function onWorkspaceChange(id: string) {
    selectedRef.current = id;
    setSelectedWorkspaceId(id);
    if (id) void setLastWorkspace(id);
    setIsSaved(false);

    if (!currentUrl.current || !id) return;

    try {
      const parsed = checkResultSchema.safeParse(
        await chrome.runtime.sendMessage({
          type: MESSAGE_TYPES.CHECK_BOOKMARK,
          data: { url: currentUrl.current, workspaceId: id },
        }),
      );
      const result: CheckResult = parsed.success ? parsed.data : {};
      if (result.saved) {
        setIsSaved(true);
        setSavedLabel("Already saved");
        setStatus(null);
      } else {
        setIsSaved(false);
      }
    } catch {
      // silent
    }
  }

  const tagCount = selectedTags.length;

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <Logo />
        <span className="text-base font-semibold">Sheltermark</span>
      </div>

      {authRequired ? (
        <div className="p-4 text-center">
          <p className="mb-3 text-sm text-muted-foreground">
            Please log in to save bookmarks
          </p>
          <AuthButton />
        </div>
      ) : (
        <div>
          <div className="mb-2.5">
            <Input
              ref={titleRef}
              value={title}
              onChange={(e) => {
                userEditedTitle.current = true;
                setTitle(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
              type="text"
              maxLength={200}
              autoComplete="off"
              placeholder="Title"
              aria-label="Title"
            />
          </div>

          {showWorkspaceSelect && (
            <div className="mb-2.5">
              <Select
                value={selectedWorkspaceId ?? ""}
                onValueChange={(id) => {
                  if (id) void onWorkspaceChange(id);
                }}
              >
                <SelectTrigger aria-label="Workspace">
                  <SelectValue>
                    <span className="truncate">
                      {workspaces.find((ws) => ws.id === selectedWorkspaceId)
                        ?.name ?? ""}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                {/* alignItemWithTrigger=false: the default (popup covering the
                    trigger) dismisses instantly in the extension popup — the
                    release of the opening click lands on the popup and is
                    retargeted to <body>, which BaseUI reads as an outside
                    press. Below-trigger placement keeps the release on the
                    trigger. */}
                <SelectContent
                  alignItemWithTrigger={false}
                  className="w-(--anchor-width)"
                >
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                      {ws.is_default ? " (Default)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="relative mb-2.5">
            <div
              className={cn(
                "flex w-full cursor-text flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2.5 py-2 transition-colors",
                "focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30",
              )}
            >
              {selectedTags.map((tag, index) => (
                <span
                  key={tag.toLowerCase()}
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-1.5 py-0.5 text-xs whitespace-nowrap"
                >
                  {tag}
                  <button
                    type="button"
                    aria-label={`Remove tag ${tag}`}
                    className="relative opacity-60 hover:opacity-100 focus-visible:rounded-sm focus-visible:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(index);
                      tagInputRef.current?.focus();
                    }}
                  >
                    {/* ::before hit area: ~14px glyph → 26px target */}
                    <span className="absolute -inset-1.5" />×
                  </button>
                </span>
              ))}
              <input
                ref={tagInputRef}
                value={tagDraft}
                onChange={(e) => {
                  userEditedTags.current = true;
                  setTagDraft(e.target.value);
                  setActiveIndex(-1);
                  setSuggestionsClosed(false);
                }}
                onKeyDown={onTagKeyDown}
                onBlur={closeSuggestions}
                type="text"
                maxLength={50}
                autoComplete="off"
                placeholder="Add a tag..."
                aria-label="Tags"
                role="combobox"
                aria-expanded={suggestionsOpen}
                aria-autocomplete="list"
                aria-controls="tag-suggestions"
                aria-activedescendant={
                  suggestionsOpen && activeIndex >= 0
                    ? `tag-suggestion-${activeIndex}`
                    : undefined
                }
                className="min-w-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
              />
            </div>

            {suggestionsOpen && (
              <div
                id="tag-suggestions"
                role="listbox"
                aria-label="Tag suggestions"
                className="mt-1 max-h-42 overflow-y-auto rounded-md border border-border bg-background shadow-md"
              >
                {canCreate && (
                  <button
                    type="button"
                    role="option"
                    aria-selected="false"
                    className="flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[13px] hover:bg-secondary"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      commitTypedTag();
                      tagInputRef.current?.focus();
                    }}
                  >
                    <span>Create “{q}”</span>
                  </button>
                )}
                {suggestions.map((tag, index) => (
                  <button
                    key={tag.name.toLowerCase()}
                    id={`tag-suggestion-${index}`}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-2.5 py-2 text-left text-[13px] hover:bg-secondary",
                      index === activeIndex && "bg-secondary",
                    )}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => commitSuggestion(tag)}
                  >
                    <span>{tag.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {tag.count}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <Button
            className="h-11 w-full"
            disabled={isSaved}
            onClick={handleSave}
          >
            {isSaved
              ? savedLabel
              : tagCount > 0
                ? `Save · ${tagCount} tag${tagCount === 1 ? "" : "s"}`
                : "Save"}
          </Button>

          <output
            className={cn(
              "mt-2 min-h-4 text-center text-xs",
              status?.kind === "success" &&
                "text-green-700 dark:text-green-600",
              status?.kind === "error" && "text-red-600 dark:text-red-400",
            )}
          >
            {status?.msg ?? ""}
          </output>
        </div>
      )}
    </div>
  );
}

function AuthButton() {
  return (
    <Button
      className="h-11 w-full"
      onClick={async () => {
        void chrome.tabs.create({ url: `${await getBaseUrl()}/login` });
      }}
    >
      Log in
    </Button>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
