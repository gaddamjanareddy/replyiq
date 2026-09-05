import { describe, it, expect } from 'vitest';
import {
  decodeEntities,
  extractLinks,
  extractMetaDescription,
  extractPage,
  extractSections,
  extractTitle,
  toText,
} from './html-extract.js';

const BASE = new URL('https://harbourdental.com/');

describe('toText', () => {
  it('strips tags and collapses whitespace', () => {
    expect(toText('<p>  Open   <b>Monday</b> to Friday </p>')).toBe('Open Monday to Friday');
  });

  it('does not fuse words across block boundaries', () => {
    // "<p>Open</p><p>Mondays</p>" must not become "OpenMondays" - that would
    // silently corrupt every multi-paragraph page into nonsense.
    expect(toText('<p>Open</p><p>Mondays</p>')).toBe('Open\nMondays');
    expect(toText('<li>Fillings</li><li>Crowns</li>')).toBe('Fillings\nCrowns');
    expect(toText('First<br>Second')).toBe('First\nSecond');
  });

  it('decodes the entities that matter for readable text', () => {
    expect(toText('<p>Mon&nbsp;&amp;&nbsp;Tue &lt;9am&gt;</p>')).toBe('Mon & Tue <9am>');
    expect(decodeEntities('&#39;quoted&#39; &#x2014; dash')).toBe("'quoted' — dash");
  });

  it('ignores malformed numeric entities rather than throwing', () => {
    expect(() => decodeEntities('&#999999999; &#x1FFFFFF;')).not.toThrow();
  });
});

describe('extractTitle', () => {
  it('reads the document title', () => {
    expect(extractTitle('<html><head><title>Harbour Dental</title></head></html>')).toBe(
      'Harbour Dental',
    );
  });

  it('returns null when there is none, or it is empty', () => {
    expect(extractTitle('<html><head></head></html>')).toBeNull();
    expect(extractTitle('<title>   </title>')).toBeNull();
  });
});

describe('extractMetaDescription', () => {
  it('reads the description across quoting styles', () => {
    expect(extractMetaDescription('<meta name="description" content="Family dentist">')).toBe(
      'Family dentist',
    );
    expect(extractMetaDescription("<meta content='Family dentist' name='description'>")).toBe(
      'Family dentist',
    );
  });

  it('does not match a different meta whose name merely starts the same', () => {
    expect(
      extractMetaDescription('<meta name="description-og" content="wrong">'),
    ).toBeNull();
  });
});

