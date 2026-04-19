import * as cheerio from "cheerio";

export interface FeedItem {
  title: string;
  link: string;
  content: string;
  contentSnippet: string;
  pubDate: string;
  guid: string;
  author?: string;
}

export interface ParsedFeed {
  title: string;
  description: string;
  link: string;
  items: FeedItem[];
}

function cleanText(text: string | undefined): string {
  if (!text) return "";
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<\/?[^>]+(>|$)/g, "")
    .trim();
}

function extractAtomEntryLink(entryXml: string): string {
  const $ = cheerio.load(entryXml, { xmlMode: true });
  // rel="alternate" has highest priority
  let link = $('link[rel="alternate"]').attr("href");
  if (link) return link;
  // Then any link with href
  link = $("link[href]").attr("href");
  if (link) return link;
  return "";
}

function parseRSSItem(itemXml: string): FeedItem {
  const $ = cheerio.load(itemXml, { xmlMode: true });

  const title = cleanText($("title").first().text());
  const link = cleanText($("link").first().text());
  const content =
    cleanText($("content\\:encoded, content\\:encoded").first().text()) ||
    cleanText($("description").first().text());
  const description = cleanText($("description").first().text());
  const pubDate = cleanText($("pubDate, dc\\:date").first().text());
  const guid = cleanText($("guid, id").first().text()) || link;
  const author = cleanText($("dc\\:creator, author").first().text());

  return {
    title: title || "Untitled",
    link,
    content,
    contentSnippet: description.substring(0, 500),
    pubDate,
    guid,
    author: author || undefined,
  };
}

function parseAtomEntry(entryXml: string): FeedItem {
  const $ = cheerio.load(entryXml, { xmlMode: true });

  const title = cleanText($("title").first().text());
  const link = extractAtomEntryLink(entryXml);
  const content = cleanText($("content, summary").first().text());
  const pubDate = cleanText($("published, updated").first().text());
  const guid = cleanText($("id").first().text()) || link;
  const author = cleanText($("author name").first().text());

  return {
    title: title || "Untitled",
    link,
    content,
    contentSnippet: content.substring(0, 500),
    pubDate,
    guid,
    author: author || undefined,
  };
}

export async function parseFeed(url: string): Promise<ParsedFeed> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; Sheltermark/1.0)",
      Accept:
        "application/rss+xml, application/atom+xml, application/xml, text/xml",
    },
    next: { revalidate: 300 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.statusText}`);
  }

  const xml = await response.text();
  const $ = cheerio.load(xml, { xmlMode: true });

  // Detect feed type
  const isAtom = $("feed").length > 0;
  const isRSS = $("channel").length > 0 || $("rss").length > 0;

  if (isAtom) {
    const title = cleanText($("feed > title").first().text());
    const description = cleanText($("feed > subtitle").first().text());
    const link =
      $('feed > link[rel="alternate"]').attr("href") ||
      $("feed > link").first().attr("href") ||
      "";

    const entries: FeedItem[] = [];
    $("entry").each((_, el) => {
      const entryXml = $.html(el);
      entries.push(parseAtomEntry(entryXml));
    });

    return { title, description, link, items: entries };
  }

  if (isRSS) {
    const channel = $("channel").first();
    const title = cleanText(channel.find("title").first().text());
    const description = cleanText(channel.find("description").first().text());
    const link = cleanText(channel.find("link").first().text());

    const items: FeedItem[] = [];
    channel.find("item").each((_, el) => {
      const itemXml = $.html(el);
      items.push(parseRSSItem(itemXml));
    });

    return { title, description, link, items };
  }

  throw new Error(
    "Unsupported feed format. Only RSS and Atom feeds are supported.",
  );
}
