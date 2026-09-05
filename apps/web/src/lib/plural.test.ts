import { describe, expect, it } from 'vitest';
import { pluralize } from './plural';

describe('pluralize', () => {
  it('uses the singular for exactly one', () => {
    expect(pluralize(1, 'answer')).toBe('1 answer');
  });

  it('uses the plural for zero', () => {
    // Zero takes the plural in English - "0 answers", never "0 answer".
    expect(pluralize(0, 'answer')).toBe('0 answers');
  });

  it('uses the plural for more than one', () => {
    expect(pluralize(4, 'answer')).toBe('4 answers');
  });

  it('accepts an irregular plural', () => {
    expect(pluralize(2, 'category', 'categories')).toBe('2 categories');
    expect(pluralize(1, 'category', 'categories')).toBe('1 category');
  });

  it('groups large counts for readability', () => {
    expect(pluralize(1200, 'page')).toBe('1,200 pages');
  });
});
