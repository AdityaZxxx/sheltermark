import type { ImportResult } from "~/hooks/use-import-dialog";

interface DoneStepProps {
  result: ImportResult;
}

export function DoneStep({ result }: DoneStepProps) {
  return (
    <div className="flex flex-col gap-4 py-4">
      <div className="text-center">
        <p className="text-lg font-medium">Import Complete</p>
        <p className="text-sm text-muted-foreground mt-1">
          {result.imported} imported, {result.skipped} skipped
        </p>
      </div>
    </div>
  );
}
