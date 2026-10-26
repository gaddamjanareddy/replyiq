import { useState } from 'react';
import { useGaps, useAnswerGap } from '../../hooks/useGaps';
import type { GapCluster } from '../../api/gaps';
import { getErrorCopy } from '../../api/client';
import type { ErrorCopy } from '../../api/error-copy';
import { Card, CardBody, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ErrorBanner } from '../ui/Banner';
import { Input } from '../ui/Input';
import { pluralize } from '../../lib/plural';
import { relativeTime } from '../../lib/relative-time';

/**
 * The questions your customers asked that you have not answered.
 *
 * ── Why it sits at the top of the knowledge page ─────────────────────────
 * It was a read-only list on the install page, and a link that threw the
 * owner onto this page with a dialog open. That is four steps and a lost
 * place in the list, repeated for every gap — so in practice the list was
 * read and not worked through.
 *
 * It belongs here because this is the page that saves answers. Above the
 * answers rather than below them, because a list of real questions somebody
 * asked is a better thing to write next than anything the owner would think
 * of unprompted — which is the whole claim of this part of the product: the
 * knowledge base grows from demand instead of imagination.
 *
 * ── What the grouping is not allowed to hide ─────────────────────────────
 * One row can stand for several phrasings, and the owner is about to write a
 * single answer for all of them. So every phrasing is shown the moment the
 * composer opens, and the count of people is reported next to the count of
 * rows. A grouping that made the problem look smaller than it is would be
 * worse than no grouping.
 */
export function GapList({ businessId }: { businessId: string | undefined }) {
  const { data, isLoading } = useGaps(businessId);
  const answer = useAnswerGap(businessId);
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);

  // Silent while loading and silent when empty. An empty to-do list is not
  // news — the page below it is already the answer to "what does it know?"
  // — and a skeleton above the real content makes the page jump.
  if (isLoading || !data || data.clusters.length === 0) return null;

  const { clusters, totalAsked } = data;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-title text-sm font-semibold text-ink-900">
            Asked, and not answered
          </h2>
          {/* Not `pluralize`, which would render "4 to writes". The noun
              here is the number itself. */}
          <Badge variant="warning">
            {clusters.length} to write
            {totalAsked > clusters.length ? ` · ${pluralize(totalAsked, 'person', 'people')}` : ''}
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="max-w-prose text-sm text-ink-600">
          Real questions from your website, in the words people used. Answer one and your
          receptionist starts using it straight away.
        </p>

        <ul className="stagger space-y-2">
          {clusters.map((cluster) => (
            <GapRow
              key={cluster.question}
              cluster={cluster}
              open={openQuestion === cluster.question}
              busy={answer.isPending}
              onOpen={() => setOpenQuestion(cluster.question)}
              onCancel={() => setOpenQuestion(null)}
              onSave={async (question, text) => {
                await answer.mutateAsync({
                  question,
                  answer: text,
                  phrasings: cluster.phrasings.map((p) => p.question),
                });
                setOpenQuestion(null);
              }}
            />
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

function GapRow({
  cluster,
  open,
  busy,
  onOpen,
  onCancel,
  onSave,
}: {
  cluster: GapCluster;
  open: boolean;
  busy: boolean;
  onOpen: () => void;
  onCancel: () => void;
  onSave: (question: string, answer: string) => Promise<void>;
}) {
  /**
   * The heading starts as the visitor's own words and is editable.
   *
   * They typed it in a hurry and the owner knows better than we do what was
   * really being asked. What is NOT editable is the list of phrasings below:
   * those are other people's words and they are the record of what this
   * answer is about to cover.
   */
  const [question, setQuestion] = useState(cluster.question);
  const [text, setText] = useState('');
  const [error, setError] = useState<ErrorCopy | null>(null);

  const others = cluster.phrasings.filter((p) => p.question !== cluster.question);

  const save = async () => {
    setError(null);
    try {
      await onSave(question.trim(), text.trim());
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  return (
    <li className="animate-rise rounded-card border border-amber-200 bg-amber-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Visitor-authored. React escapes it. */}
          <p className="text-sm font-medium text-amber-900">{cluster.question}</p>
          {/* `relativeTime` already returns a phrase — "yesterday", "3 hours
              ago" — so prefixing it with "last" produced "last yesterday".
              Asked once, there is no "most recently" to report either. */}
          <p className="mt-0.5 text-xs text-amber-700">
            {cluster.timesAsked === 1
              ? `Asked ${relativeTime(cluster.askedAt)}`
              : `Asked ${cluster.timesAsked} times, most recently ${relativeTime(cluster.askedAt)}`}
          </p>
        </div>
        {!open && (
          <Button size="sm" variant="secondary" onClick={onOpen}>
            Answer this
          </Button>
        )}
      </div>

      {open && (
        /* The composer sits on `surface`, not on the amber.
           Every form token in the product — label, hint, input border,
           placeholder — is paired against the normal surface and checked
           there. Putting them on a tinted panel means re-deciding all of it
           for both themes, for a box that is a form, not an alert. */
        <div className="mt-3 space-y-3 rounded-lg border border-ink-200 bg-surface p-3">
          {others.length > 0 && (
            /* Shown before the box, not after it. The owner is about to write
               one answer for all of these, and finding out afterwards what it
               was applied to is finding out too late. */
            <div>
              <p className="text-xs font-semibold text-ink-700">
                Also asked as, and covered by this answer:
              </p>
              <ul className="mt-1 space-y-0.5">
                {others.map((p) => (
                  <li key={p.question} className="text-xs text-ink-600">
                    “{p.question}”
                    {p.timesAsked > 1 ? ` · asked ${p.timesAsked} times` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Input
            label="The question, as you would put it"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            hint="This is what they typed. Tidy it up if it helps."
          />

          <div>
            <label
              htmlFor={`answer-${cluster.question}`}
              className="mb-1.5 block text-sm font-medium text-ink-700"
            >
              How should we answer?
            </label>
            <textarea
              id={`answer-${cluster.question}`}
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Answer it the way you would on the phone."
              className="w-full rounded-lg border border-ink-300 bg-surface px-3 py-2 text-sm text-ink-900 placeholder:text-ink-500 hover:border-ink-400"
            />
            <p className="mt-1.5 text-xs text-ink-500">
              Your receptionist returns this word for word, so write it the way you want it
              read out.
            </p>
          </div>

          {error && <ErrorBanner copy={error} />}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              // Empty answers are refused here rather than by the server, so
              // the owner is not told off by a round trip for something the
              // page could see. The server validates too.
              disabled={busy || text.trim().length === 0 || question.trim().length < 3}
              loading={busy}
              loadingLabel="Saving…"
              onClick={() => void save()}
            >
              Save and clear this
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={onCancel}>
              Not now
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}
