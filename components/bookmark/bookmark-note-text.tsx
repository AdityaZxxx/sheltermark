import Markdown from "react-markdown";

const ALLOWED_INLINE = ["strong", "em", "code", "a"] as const;

const flattenNewlines = (s: string) => s.replace(/\s*\n\s*/g, " ");

const isSafeHref = (href: string | null | undefined): href is string =>
  href !== null &&
  href !== undefined &&
  /^(https?:|mailto:)/i.test(href.trim());

const markdownComponents = {
  a: ({ href, children }: { href?: string; children?: React.ReactNode }) =>
    isSafeHref(href) ? (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {children}
      </a>
    ) : (
      children
    ),
  code: ({ children }: { children?: React.ReactNode }) => (
    <code className="font-mono bg-muted/40 rounded-sm px-1 py-px text-[0.9em] not-italic">
      {children}
    </code>
  ),
};

interface BookmarkNoteTextProps {
  text: string;
}

export function BookmarkNoteText({ text }: BookmarkNoteTextProps) {
  return (
    <Markdown
      allowedElements={ALLOWED_INLINE}
      unwrapDisallowed
      components={markdownComponents}
    >
      {flattenNewlines(text)}
    </Markdown>
  );
}
