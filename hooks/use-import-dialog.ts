"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type { ImportFileType, ParsedBookmark } from "~/lib/import/parsers";

import { importBookmarks, previewImport } from "~/app/action/import.action";
import { useUser } from "~/components/providers/user-context";
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

const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
const DEFAULT_WORKSPACE_NAME = "Imported bookmarks";
const BROWSER_WORKSPACE_NAME = "Imported - Browser";

function defaultNameFor(format: ImportFileType, fileName: string): string {
  if (format === "netscape") return BROWSER_WORKSPACE_NAME;
  const base = fileName
    .replace(/\.[^/.]+$/, "")
    .trim()
    .slice(0, 35);
  return base || DEFAULT_WORKSPACE_NAME;
}

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

function buildFolderTree(bookmarks: ParsedBookmark[]): FolderNode[] {
  const folderMap = new Map<string, FolderNode>();

  for (const bm of bookmarks) {
    const path = bm.folderPath ?? [];
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

  return Array.from(folderMap.values()).toSorted((a, b) => {
    if (a.path.length !== b.path.length) return a.path.length - b.path.length;
    return a.path.join("/").localeCompare(b.path.join("/"));
  });
}

function getImportOptions(_workspaceId: string | "new", workspaceName: string) {
  return {
    targetWorkspaceId: _workspaceId !== "new" ? _workspaceId : null,
    createWorkspace: _workspaceId === "new",
    newWorkspaceName: _workspaceId === "new" ? workspaceName : undefined,
  };
}

type ParsedFileResult =
  | {
      ok: true;
      format: ImportFileType;
      bookmarks: ParsedBookmark[];
      preview: PreviewData;
    }
  | { ok: false; error: string };

function failParse(message: string): ParsedFileResult {
  toast.error(message);
  return { ok: false, error: message };
}

async function selectAndParseFile(
  selectedFile: File,
  targetWorkspaceId: string | "new",
  newWorkspaceName: string,
): Promise<ParsedFileResult> {
  if (selectedFile.size > MAX_IMPORT_BYTES) {
    return failParse(
      "File is too large (max 10 MB). Export a smaller bookmark list and try again.",
    );
  }

  try {
    const content = await selectedFile.text();

    const format = detectFormat(content);
    if (format === "unknown") {
      return failParse(
        "Unsupported file format. Sheltermark supports browser bookmarks (HTML), Sheltermark JSON, and Sheltermark CSV. Try a different file.",
      );
    }

    const localParse = parseImportFile(content, format);
    if (!localParse.success) {
      return failParse(localParse.error ?? "Failed to parse file");
    }

    if (localParse.bookmarks.length === 0) {
      return failParse(
        "No bookmarks found in this file. Try a different file.",
      );
    }

    // Parse locally first so the server-side preview receives the same
    // folder filter the preview step displays (all folders selected).
    const previewResult = await previewImport(content, format, {
      ...getImportOptions(targetWorkspaceId, newWorkspaceName),
      folderPaths:
        format === "netscape"
          ? Array.from(collectAllFolderPaths(localParse.bookmarks))
          : undefined,
    });
    if (!previewResult.success) {
      return failParse(previewResult.error);
    }

    return {
      ok: true,
      format,
      bookmarks: localParse.bookmarks,
      preview: previewResult.data,
    };
  } catch {
    return failParse("Failed to parse file. Try re-exporting it.");
  }
}

function previewSignature(
  file: File,
  fileType: ImportFileType,
  targetWorkspaceId: string | "new",
  selectedFolders: ReadonlySet<string>,
): string {
  // Workspace name is excluded: it never affects duplicate counts (only
  // createWorkspace does), so renaming must not trigger a re-check.
  const folderPart =
    fileType === "netscape"
      ? Array.from(selectedFolders).toSorted().join("\u0000")
      : "";
  return [
    file.name,
    String(file.size),
    fileType,
    targetWorkspaceId,
    folderPart,
  ].join("\u0001");
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
  parseError: string | null;
  /** All parsed bookmarks from the file (before folder filtering). */
  parsedBookmarks: ParsedBookmark[];
  /** Folder tree for browser imports; empty for JSON/CSV. */
  folderTree: FolderNode[];
  /** Set of currently-selection folder path keys. */
  selectedFolders: Set<string>;
  /** Number of bookmarks remaining after folder selection. */
  selectedCount: number;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleFileSelect: (selectedFile: File | null | undefined) => Promise<void>;
  handleImport: () => Promise<void>;
  resetState: () => void;
  goBack: () => void;
  clearFile: () => void;
  setTargetWorkspaceId: (value: string | "new") => void;
  setNewWorkspaceName: (value: string) => void;
  setDuplicateStrategy: (value: "skip" | "replace") => void;
  toggleFolder: (path: string[]) => void;
}

export function useImportDialog(): UseImportDialogReturn {
  const queryClient = useQueryClient();
  const userId = useUser().id;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewSigRef = useRef<string | null>(null);

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
  const [newWorkspaceName, setNewWorkspaceName] = useState(
    DEFAULT_WORKSPACE_NAME,
  );
  const [duplicateStrategy, setDuplicateStrategy] = useState<
    "skip" | "replace"
  >("skip");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedBookmarks, setParsedBookmarks] = useState<ParsedBookmark[]>([]);
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(
    new Set(),
  );

  const isNewWorkspace = targetWorkspaceId === "new";

  const folderTree =
    fileType !== "netscape" ? [] : buildFolderTree(parsedBookmarks);

  const selectedCount =
    fileType !== "netscape"
      ? parsedBookmarks.length
      : parsedBookmarks.filter((bm) =>
          bookmarkSurvivesFilter(bm.folderPath, selectedFolders),
        ).length;

  const clearInputValue = useCallback(() => {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const resetState = useCallback(() => {
    setStep("upload");
    setFile(null);
    setFileType(null);
    setDetectedFormat(null);
    setPreview(null);
    setProgress(0);
    setTargetWorkspaceId("new");
    setNewWorkspaceName(DEFAULT_WORKSPACE_NAME);
    setDuplicateStrategy("skip");
    setResult(null);
    setIsCheckingDuplicates(false);
    setIsParsing(false);
    setParseError(null);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
    previewSigRef.current = null;
    clearInputValue();
  }, [clearInputValue]);

  // Debounced re-check, skipped when the preview already reflects the
  // current inputs. New workspaces can't have duplicates, so no check runs.
  useEffect(() => {
    if (!file || step !== "preview" || !fileType) return;
    if (isNewWorkspace || !preview) return;

    const sig = previewSignature(
      file,
      fileType,
      targetWorkspaceId,
      selectedFolders,
    );
    if (previewSigRef.current === sig) return;

    const timer = setTimeout(async () => {
      setIsCheckingDuplicates(true);
      const content = await file.text();
      const previewResult = await previewImport(content, fileType, {
        ...getImportOptions(targetWorkspaceId, newWorkspaceName),
        folderPaths:
          fileType === "netscape" ? Array.from(selectedFolders) : undefined,
      });

      if (previewResult.success) {
        setPreview(previewResult.data);
        previewSigRef.current = sig;
      }
      setIsCheckingDuplicates(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    file,
    step,
    fileType,
    targetWorkspaceId,
    newWorkspaceName,
    selectedFolders,
    preview,
    isNewWorkspace,
  ]);

  const handleFileSelect = async (selectedFile: File | null | undefined) => {
    if (!selectedFile) return;

    setIsParsing(true);
    setParseError(null);
    const parsed = await selectAndParseFile(
      selectedFile,
      targetWorkspaceId,
      newWorkspaceName,
    );
    if (parsed.ok) {
      const allFolderPaths = collectAllFolderPaths(parsed.bookmarks);
      previewSigRef.current = previewSignature(
        selectedFile,
        parsed.format,
        targetWorkspaceId,
        allFolderPaths,
      );
      setFile(selectedFile);
      setFileType(parsed.format);
      setDetectedFormat(parsed.format);
      setPreview(parsed.preview);
      setParsedBookmarks(parsed.bookmarks);
      setSelectedFolders(allFolderPaths);
      setNewWorkspaceName((prev) => {
        const isDefault =
          prev.trim() === "" ||
          prev === DEFAULT_WORKSPACE_NAME ||
          prev === BROWSER_WORKSPACE_NAME;
        if (targetWorkspaceId === "new" && isDefault) {
          return defaultNameFor(parsed.format, selectedFile.name);
        }
        return prev;
      });
      setStep("preview");
    } else {
      setParseError(parsed.error);
    }
    setIsParsing(false);
    clearInputValue();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await handleFileSelect(e.target.files?.[0]);
  };

  const handleImport = async () => {
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
        setStep("preview");
        return;
      }

      queryClient.invalidateQueries({
        queryKey: bookmarkKeys.all(userId),
      });
      if (targetWorkspaceId === "new") {
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.all(userId),
        });
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
      toast.error("Import failed. Please try again.");
      setStep("preview");
    }
  };

  const goBack = () => {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
    setParseError(null);
    previewSigRef.current = null;
    clearInputValue();
  };

  const clearFile = () => {
    setFile(null);
    setFileType(null);
    setDetectedFormat(null);
    setPreview(null);
    setParsedBookmarks([]);
    setSelectedFolders(new Set());
    setParseError(null);
    previewSigRef.current = null;
    setStep("upload");
    clearInputValue();
  };

  const toggleFolder = (path: string[]) => {
    if (path.length === 0) {
      const allSelected = selectedCount === parsedBookmarks.length;
      if (allSelected) {
        setSelectedFolders(new Set());
      } else {
        setSelectedFolders(collectAllFolderPaths(parsedBookmarks));
      }
      return;
    }

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
        for (const bm of subtree) {
          const bp = bm.folderPath ?? [];
          for (let depth = path.length - 1; depth < bp.length; depth++) {
            next.delete(pathKey(bp.slice(0, depth + 1)));
          }
        }
        next.delete(pathKey(path));
      } else {
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
  };

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
    parseError,
    parsedBookmarks,
    folderTree,
    selectedFolders,
    selectedCount,
    fileInputRef,
    handleFileChange,
    handleFileSelect,
    handleImport,
    resetState,
    goBack,
    clearFile,
    setTargetWorkspaceId,
    setNewWorkspaceName,
    setDuplicateStrategy,
    toggleFolder,
  };
}
