import { describe, expect, it } from 'vitest';
import { clusterGaps, type GapRow } from './gap-clustering.js';

const AT = new Date('2026-10-20T10:00:00Z');

const gap = (question: string, timesAsked = 1, askedAt = AT): GapRow => ({
  question,
  timesAsked,
  askedAt,
});

const headlines = (rows: GapRow[]) => clusterGaps(rows).map((c) => c.question);

describe('clusterGaps', () => {
  it('merges the same question asked in the singular and the plural', () => {
    // The single most common way one question gets typed twice.
    const clusters = clusterGaps([gap('do you take cards', 4), gap('do you take card', 1)]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]?.timesAsked).toBe(5);
  });

  it('refuses to merge two questions that merely look alike', () => {
    // The expensive failure. One answer written for both would have the
    // receptionist confidently quoting the filling price for a crown.
    expect(
      headlines([gap('how much is a filling'), gap('how much is a crown')]),
    ).toHaveLength(2);
  });

  it('keeps unrelated questions apart', () => {
    expect(
      headlines([
        gap('what time do you open'),
        gap('do you take nhs patients'),
        gap('where do i park'),
      ]),
    ).toHaveLength(3);
  });

  it('headlines the cluster with the phrasing the most people typed', () => {
    // Never a generated "canonical" question. One nobody asked is an
    // invention even when it reads better than the ones they did.
    const clusters = clusterGaps([
      gap('do you take card', 1),
      gap('do you take cards', 7),
    ]);
    expect(clusters[0]?.question).toBe('do you take cards');
  });

  it('shows every phrasing rather than summarising them away', () => {
    const clusters = clusterGaps([gap('do you take cards', 7), gap('do you take card', 1)]);
    expect(clusters[0]?.phrasings).toEqual([
      { question: 'do you take cards', timesAsked: 7 },
      { question: 'do you take card', timesAsked: 1 },
    ]);
  });

  it('puts the question the most people could not get answered first', () => {
    const clusters = clusterGaps([
      gap('where do i park', 1),
      gap('what time do you open', 9),
      gap('do you take nhs patients', 4),
    ]);
    expect(clusters.map((c) => c.question)).toEqual([
      'what time do you open',
      'do you take nhs patients',
      'where do i park',
    ]);
  });

  it('carries the most recent time anybody asked', () => {
    const older = new Date('2026-10-01T10:00:00Z');
    const newer = new Date('2026-10-24T10:00:00Z');
    const clusters = clusterGaps([
      gap('do you take cards', 5, older),
      gap('do you take card', 1, newer),
    ]);
    expect(clusters[0]?.askedAt).toEqual(newer);
  });

  it('does not let a cluster drift from member to member', () => {
    /**
     * The chain that a growing cluster would follow:
     *
     *   {nhs, appointment}             the first cluster
     *   {nhs, appointment, children}   0.67 against it — joins, correctly
     *   {appointment, children}        0.33 against it — must NOT join
     *
     * If the cluster's vocabulary grew as members joined, the third would
     * score 0.67 against the widened set and be pulled in through the second.
     * "Do you do NHS appointments" and "do you see children" would then share
     * one answer, and whichever one got written would be wrong for the other.
     *
     * The arithmetic is spelled out because this test passed against a
     * version that DID widen the set — the first phrasings chosen for it did
     * not actually reach the threshold, so it guarded nothing.
     */
    const clusters = clusterGaps([
      gap('nhs appointments', 5),
      gap('nhs appointments for children', 3),
      gap('appointments for children', 1),
    ]);
    expect(clusters.length).toBeGreaterThan(1);
  });

  it('is not confused by punctuation or capitals', () => {
    const clusters = clusterGaps([gap('Do you take cards?', 2), gap('do you take cards', 1)]);
    expect(clusters).toHaveLength(1);
  });

  it('keeps an apostrophe word in one piece', () => {
    // "don't" must not become the tokens "don" and "t", which would match
    // any other contraction.
    expect(headlines([gap("don't you open sundays"), gap("can't i park here")])).toHaveLength(2);
  });

  it('never piles up questions that are nothing but filler', () => {
    // Someone typed "do you?". With no subject matter left there is nothing
    // to match on, and matching them to each other would make one
    // meaningless row out of several unrelated ones.
    const clusters = clusterGaps([gap('do you'), gap('is it'), gap('can we')]);
    expect(clusters).toHaveLength(3);
  });

  it('does not depend on the order the rows arrive in', () => {
    const rows = [
      gap('what time do you open', 3),
      gap('do you take cards', 3),
      gap('what time do you open on saturday', 1),
    ];
    expect(headlines(rows)).toEqual(headlines([...rows].reverse()));
  });

  it('returns nothing for nothing', () => {
    expect(clusterGaps([])).toEqual([]);
  });

  it('leaves a single gap alone', () => {
    const clusters = clusterGaps([gap('where do i park', 2)]);
    expect(clusters).toEqual([
      {
        question: 'where do i park',
        phrasings: [{ question: 'where do i park', timesAsked: 2 }],
        timesAsked: 2,
        askedAt: AT,
      },
    ]);
  });
});
