import { describe, expect, it } from 'vitest';
import { classifyContact, cleanOptionalText, MAX_CONTACT_LENGTH } from './lead-capture.js';

/**
 * These tests are weighted the way the product is: there are far more cases
 * asserting that a real contact detail is ACCEPTED than that junk is refused,
 * because a refused real number is a lost customer and accepted junk is an
 * annoyance.
 */
describe('classifyContact', () => {
  describe('phone numbers people actually type', () => {
    // The target market is India, so these are the formats to get right.
    it.each([
      ['9876543210', 'a bare Indian mobile'],
      ['+919876543210', 'E.164'],
      ['+91 98765 43210', 'E.164 with spaces'],
      ['+91-98765-43210', 'hyphenated'],
      ['098765 43210', 'with a trunk prefix'],
      ['(040) 2345 6789', 'a landline with an area code in brackets'],
      ['+1 (555) 010-9999', 'a US number'],
      ['98765.43210', 'dots, which some people use'],
    ])('accepts %s (%s)', (input) => {
      expect(classifyContact(input)).toEqual({ kind: 'PHONE', value: input });
    });

    it('keeps what was typed rather than a normalised form', () => {
      // The owner recognising the number matters more than it being tidy.
      const typed = '+91 98765 43210';
      expect(classifyContact(typed)?.value).toBe(typed);
    });

    it('trims surrounding whitespace', () => {
      expect(classifyContact('  9876543210  ')).toEqual({
        kind: 'PHONE',
        value: '9876543210',
      });
    });
  });

  describe('email addresses', () => {
    it.each([
      'priya@gmail.com',
      'PRIYA@Gmail.COM',
      'priya.sharma+clinic@gmail.com',
      'info@harbour-dental.co.in',
      'a@b.io',
    ])('accepts %s', (input) => {
      expect(classifyContact(input)).toEqual({ kind: 'EMAIL', value: input });
    });
  });

  describe('things a person could not be reached on', () => {
    it.each([
      ['', 'empty'],
      ['   ', 'whitespace only'],
      ['asdf', 'keyboard mashing'],
      ['no thanks', 'an answer to a different question'],
      ['1234', 'too few digits to be a number'],
      ['12345678901234567890', 'too many digits to be a number anywhere'],
      ['₹500', 'a price'],
      ['tomorrow', 'a word'],
    ])('refuses %s (%s)', (input) => {
      expect(classifyContact(input)).toBeNull();
    });

    it.each([
      ['priya@gmail', 'no dot in the domain'],
      ['priya@gmail.c', 'a one-letter TLD'],
      ['priya@@gmail.com', 'two @ signs'],
      ['@gmail.com', 'no local part'],
      ['priya@', 'no domain'],
      ['priya @gmail.com', 'a space in the middle'],
      ['priya@.com', 'a leading dot in the domain'],
      ['priya@gmail..com', 'a doubled dot'],
      ['priya@gmail.com.', 'a trailing dot'],
    ])('refuses %s (%s)', (input) => {
      expect(classifyContact(input)).toBeNull();
    });

    /**
     * The reason `@` commits the input to the email branch. Without it this
     * would be judged as a phone number and refused for containing letters,
     * and the visitor would be told their email address is a bad phone
     * number.
     */
    it('judges anything containing @ as an email, however little it looks like one', () => {
      expect(classifyContact('9876543210@')).toBeNull();
      expect(classifyContact('@')).toBeNull();
    });
  });

  it('caps the length at the column width', () => {
    const long = `${'a'.repeat(400)}@gmail.com`;
    // Truncation lands mid-local-part, so there is no @ left in the slice and
    // this is refused. What matters is that nothing longer than the column
    // can be returned.
    const result = classifyContact(long);
    expect(result?.value.length ?? 0).toBeLessThanOrEqual(MAX_CONTACT_LENGTH);
  });
});

describe('cleanOptionalText', () => {
  it('treats blank as absent', () => {
    expect(cleanOptionalText('   ', 10)).toBeNull();
    expect(cleanOptionalText(undefined, 10)).toBeNull();
  });

  it('trims and caps', () => {
    expect(cleanOptionalText('  Priya  ', 120)).toBe('Priya');
    expect(cleanOptionalText('a'.repeat(200), 120)).toHaveLength(120);
  });
});
