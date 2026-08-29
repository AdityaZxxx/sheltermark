import { describe, expect, it } from "bun:test";

import {
  isGithubUrl,
  PROXY_CSP,
  transformGithubHtml,
} from "~/lib/preview/github-proxy";

// The proxy document is untrusted GitHub HTML served from Sheltermark's
// origin (ADR-0007). Unlike reader extraction, the DOM survives intact —
// security comes from script removal + CSP + sandbox, NOT from an
// attribute/class allowlist (which breaks GitHub's own hidden-fallback
// structure). These fixtures pin that contract.
function wrap(bodyInner: string, head = ""): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Repo name</title>
${head}
</head>
<body class="logged-out env-production page-responsive">
${bodyInner}
</body>
</html>`;
}

const URL = "https://github.com/basecamp/omarchy";

describe("github proxy URL gating", () => {
  it("accepts only github.com and gist.github.com over https", () => {
    expect(isGithubUrl("https://github.com/basecamp/omarchy")).toBe(true);
    expect(isGithubUrl("https://github.com/basecamp/omarchy/issues")).toBe(
      true,
    );
    expect(isGithubUrl("https://gist.github.com/user/abc")).toBe(true);
    expect(isGithubUrl("https://evil.com/github.com")).toBe(false);
    expect(isGithubUrl("https://github.com.evil.com/basecamp/omarchy")).toBe(
      false,
    );
    expect(isGithubUrl("http://github.com/basecamp/omarchy")).toBe(false);
    expect(isGithubUrl("not a url")).toBe(false);
  });
});

describe("github proxy transform: execution vectors", () => {
  it("removes ALL scripts — inline, first-party, and third-party", () => {
    const out = transformGithubHtml(
      wrap(
        "<script>alert(1)</script>" +
          "<p>ok</p>" +
          '<script src="https://evil.com/x.js"></script>' +
          '<script src="https://github.githubassets.com/assets/app.js"></script>' +
          '<script type="application/json">{"payload":1}</script>',
      ),
      URL,
    );
    expect(out?.html).not.toContain("<script");
    expect(out?.html).not.toContain("alert(1)");
    expect(out?.html).not.toContain("evil.com");
    expect(out?.html).toContain("<p>ok</p>");
  });

  it("removes forms, frames, and embeds", () => {
    const out = transformGithubHtml(
      wrap(
        '<form action="https://evil.com"><input name="q"></form>' +
          '<iframe src="https://evil.com"></iframe>' +
          '<object data="https://evil.com"></object>' +
          '<embed src="https://evil.com">',
      ),
      URL,
    );
    expect(out?.html).not.toContain("<form");
    expect(out?.html).not.toContain("<iframe");
    expect(out?.html).not.toContain("<object");
    expect(out?.html).not.toContain("<embed");
  });

  it("strips meta refresh", () => {
    const out = transformGithubHtml(
      wrap(
        "<p>ok</p>",
        '<meta http-equiv="refresh" content="0;url=https://evil.com">',
      ),
      URL,
    );
    expect(out?.html).not.toContain("http-equiv");
    expect(out?.html).not.toContain("evil.com");
  });

  it("unwraps noscript so the no-JS fallback images render", () => {
    const out = transformGithubHtml(
      wrap('<noscript><img src="a.png"></noscript>'),
      URL,
    );
    expect(out?.html).not.toContain("<noscript");
    expect(out?.html).toContain("<img");
  });
});

describe("github proxy transform: native DOM integrity", () => {
  it("keeps GitHub classes, data-attrs, hidden attrs, and templates", () => {
    const out = transformGithubHtml(
      wrap(
        "<template><div>x</div></template>" +
          '<div class="Layout container-lg UnderlineNav" data-target="x">' +
          "<div data-show-on-forbidden-error hidden><h3>Uh oh!</h3></div>" +
          "</div>" +
          '<div class="markdown-body"><pre><code class="language-bash"><span class="pl-k">echo</span></code></pre></div>',
      ),
      URL,
    );
    expect(out?.html).toContain("<template");
    expect(out?.html).toContain("Layout container-lg UnderlineNav");
    expect(out?.html).toMatch(
      /data-show-on-forbidden-error(?:="")?\s+hidden(?:="")?/,
    );
    expect(out?.html).toContain("Uh oh!");
    expect(out?.html).toContain("markdown-body");
    expect(out?.html).toContain("pl-k");
  });

  it("injects a base tag and overlay css pointing at the source", () => {
    const out = transformGithubHtml(wrap("<p>x</p>"), URL);
    expect(out?.html).toContain(`<base href="${URL}" target="_blank">`);
    expect(out?.html).toContain("<style>");
    expect(out?.html).toContain("data-show-on-forbidden-error");
  });

  it("replaces an attacker-controlled existing base", () => {
    const out = transformGithubHtml(
      wrap("<p>x</p>", '<base href="https://evil.com/">'),
      URL,
    );
    expect(out?.html).toContain(`<base href="${URL}" target="_blank">`);
    expect(out?.html).not.toContain("evil.com");
  });

  it("absolutizes relative URLs against the source", () => {
    const out = transformGithubHtml(
      wrap('<a href="/basecamp">link</a><img src="pic.png">'),
      URL,
    );
    expect(out?.html).toContain('href="https://github.com/basecamp"');
    expect(out?.html).toContain('src="https://github.com/basecamp/pic.png"');
  });

  it("external anchors get noopener and _blank; hash anchors absolutize against base", () => {
    const out = transformGithubHtml(
      wrap('<a href="https://example.com">x</a><a href="#readme">r</a>'),
      URL,
    );
    expect(out?.html).toContain('rel="noopener noreferrer"');
    expect(out?.html).toContain('target="_blank"');
    expect(out?.html).toContain(`href="${URL}#readme"`);
  });

  it("promotes data-src lazy images (scripts are gone)", () => {
    const out = transformGithubHtml(
      wrap('<img alt="avatar" data-src="a.png">'),
      URL,
    );
    expect(out?.html).toContain('src="https://github.com/basecamp/a.png"');
  });

  it("rewrites srcset URLs", () => {
    const out = transformGithubHtml(
      wrap('<img src="a.png" srcset="b.png 1x, /c.png 2x">'),
      URL,
    );
    expect(out?.html).toContain("https://github.com/basecamp/b.png");
    expect(out?.html).toContain("https://github.com/c.png");
  });

  it("extracts the title", () => {
    const out = transformGithubHtml(wrap("<p>x</p>"), URL);
    expect(out?.title).toBe("Repo name");
  });
});

describe("github proxy CSP", () => {
  it("blocks all script execution; GitHub hosts only for style/img", () => {
    expect(PROXY_CSP).toContain("script-src 'none'");
    expect(PROXY_CSP).toContain("form-action 'none'");
    expect(PROXY_CSP).toContain("default-src 'none'");
    expect(PROXY_CSP).toContain("frame-ancestors 'self'");
    expect(PROXY_CSP).toContain(
      "style-src 'self' 'unsafe-inline' https://github.githubassets.com",
    );
    // No blanket https: catch-all for images — only GitHub's own asset hosts.
    const imgSrc = PROXY_CSP.match(/img-src ([^;]+)/)?.[1] ?? "";
    expect(imgSrc.split(" ")).not.toContain("https:");
    expect(imgSrc).toContain("githubusercontent.com");
  });
});
