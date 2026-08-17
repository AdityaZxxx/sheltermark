"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { ImportFileType, ParsedBookmark } from "~/lib/import/parsers";

import { importBookmarks, previewImport } from "~/app/action/import.action";
import { type DetectedFormat, detectFormat } from "~/lib/import/detect";
import {
  bookmarkSurvivesFilter,
  type FolderNode,
  pathKey,
} from "~/lib/import/folder-filter";
import { parseImportFile } from "~/lib/import/parsers";
import { bookmarkKeys, workspaceKeys } from "~/lib/query-keys";

type ImportStep = "upload" | "preview" | "importing" | "done";

export interface PreviewData {
  totalBookmarks: number;
  validBookmarks: number;
  duplicates: number;
  workspaces: Array<{ name: string; count: number }>;
}

export interface ImportResult {
  imported: number;
  skipped: number;
  /** Workspace the bookmarks were imported into, if known. */
  workspaceId?: string | null;
}

interface ImportOptions {
  targetWorkspaceId: string | null;
  createWorkspace: boolean;
  newWorkspaceName?: string;
  duplicateStrategy?: "skip" | "replace";
}

/**
 * Collect every distinct folder path that appears in the bookmarks,
 * including the empty path for top-level bookmarks.
 */
function collectAllFolderPaths(bookmarks: ParsedBookmark[]): Set<string> {
  const paths = new Set<string>();
  for (const bm of bookmarks) {
    const fp = bm.folderPath ?? [];
    for (let depth = 0; depth <= fp.length; depth++) {
      paths.add(pathKey(fp.slice(0, depth)));
    }
  }
  return paths;
}

/**
 * Derive a folder tree from a list of bookmarks that carry `folderPath`.
 * Returns folders in DFS order so the UI can render a stable list.
 */
function buildFolderTree(bookmarks: ParsedBookmark[]): FolderNode[] {
  const folderMap = new Map<string, FolderNode>();

  for (const bm of bookmarks) {
    const path = bm.folderPath ?? [];
    // Walk every ancestor folder so each gets a totalCount increment.
    for (let depth = 0; depth <= path.length; depth++) {
      const ancestor = path.slice(0, depth);
      const key = pathKey(ancestor);
      const existing = folderMap.get(key);
      if (existing) {
        if (depth === path.length) {
          existing.directCount += 1;
        }
        existing.totalCount += 1;
      } else {
        folderMap.set(key, {
          path: ancestor,
          directCount: depth === path.length ? 1 : 0,
          totalCount: 1,
        });
      }
    }
  }

  // Sort by path length then alphabetically for stable UI ordering.
  return Array.from(folderMap.values()).toSorted((a, b) => {
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.join("/").localeCompare(b.path.join("/"));
  });
}

interface UseImportDialogReturn {
  step: ImportStep;
  file: File | null;
  fileType: ImportFileType | null;
  detectedFormat: DetectedFormat | null;
  preview: PreviewData | null;
  progress: number;
  targetWorkspaceId: string | "new";
  newWorkspaceName: string;
  duplicateStrategy: "skip" | "replace";
  result: ImportResult | null;
  isCheckingDuplicates: boolean;
  isParsing: boolean;
  isNewWorkspace: boolean;
  /** All parsed bookmarks from the file (before folder filtering). */
  parsedBookmarks: ParsedBookmark[];
  /** Folder tree for browser imports; empty for JSON/CSV. */
  folderTree: FolderNode[];
  /** Set of currently-selected folder path keys. */
  selectedFolders: Set<string>;
  /** Number of bookmarks remaining after folder selection. */
  selectedCount: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleImport: () => Promise<void>;
  handleClose: () => void;
  goBack: () => void;
  setTargetWorkspaceId: (value: string | "new") => void;
  setNewWorkspaceName: (value: string) => void;
  setDuplicateStrategy: (value: "skip" | "replace") => void;
  toggleFolder: (path: string[]) => void;
}

