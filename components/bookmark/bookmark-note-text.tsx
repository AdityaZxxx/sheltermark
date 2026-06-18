import Markdown from "react-markdown";

const ALLOWED_INLINE = ["strong", "em", "code", "a"] as const;

const flattenNewlines = (s: string) => s.replace(/\s*\n\s*/g, " ");

const isSafeHref = (href: string | undefined): href is string =>
  typeof href === "string" && /^(https?:|mailto:)/i.test(href.trim());

interface BookmarkNoteTextProps {
  text: string;
}

export function BookmarkNoteText({ text }: BookmarkNoteTextProps) {
  return (
    <Markdown
      allowedElements={ALLOWED_INLINE as unknown as string[]}
      unwrapDisallowed
      components={{
        a: ({ href, children }) =>
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
        code: ({ children }) => (
          <code className="font-mono bg-muted/40 rounded-sm px-1 py-px text-[0.9em] not-italic">
            {children}
          </code>
        ),
      }}
    >
      {flattenNewlines(text)}
    </Markdown>
  );
}
