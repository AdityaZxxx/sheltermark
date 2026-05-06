interface ImportingStepProps {
  progress: number;
}

export function ImportingStep({ progress }: ImportingStepProps) {
  return (
    <div className="flex flex-col gap-4 py-8">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span>Importing bookmarks...</span>
          <span>{progress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