describe('extractSections', () => {
  const body = (inner: string) => `<html><body>${inner}</body></html>`;

  it('splits on headings and keeps the text beneath each', () => {
    const html = body(`
      <h2>Opening hours</h2>
      <p>We are open Monday to Friday, nine until five, and Saturday mornings.</p>
      <h2>Where to find us</h2>
      <p>Twelve Harbour Road, right opposite the ferry terminal in the old town.</p>
    `);
    const sections = extractSections(html);
    expect(sections.map((s) => s.heading)).toEqual(['Opening hours', 'Where to find us']);
    expect(sections[0]?.content).toContain('Monday to Friday');
    expect(sections[1]?.content).toContain('Harbour Road');
  });

  it('drops navigation, headers, footers, scripts and styles', () => {
    // These repeat on every page. Including them would make every page look
    // alike to a ranker and bury the content that actually differs.
    const html = body(`
      <nav><a href="/">Home</a><a href="/about">About us and our practice</a></nav>
      <header>Harbour Dental — the friendly practice on the harbour front</header>
      <script>var tracking = "should never appear in knowledge";</script>
      <style>.x { color: red; content: "styling text"; }</style>
      <h2>Our treatments</h2>
      <p>Check-ups, hygienist appointments, fillings, crowns and emergency care.</p>
      <footer>Copyright Harbour Dental, all rights reserved, registered in England</footer>
    `);
    const joined = extractSections(html).map((s) => `${s.heading} ${s.content}`).join(' ');
    expect(joined).toContain('hygienist');
    for (const noise of ['tracking', 'styling text', 'all rights reserved', 'About us and our practice']) {
      expect(joined).not.toContain(noise);
    }
  });

  it('discards sections too short to be knowledge', () => {
    const sections = extractSections(body('<h2>Hi</h2><p>Hello.</p>'));
    expect(sections).toEqual([]);
  });

  it('keeps a page that has content but no headings', () => {
    const html = body(
      '<p>We are a family dental practice on the harbour, established in 2004 and still going.</p>',
    );
    const sections = extractSections(html);
    expect(sections).toHaveLength(1);
    expect(sections[0]?.heading).toBeNull();
    expect(sections[0]?.content).toContain('family dental practice');
  });

  it('truncates a very long section on a word boundary', () => {
    const long = 'word '.repeat(1200);
    const sections = extractSections(body(`<h2>Terms</h2><p>${long}</p>`));
    const content = sections[0]?.content ?? '';
    expect(content.length).toBeLessThanOrEqual(2001);
    expect(content.endsWith('…')).toBe(true);
    // Cut on a boundary, not mid-word.
    expect(content).not.toMatch(/wo…$/);
  });

  it('caps how much it will take from one page', () => {
    const many = Array.from(
      { length: 60 },
      (_, i) => `<h2>Section ${i}</h2><p>${'content '.repeat(20)}</p>`,
    ).join('');
    expect(extractSections(body(many)).length).toBeLessThanOrEqual(25);
  });

  it('survives hostile input without hanging', () => {
    // Linear-time patterns only: nested quantifiers here would backtrack
    // catastrophically and hang the ingestion worker on a malicious page.
    const nasty = '<div '.repeat(5000) + 'a'.repeat(20000) + '</div>'.repeat(5000);
    const start = Date.now();
    expect(() => extractSections(nasty)).not.toThrow();
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('handles unterminated tags and stray angle brackets', () => {
    expect(() => extractSections('<h2>Unclosed<p>text <div <span')).not.toThrow();
    expect(() => extractSections('<<<>>><h2></h2')).not.toThrow();
  });
});

describe('extractLinks', () => {
  it('returns absolute, de-duplicated, same-origin page links', () => {
    const html = `
      <a href="/about">About</a>
      <a href="/about/">About again</a>
      <a href="https://harbourdental.com/prices">Prices</a>
      <a href="contact">Contact</a>
    `;
    const links = extractLinks(html, BASE);
    expect(links).toContain('https://harbourdental.com/about');
    expect(links).toContain('https://harbourdental.com/prices');
    expect(links).toContain('https://harbourdental.com/contact');
    // "/about" and "/about/" are the same page.
    expect(links.filter((l) => l.includes('/about')).length).toBe(1);
  });

  it('never follows a link off the verified domain', () => {
    // The entitlement to crawl comes from THIS business proving it controls
    // THIS domain. It does not extend one hop outward.
    const html = `
      <a href="https://evil.example/steal">Elsewhere</a>
      <a href="//cdn.other.com/x">Protocol relative</a>
      <a href="https://harbourdental.com.evil.com/">Lookalike</a>
      <a href="/legitimate">Ours</a>
    `;
    expect(extractLinks(html, BASE)).toEqual(['https://harbourdental.com/legitimate']);
  });

  it('skips non-page schemes and asset files', () => {
    const html = `
      <a href="mailto:hi@harbourdental.com">Email</a>
      <a href="tel:+441234567890">Call</a>
      <a href="javascript:alert(1)">XSS</a>
      <a href="/brochure.pdf">Brochure</a>
      <a href="/logo.png">Logo</a>
      <a href="#main">Skip</a>
      <a href="/real-page">Real</a>
    `;
    expect(extractLinks(html, BASE)).toEqual(['https://harbourdental.com/real-page']);
  });

  it('drops the query string so one listing page is not crawled a hundred times', () => {
    const html = `
      <a href="/treatments?filter=a">A</a>
      <a href="/treatments?filter=b">B</a>
      <a href="/treatments?filter=c">C</a>
    `;
    expect(extractLinks(html, BASE)).toEqual(['https://harbourdental.com/treatments']);
  });

  it('respects the limit', () => {
    const html = Array.from({ length: 300 }, (_, i) => `<a href="/p${i}">x</a>`).join('');
    expect(extractLinks(html, BASE, 10)).toHaveLength(10);
  });

  it('ignores unparseable hrefs rather than throwing', () => {
    expect(() => extractLinks('<a href="http://[not a url">x</a>', BASE)).not.toThrow();
  });
});

describe('extractPage', () => {
  it('assembles a realistic page into something answerable', () => {
    const html = `
      <html><head>
        <title>Harbour Dental — Family dentistry in the old town</title>
        <meta name="description" content="NHS and private dental care since 2004.">
      </head><body>
        <nav><a href="/">Home</a></nav>
        <h1>Welcome to Harbour Dental</h1>
        <p>We have looked after families on the harbour front since 2004.</p>
        <h2>Opening hours</h2>
        <p>Monday to Friday, 9am until 5pm. Saturday mornings by appointment only.</p>
        <a href="/prices">Our prices</a>
      </body></html>
    `;
    const page = extractPage(html, BASE);

    expect(page.title).toContain('Harbour Dental');
    expect(page.description).toContain('since 2004');
    expect(page.links).toContain('https://harbourdental.com/prices');

    // The heading-led chunks are the point: "Opening hours" is already the
    // shape of a question a visitor would ask.
    const hours = page.sections.find((s) => s.heading === 'Opening hours');
    expect(hours?.content).toContain('9am until 5pm');
  });
});
