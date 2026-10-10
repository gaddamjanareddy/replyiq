import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness, useDomains } from '../hooks/useBusiness';
import { apiFetch, getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { CopyField } from '../components/ui/CopyField';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { PageSkeleton } from '../components/ui/Skeleton';
import { PageHeader } from '../components/layout/PageHeader';

/**
 * Install the receptionist, and try it before you do.
 *
 * The order is deliberate. "Try it" comes FIRST, because pasting a script onto
 * a live customer-facing website is a commitment, and nobody should be asked
 * to make it before they have seen what the thing actually says. Every
 * competitor puts the snippet first and the demo behind a tab.
 */

interface PreviewAnswer {
  confidence: 'answered' | 'unsure' | 'unknown';
  text: string;
  citations: Array<{ id: string; title: string | null; url: string | null }>;
  mode: 'LIVE' | 'TEST';
}

type Verdict = 'GOOD' | 'WRONG' | null;

interface RecentQuestion {
  id: string;
  question: string;
  confidence: string;
  askedAt: string;
  verdict: Verdict;
  /** The knowledge item the answer came from. Null once it is deleted. */
  answeredWith: { id: string; question: string | null; content: string } | null;
}

interface Insights {
  gaps: Array<{ question: string; askedAt: string; timesAsked: number }>;
  recent: RecentQuestion[];
  totals: { asked: number; answered: number; unsure: number; unknown: number };
}

/**
 * One answered question, with the answer and the two buttons.
 *
 * Marking something wrong is only half useful; the other half is doing
 * something about it, so a WRONG verdict reveals a link straight to the item
 * that produced it. Without that, the owner is left with a complaint and no
 * remedy — and the next visitor gets the same answer.
 */
function AnsweredQuestion({
  item,
  onRate,
}: {
  item: RecentQuestion;
  onRate: (verdict: Verdict) => void;
}) {
  const wrong = item.verdict === 'WRONG';
  return (
    <li
      className={`animate-rise rounded-card border p-3 ${
        wrong ? 'border-red-200 bg-red-50' : 'border-ink-200 bg-surface'
      }`}
    >
      {/* Visitor-authored text. React escapes it. */}
      <p className="text-sm font-medium text-ink-900">{item.question}</p>

      {item.answeredWith ? (
        <p className="mt-1.5 line-clamp-3 text-sm text-ink-600">
          <span className="text-ink-600">Answered with: </span>
          {item.answeredWith.content}
        </p>
      ) : (
        <p className="mt-1.5 text-sm text-ink-500">
          The answer came from something that has since been deleted.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-pressed={item.verdict === 'GOOD'}
          onClick={() => onRate('GOOD')}
          className={`interactive rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
            item.verdict === 'GOOD'
              ? 'bg-success-fill text-white ring-success-fill'
              : 'bg-surface text-ink-700 ring-ink-300 hover:bg-ink-50'
          }`}
        >
          Good answer
        </button>
        <button
          type="button"
          aria-pressed={wrong}
          onClick={() => onRate('WRONG')}
          className={`interactive rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${
            wrong
              ? 'bg-danger-fill text-white ring-danger-fill'
              : 'bg-surface text-ink-700 ring-ink-300 hover:bg-ink-50'
          }`}
        >
          That is wrong
        </button>
        {wrong && item.answeredWith && (
          <Link
            to={`/dashboard/knowledge?edit=${item.answeredWith.id}`}
            className="ml-auto text-xs font-semibold text-red-700 underline"
          >
            Fix this answer
          </Link>
        )}
        {wrong && !item.answeredWith && (
          <Link
            to={`/dashboard/knowledge?answer=${encodeURIComponent(item.question)}`}
            className="ml-auto text-xs font-semibold text-red-700 underline"
          >
            Write the right answer
          </Link>
        )}
      </div>
    </li>
  );
}

/** Where the widget script is served from — the dashboard's own origin. */
const widgetSrc = `${window.location.origin}/widget.js`;

export function WidgetPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId;
  const { data: businessData, isLoading } = useBusiness(businessId);
  const { data: domainsData } = useDomains(businessId);

  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<PreviewAnswer | null>(null);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);

  useEffect(() => {
    if (!businessId) return;
    apiFetch<Insights>(`/api/v1/businesses/${businessId}/receptionist/insights`)
      .then(setInsights)
      // A failed insights load must not take the install instructions down
      // with it - the snippet is the reason most people open this page.
      .catch(() => undefined);
  }, [businessId]);

  if (isLoading || !businessData?.business || !businessId) {
    return <PageSkeleton label="Loading your widget" />;
  }

  const verified = (domainsData?.domains ?? []).filter((d) => d.status === 'VERIFIED');
  const liveDomains = verified.filter((d) => !d.isSandbox);

  const snippet = `<script src="${widgetSrc}" data-business-id="${businessId}" defer></script>`;

  /**
   * Only the ones that actually produced an answer.
   *
   * An "I don't know" is already handled by the gap list above, and asking
   * the owner to rate a refusal would be asking the wrong question: the
   * refusal was correct, the missing knowledge is the problem.
   */
  const answeredRecently = (insights?.recent ?? []).filter(
    (item) => item.confidence !== 'unknown',
  );

  const rate = async (item: RecentQuestion, verdict: Verdict) => {
    // Updated locally first: this is a one-tap judgement on a list, and a
    // round trip before the button changes makes it feel broken enough that
    // people tap twice.
    const next = item.verdict === verdict ? null : verdict;
    setInsights((current) =>
      current
        ? {
            ...current,
            recent: current.recent.map((r) => (r.id === item.id ? { ...r, verdict: next } : r)),
          }
        : current,
    );
    try {
      await apiFetch(`/api/v1/businesses/${businessId}/receptionist/questions/${item.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ verdict: next }),
      });
    } catch (err) {
      // Put it back. A rating that silently did not save is worse than one
      // that visibly failed, because the owner believes it was recorded.
      setInsights((current) =>
        current
          ? {
              ...current,
              recent: current.recent.map((r) =>
                r.id === item.id ? { ...r, verdict: item.verdict } : r,
              ),
            }
          : current,
      );
      setError(getErrorCopy(err));
    }
  };

  const handleAsk = async (event: FormEvent) => {
    event.preventDefault();
    const q = question.trim();
    if (!q || asking) return;
    setAsking(true);
    setError(null);
    try {
      setAnswer(
        await apiFetch<PreviewAnswer>(`/api/v1/businesses/${businessId}/receptionist/preview`, {
          method: 'POST',
          body: JSON.stringify({ question: q }),
        }),
      );
    } catch (err) {
      setError(getErrorCopy(err));
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        overline="Go live"
        title="Your receptionist"
        subtitle="Try it here, then add one line to your website when you are happy with it."
      />

      {error && <ErrorBanner copy={error} />}

      {verified.length === 0 && (
        <Banner tone="warning" title="Verify a website first">
          The widget only answers on websites you have verified — that is what stops anyone else
          embedding your receptionist.{' '}
          <Link to="/dashboard/domains" className="font-medium underline">
            Add a website
          </Link>
          .
        </Banner>
      )}

      {verified.length > 0 && liveDomains.length === 0 && (
        <Banner tone="info" title="Test mode">
          Every website you have verified is a test address, so the widget will tell visitors it is
          still being set up. Verify your real website to go live.
        </Banner>
      )}

      {/* Try it first. See the reasoning at the top of this file. */}
      <Card>
        <CardHeader>
          <h2 className="text-title text-sm font-semibold text-ink-900">Try it</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <form onSubmit={handleAsk} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Input
                label="Ask what a customer might ask"
                placeholder="e.g. what time do you close on Saturdays?"
                value={question}
                maxLength={500}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>
            <Button type="submit" loading={asking} loadingLabel="Thinking…" size="lg">
              Ask
            </Button>
          </form>

          {answer && (
            <div
              // Announced, because the answer appears after the fact and a
              // screen-reader user would otherwise have to go looking for it.
              aria-live="polite"
              className={`animate-rise rounded-card border p-4 text-sm ${
                answer.confidence === 'answered'
                  ? 'border-ink-200 bg-ink-50 text-ink-900'
                  : answer.confidence === 'unsure'
                    ? 'border-amber-200 bg-amber-50 text-amber-800'
                    : 'border-ink-200 bg-ink-50 text-ink-700'
              }`}
            >
              <p className="whitespace-pre-wrap">{answer.text}</p>
              {answer.citations.length > 0 && (
                <p className="mt-3 text-xs text-ink-500">
                  From: {answer.citations.map((c) => c.title ?? 'your knowledge').join(', ')}
                </p>
              )}
            </div>
          )}

          {answer?.confidence === 'unknown' && (
            // The most useful thing on this page: a question it could not
            // answer is a gap the owner can close in one click, and saying so
            // turns a dead end into the next action.
            <p className="text-sm text-ink-600">
              That is a gap worth filling —{' '}
              <Link to="/dashboard/knowledge" className="font-medium text-brand-700 underline">
                add an answer for it
              </Link>{' '}
              and it will handle that next time.
            </p>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-title text-sm font-semibold text-ink-900">Add it to your website</h2>
        </CardHeader>
        <CardBody className="space-y-4">
          <p className="text-sm text-ink-600">
            Paste this just before the closing <code>&lt;/body&gt;</code> tag on{' '}
            {liveDomains.length === 1 ? (
              <strong className="font-medium text-ink-900">{liveDomains[0]?.domain}</strong>
            ) : (
              'your website'
            )}
            . It loads on its own and will not slow the page down.
          </p>

          <CopyField label="Install snippet" value={snippet} wrap />

          <ul className="space-y-2 text-sm text-ink-600">
            <li>
              <span className="font-medium text-ink-900">It only works on your sites.</span> The
              widget is refused anywhere other than a website you have verified.
            </li>
            <li>
              <span className="font-medium text-ink-900">It answers from your knowledge only.</span>{' '}
              If it does not know, it says so rather than guessing.
            </li>
            <li>
              <span className="font-medium text-ink-900">Nothing to maintain.</span> Edit your
              answers here and the widget picks them up — the snippet never changes.
            </li>
          </ul>
        </CardBody>
      </Card>

      {insights && insights.totals.asked > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-title text-sm font-semibold text-ink-900">
              What people are asking
            </h2>
          </CardHeader>
          <CardBody className="space-y-5">
            <div className="grid grid-cols-3 gap-3 text-center">
              {[
                { label: 'Asked', value: insights.totals.asked },
                { label: 'Answered', value: insights.totals.answered },
                { label: 'Unanswered', value: insights.totals.unknown },
              ].map((stat) => (
                <div key={stat.label} className="rounded-card border border-ink-200 p-3">
                  <p className="text-display text-2xl font-semibold text-ink-900">{stat.value}</p>
                  <p className="text-overline mt-1 text-xs font-medium text-ink-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>

            {insights.gaps.length > 0 ? (
              <div>
                <h3 className="text-sm font-semibold text-ink-900">
                  Questions it could not answer
                </h3>
                <p className="mt-1 text-sm text-ink-600">
                  Each of these is one answer away from being handled.
                </p>
                <ul className="stagger mt-3 space-y-2">
                  {insights.gaps.map((gap) => (
                    <li
                      key={gap.question}
                      className="animate-rise flex flex-wrap items-center justify-between gap-x-3 gap-y-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      {/* Visitor-authored text. React escapes it; it is never
                          interpolated into markup anywhere. */}
                      <span className="text-sm text-amber-800">{gap.question}</span>
                      <span className="ml-auto flex shrink-0 items-center gap-3">
                        {gap.timesAsked > 1 && (
                          <span className="text-xs font-medium text-amber-700">
                            asked {gap.timesAsked}×
                          </span>
                        )}
                        {/* The whole point of the gap report: one click and
                            this question is answered forever. A link to the
                            knowledge page and "retype it" is where the loop
                            quietly stops being used. */}
                        <Link
                          to={`/dashboard/knowledge?answer=${encodeURIComponent(gap.question)}`}
                          className="interactive rounded-md bg-warn-fill px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90"
                        >
                          Answer this
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard/knowledge"
                  className="mt-3 inline-block text-sm font-medium text-brand-700 underline"
                >
                  See everything it knows
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-600">
                Nothing has gone unanswered yet.
              </p>
            )}
          </CardBody>
        </Card>
      )}

      {answeredRecently.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-title text-sm font-semibold text-ink-900">What it answered</h2>
          </CardHeader>
          <CardBody>
            {/*
              The product's entire claim is that it does not invent. Nothing
              automatic can check that: the answer was the owner's own
              published words returned faithfully, and whether those were the
              RIGHT words for that question is a judgement only they can make.
              So the answer is shown next to the question and they are asked.
            */}
            <p className="text-sm text-ink-600">
              Each of these is a real visitor question and the answer it was given. If one is
              wrong, say so — it is the only way anyone finds out.
            </p>
            <ul className="stagger mt-4 space-y-3">
              {answeredRecently.map((item) => (
                <AnsweredQuestion
                  key={item.id}
                  item={item}
                  onRate={(verdict) => void rate(item, verdict)}
                />
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-ink-500">
        Business ID <code className="text-ink-600">{businessId}</code> — this is not a secret, it is
        in the snippet on your public page. What protects your receptionist is the list of websites
        you have verified, not this value.
      </p>
    </div>
  );
}