export function useImportDialog(): UseImportDialogReturn {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [fileType, setFileType] = useState<ImportFileType | null>(null);
  const [detectedFormat, setDetectedFormat] = useState<DetectedFormat | null>(
    null,
  );
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [progress, setProgress] = useState(0);
  const [targetWorkspaceId, setTargetWorkspaceId] = useState<string | "new">(
    "new",
  );
  const [newWorkspaceName, setNewWorkspaceName] =
    useState("Imported - Browser");
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    "skip" | "replace"
  >("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedBookmarks, setParsedBookmarks] = useState<ParsedBookmark[]>([]);
  // Selected folder path keys. Initialized on parse-success to all folder
  // paths so the default UX is "everything selected" (ADR-0005).
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );

  const isNewWorkspace = targetWorkspaceId === "new";

  const folderTree = useMemo(() => {
    if (fileType !== "netscape") return [];
    return buildFolderTree(parsedBookmarks);
  }, [parsedBookmarks, fileType]);

  /**
   * Bookmarks remaining after folder filtering. For Netscape imports,
   * a bookmark survives iff every ancestor folder (and its own folder)
   * is in `selectedFolders`. Top-level bookmarks survive iff the empty
   * path key is selected.
   */
  const selectedCount = useMemo(() => {
    if (fileType !== "netscape") return parsedBookmarks.length;
    return parsedBookmarks.filter((bm) =>
      bookmarkSurvivesFilter(bm.folderPath, selectedFolders),
    ).length;
  }, [parsedBookmarks, selectedFolders, fileType]);

  const getImportOptions = useCallback(
    (_workspaceId: string | "new", workspaceName: string): ImportOptions => ({
      targetWorkspaceId: _workspaceId !== "new" ? _workspaceId : null,
      createWorkspace: _workspaceId === "new",
      newWorkspaceName: _workspaceId === "new" ? workspaceName : undefined,
    }),
    [],
  );

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setFileType(null);
    setDetectedFormat(null);
    setPreview(null);
    setProgress(0);
    setTargetWorkspaceId("new");
    setNewWorkspaceName("Imported - Browser");
    setDuplicateStrategy("skip");
    setResult(null);
    setIsCheckingDuplicates(false);
    setIsParsing(false);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
  }, []);

  const refreshPreview = useCallback(async () => {
    if (!file || step !== "preview" || !fileType) return;

    setIsCheckingDuplicates(true);
    const content = await file.text();
    const previewResult = await previewImport(content, fileType, {
      ...getImportOptions(targetWorkspaceId, newWorkspaceName),
      // For Netscape, always send folder paths so the preview reflects
      // the user's current selection (even when the entire file is deselected,
      // we send an explicit empty-ish selection so the server returns 0).
      folderPaths:
        fileType === "netscape" ? Array.from(selectedFolders) : undefined,
    });

    if (previewResult.success) {
      setPreview(previewResult.data);
    }
    setIsCheckingDuplicates(false);
  }, [
    file,
    step,
    fileType,
    targetWorkspaceId,
    newWorkspaceName,
    selectedFolders,
    getImportOptions,
  ]);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFile = e.target.files?.[0];
      if (!selectedFile) return;

      setIsParsing(true);
      try {
        const content = await selectedFile.text();

        const format = detectFormat(content);
        if (format === "unknown") {
          toast.error(
            "Unsupported file format. Sheltermark supports browser bookmarks (HTML), Sheltermark JSON, and Sheltermark CSV.",
          );
          setIsParsing(false);
          return;
        }

        const previewResult = await previewImport(
          content,
          format,
          getImportOptions(targetWorkspaceId, newWorkspaceName),
        );

        if (!previewResult.success) {
          toast.error(previewResult.error);
          setIsParsing(false);
          return;
        }

        const localParse = parseImportFile(content, format);
        if (!localParse.success) {
          toast.error(localParse.error);
          setIsParsing(false);
          return;
        }

        setFile(selectedFile);
        setFileType(format);
        setDetectedFormat(format);
        setPreview(previewResult.data);
        setParsedBookmarks(localParse.bookmarks);

        // Default: select every folder (ADR-0005).
        setSelectedFolders(collectAllFolderPaths(localParse.bookmarks));

        setStep("preview");
      } catch {
        toast.error("Failed to parse file");
      } finally {
        setIsParsing(false);
      }
    },
    [targetWorkspaceId, newWorkspaceName, getImportOptions],
  );

  const handleImport = useCallback(async () => {
    if (!file || !fileType) return;

    if (fileType === "netscape" && selectedCount === 0) {
      toast.error("Select at least one folder to import.");
      return;
    }

    setStep("importing");
    setProgress(10);

    try {
      const content = await file.text();
      setProgress(30);

      const importResult = await importBookmarks(content, fileType, {
        targetWorkspaceId:
          targetWorkspaceId !== "new" ? targetWorkspaceId : undefined,
        duplicateStrategy,
        createWorkspace: targetWorkspaceId === "new",
        newWorkspaceName:
          targetWorkspaceId === "new" ? newWorkspaceName : undefined,
        folderPaths:
          fileType === "netscape" ? Array.from(selectedFolders) : undefined,
      });

      setProgress(100);

      if (!importResult.success) {
        toast.error(importResult.error);
        setStep("upload");
        return;
      }

      queryClient.invalidateQueries({ queryKey: bookmarkKeys.all });
      if (targetWorkspaceId === "new") {
        queryClient.invalidateQueries({ queryKey: workspaceKeys.all });
      }

      const importedData = importResult.data;
      setResult({
        imported: importedData?.imported ?? 0,
        skipped: importedData?.skipped ?? 0,
        workspaceId: targetWorkspaceId !== "new" ? targetWorkspaceId : null,
      });
      setStep("done");
      toast.success(`Imported ${importedData?.imported ?? 0} bookmarks`);
    } catch {
      toast.error("Import failed");
    }
  }, [
    file,
    fileType,
    targetWorkspaceId,
    duplicateStrategy,
    newWorkspaceName,
    selectedCount,
    selectedFolders,
    queryClient,
  ]);

  const handleClose = useCallback(() => {
    resetState();
  }, [resetState]);

  const goBack = useCallback(() => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
  }, []);

  /**
   * Toggle selection of a folder and all its descendants. If every
   * bookmark in the subtree currently survives the filter, the toggle
   * deselects; otherwise it selects.
   *
   * For the top-level "select all" toggle (path = []), if everything is
   * currently selected we clear all; otherwise we select all.
   */
  const toggleFolder = useCallback(
    (path: string[]) => {
      // Top-level toggle
      if (path.length === 0) {
        const allSelected = selectedCount === parsedBookmarks.length;
        if (allSelected) {
          setSelectedFolders(new Set());
        } else {
          setSelectedFolders(collectAllFolderPaths(parsedBookmarks));
        }
        return;
      }

      // Determine whether every bookmark in this subtree survives the
      // current filter (i.e. is fully selected).
      const subtree = parsedBookmarks.filter((bm) => {
        const bp = bm.folderPath ?? [];
        if (bp.length < path.length) return false;
        for (let i = 0; i < path.length; i++) {
          if (bp[i] !== path[i]) return false;
        }
        return true;
      });

      const subtreeFullySelected = subtree.every((bm) =>
        bookmarkSurvivesFilter(bm.folderPath, selectedFolders),
      );

      setSelectedFolders((prev) => {
        const next = new Set(prev);

        if (subtreeFullySelected) {
          // Deselect this folder and all descendants.
          for (const bm of subtree) {
            const bp = bm.folderPath ?? [];
            for (let depth = path.length - 1; depth < bp.length; depth++) {
              next.delete(pathKey(bp.slice(0, depth + 1)));
            }
          }
          next.delete(pathKey(path));
        } else {
          // Select this folder and all descendants.
          next.add(pathKey(path));
          for (const bm of subtree) {
            const bp = bm.folderPath ?? [];
            for (let depth = path.length - 1; depth < bp.length; depth++) {
              next.add(pathKey(bp.slice(0, depth + 1)));
            }
          }
        }

        return next;
      });
    },
    [parsedBookmarks, selectedFolders, selectedCount],
  );

  const debouncedRefreshPreview = useCallback(() => {
    if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    previewTimerRef.current = setTimeout(() => refreshPreview(), 300);
  }, [refreshPreview]);

  useEffect(() => {
    debouncedRefreshPreview();
    return () => {
      if (previewTimerRef.current) clearTimeout(previewTimerRef.current);
    };
  }, [debouncedRefreshPreview]);

  return {
    step,
    file,
    fileType,
    detectedFormat,
    preview,
    progress,
    targetWorkspaceId,
    newWorkspaceName,
    duplicateStrategy,
    result,
    isCheckingDuplicates,
    isParsing,
    isNewWorkspace,
    parsedBookmarks,
    folderTree,
    selectedFolders,
    selectedCount,
    fileInputRef,
    handleFileChange,
    handleImport,
    handleClose,
    goBack,
    setTargetWorkspaceId,
    setNewWorkspaceName,
    setDuplicateStrategy,
    toggleFolder,
  };
}
