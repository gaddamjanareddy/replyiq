/**
 * Turn a page of HTML into answerable chunks.
 *
 * ── Why no HTML parser dependency ─────────────────────────────────────────
 * This code runs over HTML fetched from arbitrary websites - untrusted input,
 * on a path that already carries SSRF risk. A full parser would be more correct
 * in the abstract, but it is also a large dependency with its own history of
 * parsing CVEs, pulled in to do something narrow: get the visible text out,
 * grouped by heading. We are not rendering this HTML, resolving entities into a
 * DOM, or executing anything from it.
 *
 * So this is deliberately small, auditable, and written to be safe on hostile
 * input: every pattern is linear (no nested quantifiers that can backtrack
 * catastrophically), and everything is bounded by explicit caps.
 *
 * Pure functions, no I/O - see site-ingestion.service.ts for usage.
 */

/** Sections shorter than this are navigation noise, not knowledge. */
const MIN_SECTION_CHARS = 40;
/** Hard cap per chunk. Longer sections are truncated on a word boundary. */
const MAX_SECTION_CHARS = 2000;
/** Never emit more than this from one page, however long it is. */
const MAX_SECTIONS_PER_PAGE = 25;

export interface ExtractedSection {
  /** The heading this text sat under, if any. */
  heading: string | null;
  content: string;
}

export interface ExtractedPage {
  title: string | null;
  description: string | null;
  sections: ExtractedSection[];
  /** Same-origin links found on the page, absolute and de-duplicated. */
  links: string[];
}

/**
 * Elements whose contents are never useful knowledge and are actively harmful
 * if included: scripts and styles are code, and nav/header/footer text repeats
 * on every page, which would make every page look similar to a search ranker.
 */
const STRIPPED_ELEMENTS = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'iframe',
  'nav',
  'header',
  'footer',
  'form',
  'aside',
];

function stripElement(html: string, tag: string): string {
  // Non-greedy, no nested quantifier: linear time on hostile input.
  const re = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?</${tag}\\s*>`, 'gi');
  let out = html;
  // Two passes handles one level of same-tag nesting (e.g. nested <nav>)
  // without risking the exponential behaviour of a recursive pattern.
  for (let i = 0; i < 2; i++) out = out.replace(re, ' ');
  // Self-closing or unterminated forms of the same tag.
  return out.replace(new RegExp(`<${tag}\\b[^>]*/?>`, 'gi'), ' ');
}

/** Decode the handful of entities that actually matter for readable text. */
export function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;|&#x0*27;/gi, "'")
    .replace(/&#(\d{1,7});/g, (_, code: string) => {
      const n = Number(code);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    })
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, hex: string) => {
      const n = parseInt(hex, 16);
      return n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    });
}

/** Strip tags and collapse whitespace into readable prose. */
export function toText(html: string): string {
  return decodeEntities(
    html
      // Turn block boundaries into spaces so words don't fuse together:
      // "<p>Open</p><p>Mondays</p>" must not become "OpenMondays".
      .replace(/<(br|\/p|\/div|\/li|\/tr|\/h[1-6])\b[^>]*>/gi, '\n')
      .replace(/<[^>]*>/g, ' '),
  )
    // The escape is deliberate: sites are full of literal non-breaking
    // spaces, and left alone they survive into the stored text and quietly
    // break word matching in search.
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function truncateOnWordBoundary(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

export function extractTitle(html: string): string | null {
  const m = /<title\b[^>]*>([\s\S]{0,300}?)<\/title\s*>/i.exec(html);
  const text = m?.[1] ? toText(m[1]) : '';
  return text.length > 0 ? truncateOnWordBoundary(text, 300) : null;
}

export function extractMetaDescription(html: string): string | null {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/\bname\s*=\s*("description"|'description'|description(?=[\s/>]))/i.test(tag)) continue;
    const content = /\bcontent\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/i.exec(tag);
    const value = content?.[2] ?? content?.[3] ?? content?.[4];
    if (value) {
      const text = toText(value);
      return text.length > 0 ? truncateOnWordBoundary(text, 500) : null;
    }
  }
  return null;
}

/**
 * Split a page into heading-led sections.
 *
 * Headings are the author's own structure, and on a small-business site they
 * are almost always the questions a visitor is asking - "Opening hours", "What
 * we charge", "Where to find us". Chunking on them produces units that already
 * look like answers, which is why this beats fixed-size splitting for the shape
 * of content we care about.
 */
export function extractSections(html: string): ExtractedSection[] {
  let body = html;
  for (const tag of STRIPPED_ELEMENTS) body = stripElement(body, tag);

  // Remove comments (can contain markup that confuses the split).
  body = body.replace(/<!--[\s\S]*?-->/g, ' ');

  const sections: ExtractedSection[] = [];
  const headingRe = /<h([1-6])\b[^>]*>([\s\S]{0,300}?)<\/h\1\s*>/gi;

  let lastIndex = 0;
  let pendingHeading: string | null = null;

  const push = (heading: string | null, rawHtml: string) => {
    if (sections.length >= MAX_SECTIONS_PER_PAGE) return;
    const content = toText(rawHtml);
    if (content.length < MIN_SECTION_CHARS) return;
    sections.push({
      heading,
      content: truncateOnWordBoundary(content, MAX_SECTION_CHARS),
    });
  };

  for (const match of body.matchAll(headingRe)) {
    const index = match.index ?? 0;
    push(pendingHeading, body.slice(lastIndex, index));
    pendingHeading = toText(match[2] ?? '') || null;
    lastIndex = index + match[0].length;
  }
  push(pendingHeading, body.slice(lastIndex));

  // A page with no headings at all still has content worth keeping.
  if (sections.length === 0) {
    const whole = toText(body);
    if (whole.length >= MIN_SECTION_CHARS) {
      sections.push({ heading: null, content: truncateOnWordBoundary(whole, MAX_SECTION_CHARS) });
    }
  }

  return sections;
}

/**
 * Same-origin links, absolute and de-duplicated.
 *
 * Same-origin only: we are entitled to read *this* site because the business
 * proved they control it. That entitlement does not extend one hop outward, so
 * the crawler must never follow a link off the verified domain.
 */
export function extractLinks(html: string, base: URL, limit = 100): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
    if (out.length >= limit) break;
    const raw = match[2] ?? match[3] ?? match[4];
    if (!raw) continue;

    const href = decodeEntities(raw).trim();
    if (!href || href.startsWith('#')) continue;
    // Skip anything that is not a page: mailto, tel, javascript, data.
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) && !/^https?:/i.test(href)) continue;

    let resolved: URL;
    try {
      resolved = new URL(href, base);
    } catch {
      continue;
    }
    if (resolved.origin !== base.origin) continue;
    if (!/^https?:$/.test(resolved.protocol)) continue;
    // Obvious non-content: assets and downloads.
    if (/\.(png|jpe?g|gif|svg|webp|ico|css|js|pdf|zip|mp4|mp3|woff2?)$/i.test(resolved.pathname)) {
      continue;
    }

    // Fragments address the same page; the query usually does not, but keeping
    // it invites crawling a thousand filter permutations of one listing page.
    resolved.hash = '';
    resolved.search = '';
    const key = resolved.toString().replace(/\/$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(resolved.toString());
  }

  return out;
}

export function extractPage(html: string, url: URL): ExtractedPage {
  return {
    title: extractTitle(html),
    description: extractMetaDescription(html),
    sections: extractSections(html),
    links: extractLinks(html, url),
  };
}
