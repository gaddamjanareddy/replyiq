import { describe, expect, it } from 'vitest';
import { MAX_SUGGESTIONS, pickStarterQuestions } from './starter-questions.js';

const items = (...questions: Array<string | null>) => questions.map((question) => ({ question }));

describe('pickStarterQuestions', () => {
  it('prefers real questions over headings', () => {
    // A crawled site is mostly filing labels. "Do you take NHS patients?" is
    // a thing to ask; "Our Services" is a thing to file under.
    expect(
      pickStarterQuestions(
        items('Our Services', 'Do you take NHS patients?', 'About Us', 'Where are you?'),
      ),
    ).toEqual(['Do you take NHS patients?', 'Where are you?', 'Our Services']);
  });

  it('keeps the owner’s own ordering within each group', () => {
    expect(pickStarterQuestions(items('Second?', 'First?', 'Third?'))).toEqual([
      'Second?',
      'First?',
      'Third?',
    ]);
  });

  it('returns at most three', () => {
    const many = items('A?', 'B?', 'C?', 'D?', 'E?');
    expect(pickStarterQuestions(many)).toHaveLength(MAX_SUGGESTIONS);
  });

  it('skips items with no heading at all', () => {
    // Crawled prose chunks have no question; they are answers, not prompts.
    expect(pickStarterQuestions(items(null, '  ', 'What are your hours?'))).toEqual([
      'What are your hours?',
    ]);
  });

  it('drops anything too long to be a button', () => {
    const essay = `Do you ${'really '.repeat(12)}take patients?`;
    expect(pickStarterQuestions(items(essay, 'Short?'))).toEqual(['Short?']);
  });

  it('de-duplicates regardless of case', () => {
    // A crawl and a hand-written FAQ routinely produce the same question with
    // different capitalisation; offering it twice looks careless.
    expect(
      pickStarterQuestions(items('Do you take NHS patients?', 'do you take nhs patients?')),
    ).toEqual(['Do you take NHS patients?']);
  });

  it('returns nothing for an empty knowledge base rather than inventing', () => {
    // The one case where saying nothing is correct: a suggestion the
    // receptionist cannot answer would be an invention we put in the
    // visitor's mouth.
    expect(pickStarterQuestions([])).toEqual([]);
    expect(pickStarterQuestions(items(null, null))).toEqual([]);
  });

  it('trims surrounding whitespace from a scraped heading', () => {
    expect(pickStarterQuestions(items('  What are your hours?  '))).toEqual([
      'What are your hours?',
    ]);
  });
});
