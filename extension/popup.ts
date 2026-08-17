import {
  MESSAGE_TYPES,
  type PopupInfo,
  type TabInfo,
  type TagsResult,
  type TagWithCount,
  type Workspace,
} from "./constants.js";
import {
  getBaseUrl,
  getCachedTags,
  getCachedWorkspaces,
  getLastWorkspace,
  setLastWorkspace,
} from "./storage.js";

// Track whether the user actually edited the title. If untouched we send
// `null` so the server falls back to fetched metadata, keeping the extension
// fast-path semantics (metadata-driven) while honoring explicit edits.
let userEditedTitle = false;
let userEditedTags = false;

// Local snapshot of the user's tag list for typeahead suggestions. Refreshed
// on each popup open and after a save (so a tag just created appears next
// time). Names are the source of truth — ids are only used to key the UI.
let allTags: TagWithCount[] = [];

interface TagChip {
  name: string;
}
const selectedTags: TagChip[] = [];

document.addEventListener("DOMContentLoaded", async () => {
  const authSection = document.getElementById("auth-section") as HTMLElement;
  const mainSection = document.getElementById("main-section") as HTMLElement;
  const titleInput = document.getElementById("title-input") as HTMLInputElement;
  const workspaceSelect = document.getElementById(
    "workspace-select",
  ) as HTMLSelectElement;
  const tagBox = document.getElementById("tag-box") as HTMLElement;
  const tagInput = document.getElementById("tag-input") as HTMLInputElement;
  const tagSuggestions = document.getElementById(
    "tag-suggestions",
  ) as HTMLElement;
  const saveBtn = document.getElementById("save-btn") as HTMLButtonElement;
  const authBtn = document.getElementById("auth-btn") as HTMLButtonElement;
  const statusDiv = document.getElementById("status") as HTMLElement;

  let workspaces: Workspace[] = [];
  let selectedWorkspaceId: string | null = null;
  let currentTabInfo: TabInfo | null = null;
  let isSaved = false;
  let currentUrl: string | null = null;
  let activeSuggestionIndex = -1;

  mainSection.classList.remove("hidden");

  authBtn.addEventListener("click", async () => {
    const baseUrl = await getBaseUrl();
    void chrome.tabs.create({ url: `${baseUrl}/login` });
  });

  // ---- Phase 1: everything available locally, in parallel (~1-5ms). ----
  // Tab info, cached workspaces/tags and the last-used workspace are all
  // independent — await them together instead of serially. If the session
  // cache has workspaces, the UI is fully usable before any network call.
  const [tabInfo, cachedWorkspaces, cachedTags, lastWorkspaceId] =
    await Promise.all([
      getCurrentTabInfo(),
      getCachedWorkspaces(),
      getCachedTags(),
      getLastWorkspace(),
    ]);

  currentTabInfo = tabInfo;
  currentUrl = currentTabInfo?.url ?? null;

  if (cachedTags) allTags = cachedTags.value;
  if (cachedWorkspaces) {
    renderWorkspaces(cachedWorkspaces.value, lastWorkspaceId);
  }

  titleInput.value = currentTabInfo?.title ?? "";
  updateSaveButton();
  focusTitle();

  // ---- Phase 2: authoritative server state in parallel, patch in. ----
  // Runs concurrently (previously serial). With a warm cache this only
  // refreshes the workspace list, tags, and the "already saved" flag —
  // the user can already type and save by then.
  void Promise.all([initPopup(), fetchTags()]);

  // Render the workspace list from whichever source arrived: the session
  // cache (phase 1) or the server (phase 2). Idempotent.
  function renderWorkspaces(
    list: Workspace[],
    preferredId: string | null,
  ): void {
    workspaces = list;
    workspaceSelect.innerHTML = "";

    if (list.length === 0) {
      workspaceSelect.classList.add("hidden");
      return;
    }

    if (list.length === 1) {
      workspaceSelect.classList.add("hidden");
      selectedWorkspaceId = list[0]?.id ?? null;
      if (selectedWorkspaceId) void setLastWorkspace(selectedWorkspaceId);
      return;
    }

    workspaceSelect.classList.remove("hidden");
    const defaultWs = list.find((w) => w.is_default);

    list.forEach((ws) => {
      const option = document.createElement("option");
      option.value = ws.id;
      option.textContent = ws.name + (ws.is_default ? " (Default)" : "");
      workspaceSelect.appendChild(option);
    });

    // Preserve an already-rendered, still-valid selection so the phase-2
    // network patch never overrides what the user is looking at.
    const keepsCurrent =
      workspaceSelect.value && list.some((w) => w.id === workspaceSelect.value);
    if (!keepsCurrent) {
      const chosen =
        preferredId && list.some((w) => w.id === preferredId)
          ? preferredId
          : (defaultWs?.id ?? list[0]?.id ?? null);
      if (chosen) workspaceSelect.value = chosen;
    }
    selectedWorkspaceId = workspaceSelect.value || null;
  }

  function focusTitle(): void {
    titleInput.focus();
    // Select the whole pre-filled title so typing immediately replaces it.
    // Prevents left-edge clipping for long titles (scrollWidth > clientWidth).
    if (titleInput.value.length > 0) {
      titleInput.setSelectionRange(0, titleInput.value.length);
    }
  }

  async function initPopup(): Promise<void> {
    const lastWorkspace = await getLastWorkspace();

    let popupInfo: PopupInfo;
    try {
      popupInfo = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_POPUP,
        data: { url: currentUrl ?? "", workspaceId: lastWorkspace },
      })) as PopupInfo;
    } catch {
      statusDiv.textContent = "Failed to load";
      statusDiv.style.color = "#ef4444";
      return;
    }

    if (!popupInfo.authenticated) {
      showAuthRequired();
      return;
    }

    renderWorkspaces(
      popupInfo.workspaces ?? workspaces,
      popupInfo.lastWorkspace ?? selectedWorkspaceId,
    );

    isSaved = popupInfo.alreadySaved;
    updateSaveButton();
    if (isSaved) {
      saveBtn.disabled = true;
      saveBtn.textContent = "Already saved";
    }
  }

  async function fetchTags(): Promise<void> {
    try {
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.GET_TAGS,
      })) as TagsResult;
      if (result?.tags) allTags = result.tags;
    } catch {
      // Suggestions are optional; the input still works without them.
    }
  }

  // -------------------- Title --------------------
  titleInput.addEventListener("input", () => {
    userEditedTitle = true;
    updateSaveButton();
  });

  titleInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      saveBtn.click();
    }
  });

  // -------------------- Tags --------------------
  tagBox.addEventListener("click", () => tagInput.focus());

  tagInput.addEventListener("input", () => {
    userEditedTags = true;
    activeSuggestionIndex = -1;
    renderSuggestions();
  });

  tagInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      // Enter commits the highlighted suggestion, else the raw text.
      const items = currentSuggestions();
      if (activeSuggestionIndex >= 0 && items[activeSuggestionIndex]) {
        commitSuggestion(items[activeSuggestionIndex]);
      } else {
        commitTypedTag();
      }
      return;
    }
    if (e.key === "Backspace" && !tagInput.value && selectedTags.length > 0) {
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
      return;
    }
  });

  tagInput.addEventListener("blur", () => {
    // Delay so a suggestion click still registers before the dropdown closes.
    setTimeout(closeSuggestions, 120);
  });

  function typedTagName(): string {
    return tagInput.value.trim();
  }

  function commitTypedTag(): void {
    const name = typedTagName();
    if (!name) return;
    addTag({ name });
    tagInput.value = "";
    renderSuggestions();
  }

  function commitSuggestion(tag: TagWithCount): void {
    addTag({ name: tag.name });
    tagInput.value = "";
    activeSuggestionIndex = -1;
    renderSuggestions();
  }

  function addTag(chip: TagChip): void {
    const key = chip.name.trim().toLowerCase();
    if (!key) return;
    if (selectedTags.some((t) => t.name.toLowerCase() === key)) return;
    selectedTags.push({ name: chip.name.trim() });
    userEditedTags = true;
    renderChips();
    updateSaveButton();
  }

  function removeTag(index: number): void {
    selectedTags.splice(index, 1);
    userEditedTags = true;
    renderChips();
    renderSuggestions();
    updateSaveButton();
  }

  function renderChips(): void {
    // Remove existing chips, keep the input.
    for (const el of Array.from(tagBox.querySelectorAll(".tag-chip"))) {
      el.remove();
    }
    selectedTags.forEach((tag, index) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = tag.name;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("aria-label", `Remove tag ${tag.name}`);
      btn.textContent = "×";
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeTag(index);
        tagInput.focus();
      });
      chip.appendChild(btn);
      tagBox.insertBefore(chip, tagInput);
    });
  }

  function currentSuggestions(): TagWithCount[] {
    const q = typedTagName().toLowerCase();
    const used = new Set(selectedTags.map((t) => t.name.toLowerCase()));
    return allTags
      .filter((t) => {
        if (used.has(t.name.toLowerCase())) return false;
        if (!q) return true;
        return t.name.toLowerCase().includes(q);
      })
      .slice(0, 8);
  }

  function renderSuggestions(): void {
    const suggestions = currentSuggestions();
    const q = typedTagName();
    const canCreate =
      q.length > 0 &&
      !selectedTags.some((t) => t.name.toLowerCase() === q.toLowerCase()) &&
      !allTags.some((t) => t.name.toLowerCase() === q.toLowerCase());

    tagSuggestions.innerHTML = "";

    if (!q || (suggestions.length === 0 && !canCreate)) {
      closeSuggestions();
      return;
    }

    if (canCreate) {
      const createBtn = document.createElement("button");
      createBtn.type = "button";
      createBtn.className = "tag-suggestion create";
      createBtn.setAttribute("role", "option");
      createBtn.setAttribute("aria-selected", "false");
      createBtn.textContent = `Create “${q}”`;
      createBtn.addEventListener("click", () => {
        commitTypedTag();
        tagInput.focus();
      });
      tagSuggestions.appendChild(createBtn);
    }

    suggestions.forEach((tag, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tag-suggestion";
      btn.dataset.index = String(index);
      btn.setAttribute("role", "option");
      btn.setAttribute("aria-selected", "false");
      btn.id = `tag-suggestion-${index}`;
      const name = document.createElement("span");
      name.textContent = tag.name;
      const count = document.createElement("span");
      count.className = "count";
      count.textContent = String(tag.count);
      btn.appendChild(name);
      btn.appendChild(count);
      btn.addEventListener("click", () => {
        commitSuggestion(tag);
        tagInput.focus();
      });
      tagSuggestions.appendChild(btn);
    });

    tagSuggestions.classList.add("open");
  }

  function moveSuggestion(delta: number): void {
    const items = currentSuggestions();
    if (items.length === 0) return;
    activeSuggestionIndex =
      (activeSuggestionIndex + delta + items.length) % items.length;
    const buttons = tagSuggestions.querySelectorAll<HTMLButtonElement>(
      ".tag-suggestion[data-index]",
    );
    buttons.forEach((b) => {
      const idx = Number(b.dataset.index);
      const isActive = idx === activeSuggestionIndex;
      b.classList.toggle("active", isActive);
      b.setAttribute("aria-selected", String(isActive));
    });
    const active = tagSuggestions.querySelector<HTMLElement>(
      ".tag-suggestion.active",
    );
    if (active) {
      tagSuggestions.scrollTop = active.offsetTop;
      // Announce selection to assistive tech via active descendant on input.
      tagInput.setAttribute("aria-activedescendant", active.id);
    } else {
      tagInput.removeAttribute("aria-activedescendant");
    }
  }

  function closeSuggestions(): void {
    tagSuggestions.classList.remove("open");
    activeSuggestionIndex = -1;
    tagInput.removeAttribute("aria-activedescendant");
  }

  // -------------------- Save --------------------
  saveBtn.addEventListener("click", async () => {
    if (isSaved || !currentUrl) return;

    const typedTitle = titleInput.value.trim();
    if (userEditedTitle && !typedTitle) {
      statusDiv.textContent = "Title cannot be empty";
      statusDiv.style.color = "#dc2626";
      titleInput.focus();
      return;
    }

    isSaved = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "Saved!";
    showSuccess("Saved!");

    // Commit any half-typed tag so it isn't silently dropped.
    commitTypedTag();

    chrome.runtime.sendMessage({
      type: MESSAGE_TYPES.SAVE_BOOKMARK,
      data: {
        url: currentUrl,
        // Untouched title → null so metadata wins server-side. Edited title
        // (even if it matches the tab title) is sent explicitly.
        title: userEditedTitle ? typedTitle : null,
        workspaceId: selectedWorkspaceId,
        // Only send tags when the user interacted with the field; otherwise
        // omit to keep the payload identical to fast flows.
        tags:
          userEditedTags || selectedTags.length > 0
            ? selectedTags.map((t) => t.name)
            : [],
      },
    });

    setTimeout(() => window.close(), 400);
  });

  workspaceSelect.addEventListener("change", async () => {
    selectedWorkspaceId = workspaceSelect.value || null;
    if (selectedWorkspaceId) {
      await setLastWorkspace(selectedWorkspaceId);
    }
    isSaved = false;
    updateSaveButton();

    if (!currentUrl || !selectedWorkspaceId) return;

    try {
      const result = (await chrome.runtime.sendMessage({
        type: MESSAGE_TYPES.CHECK_BOOKMARK,
        data: { url: currentUrl, workspaceId: selectedWorkspaceId },
      })) as { saved?: boolean };

      if (result.saved) {
        isSaved = true;
        saveBtn.disabled = true;
        saveBtn.textContent = "Already saved";
        statusDiv.textContent = "";
      } else {
        isSaved = false;
        saveBtn.disabled = false;
        updateSaveButton();
      }
    } catch {
      // silent
    }
  });

  function updateSaveButton(): void {
    if (isSaved) return;
    // Keep the label short so long tab titles never wrap the button. Use a
    // tag-count indicator when tags are present to preserve quick state.
    const tagCount = selectedTags.length;
    if (tagCount > 0) {
      saveBtn.textContent = `Save · ${tagCount} tag${tagCount === 1 ? "" : "s"}`;
    } else {
      saveBtn.textContent = "Save";
    }
  }

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

  function showAuthRequired(): void {
    authSection.classList.remove("hidden");
    mainSection.classList.add("hidden");
  }

  async function refreshAuthAndShowMain(): Promise<void> {
    // Fire-and-restore: all independent, so parallel (was serial). Tags read
    // from the session cache first — they were warmed by the initial open —
    // and the network refetch updates them when it lands.
    const [tabInfo, cachedTagsEntry] = await Promise.all([
      getCurrentTabInfo(),
      getCachedTags(),
    ]);
    currentTabInfo = tabInfo;
    currentUrl = currentTabInfo?.url ?? null;
    if (cachedTagsEntry) allTags = cachedTagsEntry.value;
    if (!userEditedTitle) {
      titleInput.value = currentTabInfo?.title ?? "";
    }
    updateSaveButton();
    await Promise.all([initPopup(), fetchTags()]);
  }

  window.addEventListener("focus", refreshAuthAndShowMain);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refreshAuthAndShowMain();
    }
  });

  function showSuccess(msg: string): void {
    statusDiv.textContent = msg;
    statusDiv.style.color = "#16a34a";
  }
});
