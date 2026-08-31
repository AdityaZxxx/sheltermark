import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { parseHTML } from "linkedom";

/**
 * One-shot migration parity harness: same fixtures through jsdom (old) and
 * linkedom (new), mirroring the exact shim lib/extract/readability.ts uses
 * (defineProperty baseURI/documentURI). jsdom is a devDependency for these
 * tests only — delete this directory once the migration is confirmed in prod.
 */

export function extractWithJsdom(html: string, url: string) {
  const dom = new JSDOM(html, { url });
  return new Readability(dom.window.document, {
    charThreshold: 120,
  }).parse();
}

export function extractWithLinkedom(html: string, url: string) {
  const { document } = parseHTML(html);
  Object.defineProperty(document, "baseURI", { value: url });
  Object.defineProperty(document, "documentURI", { value: url });
  return new Readability(document, {
    charThreshold: 120,
  }).parse();
}
