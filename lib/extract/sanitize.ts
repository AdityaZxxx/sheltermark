import sanitizeHtml from "sanitize-html";

// The extracted HTML is untrusted third-party content served from our own
// origin. This allowlist is deliberately narrow and strips anything that can
// execute, navigate, submit, or exfiltrate. See ADR-0007.
const ALLOWED_TAGS = [
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "p",
  "a",
  "img",
  "pre",
  "code",
  "blockquote",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "b",
  "i",
  "s",
  "u",
  "br",
  "hr",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "sup",
  "sub",
  "small",
  "mark",
  // Collapsible sections (GitHub README <details>) — static structure, no
  // scripts; closed by default, opens on click without JS.
  "details",
  "summary",
  "span",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "title", "rel", "target"],
  img: ["src", "alt", "title", "width", "height"],
  // `class` on code/span carries GitHub's pl-* syntax-highlight tokens —
  // inert presentation classes, rendered by the reader CSS. details keeps
  // `open` so README install sections start expanded.
  code: ["class"],
  span: ["class"],
  details: ["open"],
  th: ["align"],
  td: ["align"],
};

// GitHub syntax tokens (pl-*, language-*) are the only classes we pass
// through; anything else on span/code is dropped.
const GH_TOKEN_CLASSES = [
  "pl-c",
  "pl-c1",
  "pl-e",
  "pl-en",
  "pl-ent",
  "pl-k",
  "pl-pds",
  "pl-pse",
  "pl-s",
  "pl-s1",
  "pl-smw",
  "pl-v",
];

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedClasses: {
      code: GH_TOKEN_CLASSES,
      span: GH_TOKEN_CLASSES,
    },
    // Strip dangerous/executable/navigation-capable URL schemes.
    allowedSchemes: ["http", "https", "mailto"],
    // Rewrite links to open safely in a new tab and drop opener/target tricks.
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        rel: "noopener noreferrer",
        target: "_blank",
      }),
    },
    // Never allow any scheme on attributes beyond the base allowlist.
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    parser: {
      lowerCaseTags: true,
    },
  });
}
