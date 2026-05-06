import { UploadSimpleIcon } from "@phosphor-icons/react";

interface UploadStepProps {
  file: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function UploadStep({
  file,
  fileInputRef,
  onFileChange,
}: UploadStepProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <label className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors w-full block">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          className="hidden"
          onChange={onFileChange}
        />
        <UploadSimpleIcon className="size-8 mx-auto mb-2 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          {file ? file.name : "Click to upload JSON or CSV"}
        </p>
      </label>
    </div>
  );
}
