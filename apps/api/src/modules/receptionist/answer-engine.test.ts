import { describe, expect, it } from 'vitest';
import {
  CONFIDENT_RANK,
  DONT_KNOW_TEXT,
  RELEVANCE_FLOOR,
  RetrievalAnswerEngine,
  type RetrievedPassage,
} from './answer-engine.js';

/**
 * The guarantee under test: the receptionist never says anything the owner did
 * not write. A confidently wrong answer is the failure that costs a business a
 * customer, so every ambiguous case must resolve towards admitting ignorance.
 */

const engine = new RetrievalAnswerEngine();

const passage = (over: Partial<RetrievedPassage> = {}): RetrievedPassage => ({
  id: 'p1',
  question: 'What are your opening hours?',
  content: 'We are open Monday to Friday, 9am to 5:30pm.',
  sourceTitle: 'Written by you',
  sourceUrl: null,
  rank: 0.3,
  ...over,
});

describe('when nothing matches', () => {
  it('admits it does not know', async () => {
    const answer = await engine.answer('do you sell bicycles', []);
    expect(answer.confidence).toBe('unknown');
    expect(answer.text).toBe(DONT_KNOW_TEXT);
    expect(answer.citations).toEqual([]);
  });

  it('treats a below-floor match as no match at all', async () => {
    // One incidental word in common is exactly the input that produces a
    // confidently irrelevant answer.
    const answer = await engine.answer('q', [passage({ rank: RELEVANCE_FLOOR })]);
    expect(answer.confidence).toBe('unknown');
    expect(answer.text).toBe(DONT_KNOW_TEXT);
  });

  it('never invents text when it does not know', async () => {
    const answer = await engine.answer('anything at all', []);
    // The reply must be the fixed sentence, not a generated one.
    expect(answer.text).toBe(DONT_KNOW_TEXT);
  });
});

describe('when one passage clearly wins', () => {
  it("returns the owner's words verbatim", async () => {
    const p = passage({ rank: 0.4 });
    const answer = await engine.answer('when do you close', [p]);
    expect(answer.confidence).toBe('answered');
    // Verbatim: a retrieved sentence is either what the owner wrote or it is
    // not returned. No rephrasing means no room to invent.
    expect(answer.text).toBe(p.content);
  });

  it('cites where the answer came from', async () => {
    const answer = await engine.answer('hours', [passage({ sourceUrl: 'https://x.test/about' })]);
    expect(answer.citations).toEqual([
      { id: 'p1', title: 'What are your opening hours?', url: 'https://x.test/about' },
    ]);
  });

  it('falls back to the source title when the item has no question', async () => {
    const answer = await engine.answer('hours', [passage({ question: null })]);
    expect(answer.citations[0]?.title).toBe('Written by you');
  });
});

describe('when the match is marginal', () => {
  it('hedges rather than asserting', async () => {
    const answer = await engine.answer('parking', [passage({ rank: 0.06 })]);
    expect(answer.confidence).toBe('unsure');
    expect(answer.text).toMatch(/not certain/i);
    // The owner's words still appear - the hedge is a preface, not a rewrite.
    expect(answer.text).toContain('We are open Monday to Friday');
  });

  it('hedges when two passages are nearly tied, even if the top rank is high', async () => {
    // A near-tie means retrieval could not decide. Answering in a confident
    // voice there is how a visitor gets told the wrong one of two things.
    const answer = await engine.answer('prices', [
      passage({ id: 'a', rank: 0.5 }),
      passage({ id: 'b', rank: 0.495, content: 'A different answer entirely.' }),
    ]);
    expect(answer.confidence).toBe('unsure');
  });

  it('is confident when the winner is clear of the runner-up', async () => {
    const answer = await engine.answer('prices', [
      passage({ id: 'a', rank: 0.5 }),
      passage({ id: 'b', rank: 0.2 }),
    ]);
    expect(answer.confidence).toBe('answered');
  });

  it('phrases the hedge as its own uncertainty, not the visitor’s fault', async () => {
    const answer = await engine.answer('vague', [passage({ rank: 0.06 })]);
    expect(answer.text).not.toMatch(/your question|unclear|invalid/i);
  });
});

describe('citations', () => {
  it('returns at most three, so the UI is not buried', async () => {
    const answer = await engine.answer('hours', [
      passage({ id: 'a', rank: 0.5 }),
      passage({ id: 'b', rank: 0.4 }),
      passage({ id: 'c', rank: 0.3 }),
      passage({ id: 'd', rank: 0.2 }),
    ]);
    expect(answer.citations).toHaveLength(3);
  });

  it('never cites a passage that was filtered out as irrelevant', async () => {
    const answer = await engine.answer('hours', [
      passage({ id: 'good', rank: 0.5 }),
      passage({ id: 'noise', rank: 0.001 }),
    ]);
    expect(answer.citations.map((c) => c.id)).toEqual(['good']);
  });
});

describe('thresholds', () => {
  it('keeps the confident bar above the relevance floor', () => {
    // If these ever crossed, every relevant hit would be "confident" and the
    // hedge would become unreachable.
    expect(CONFIDENT_RANK).toBeGreaterThan(RELEVANCE_FLOOR);
  });
});

describe('when retrieval had to broaden', () => {
  // Broadened retrieval matches ANY term rather than all of them, so a hit can
  // score highly on one incidental word. Its rank carries no information about
  // relevance, and presenting it as found is exactly the invention this whole
  // design exists to prevent.
  it('never says "answered", however high the rank', async () => {
    const answer = await engine.answer('do you sell saturday bicycles', [passage({ rank: 0.9 })], {
      broadened: true,
    });
    expect(answer.confidence).toBe('unsure');
    expect(answer.text).toMatch(/not certain/i);
  });

  it('still answers confidently when retrieval did not need to broaden', async () => {
    const answer = await engine.answer('hours', [passage({ rank: 0.9 })], { broadened: false });
    expect(answer.confidence).toBe('answered');
  });

  it('still admits ignorance when a broadened search found nothing usable', async () => {
    const answer = await engine.answer('anything', [], { broadened: true });
    expect(answer.confidence).toBe('unknown');
    expect(answer.text).toBe(DONT_KNOW_TEXT);
  });
});

describe('citation urls', () => {
  it('hides the internal sentinel used for owner-written answers', async () => {
    // `internal:owner-authored` is a storage key, not a link. Passing it to a
    // visitor-facing surface would leak the product's own plumbing.
    const answer = await engine.answer('hours', [
      passage({ sourceUrl: 'internal:owner-authored' }),
    ]);
    expect(answer.citations[0]?.url).toBeNull();
  });

  it('keeps a real page url', async () => {
    const answer = await engine.answer('hours', [passage({ sourceUrl: 'https://x.test/about' })]);
    expect(answer.citations[0]?.url).toBe('https://x.test/about');
  });

  it('drops any non-http scheme', async () => {
    for (const url of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd']) {
      const answer = await engine.answer('hours', [passage({ sourceUrl: url })]);
      expect(answer.citations[0]?.url).toBeNull();
    }
  });
});
