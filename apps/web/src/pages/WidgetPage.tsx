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

interface Insights {
  gaps: Array<{ question: string; askedAt: string; timesAsked: number }>;
  recent: Array<{ question: string; confidence: string; askedAt: string }>;
  totals: { asked: number; answered: number; unsure: number; unknown: number };
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
                      className="animate-rise flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      {/* Visitor-authored text. React escapes it; it is never
                          interpolated into markup anywhere. */}
                      <span className="text-sm text-amber-800">{gap.question}</span>
                      {gap.timesAsked > 1 && (
                        <span className="shrink-0 text-xs font-medium text-amber-700">
                          asked {gap.timesAsked}×
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/dashboard/knowledge"
                  className="mt-3 inline-block text-sm font-medium text-brand-700 underline"
                >
                  Add answers for these
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

      <p className="text-xs text-ink-500">
        Business ID <code className="text-ink-600">{businessId}</code> — this is not a secret, it is
        in the snippet on your public page. What protects your receptionist is the list of websites
        you have verified, not this value.
      </p>
    </div>
  );
}
