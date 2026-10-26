import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness, useDomains, useOnboardingProgress } from '../hooks/useBusiness';
import { useReceptionistSummary } from '../hooks/useLeads';
import { Badge, onboardingStatusBadge, serviceModeBadge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/Stepper';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ServiceModeBanner } from '../components/domains/ServiceModeBanner';
import { Banner } from '../components/ui/Banner';
import { pluralize } from '../lib/plural';
import { describeTrend, describeVolume, type TrendTone } from '../lib/trend-copy';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId;

  const { data: businessData, isLoading } = useBusiness(businessId);
  const { data: onboarding } = useOnboardingProgress(businessId);
  const { data: domainsData } = useDomains(businessId);
  /**
   * Error deliberately ignored.
   *
   * These are supporting numbers on the page a user lands on after signing
   * in. A summary that fails must leave the dashboard standing - the tiles
   * simply do not render - rather than replacing the whole first screen of
   * the product with an error about a statistic.
   */
  const { data: summary } = useReceptionistSummary(businessId);

  const business = businessData?.business;
  const domains = domainsData?.domains ?? [];

  if (isLoading || !business) {
    return <PageSkeleton label="Loading your dashboard" />;
  }

  const setupComplete = business.onboardingStatus === 'COMPLETED';
  const steps = onboarding?.steps ?? [];
  const completedSteps = steps.filter((s) => s.completed).length;
  const statusBadge = onboardingStatusBadge(business.onboardingStatus);
  const modeBadge = serviceModeBadge(business.serviceMode);
  const verifiedDomains = domains.filter((d) => d.status === 'VERIFIED');
  /**
   * The comparison against the previous month, where there is an honest one.
   * `describeTrend` returns null text for a business with no history, and the
   * tile falls back to its plain caption rather than showing a placeholder.
   */
  const trend = summary ? describeTrend(summary.trend) : null;

  return (
    /**
     * A bento grid, not a card stack.
     *
     * The previous layout gave the greeting, three statistics and a checklist
     * the same visual weight, so the eye had nowhere to land and everything
     * read as equally unimportant. Hierarchy in a bento comes from SIZE: tiles
     * of identical size are just a card layout with rounded corners.
     *
     * The order encodes what the owner actually needs to know, in order:
     * is it working, what do I do next, and only then the supporting detail.
     */
    <div className="mx-auto max-w-6xl">
      {/* Whether this works right now. Above everything, because it is more
          urgent than a greeting. */}
      {setupComplete && (
        <div className="mb-4 animate-rise">
          <ServiceModeBanner mode={business.serviceMode} context="dashboard" />
        </div>
      )}

      {/*
        Above the greeting too, and above the numbers.

        Somebody left their phone number, the widget promised them a call, and
        the owner was never told. The Enquiries page says so — and that is the
        one page an owner whose email is broken will not open, because the
        thing that would normally send them there is the email that did not
        arrive. This is the only failure in the product that silently costs
        the owner a customer, so it is the only one worth interrupting the
        dashboard for.
      */}
      {summary && summary.undelivered.total > 0 && (
        <div className="mb-4 animate-rise">
          <Banner
            tone="warning"
            title={
              summary.undelivered.anyNotConfigured
                ? 'This workspace cannot send email yet'
                : `We could not email you about ${pluralize(summary.undelivered.total, 'enquiry', 'enquiries')}`
            }
            action={
              <Link to="/dashboard/leads">
                <Button size="sm" variant="secondary">
                  See who is waiting
                </Button>
              </Link>
            }
          >
            {summary.undelivered.anyNotConfigured
              ? 'Every enquiry is saved, but nobody was emailed about them. Until an email sender is set up, this page is the only place you will hear about someone waiting.'
              : 'They are all saved, so nothing is lost — but you were not told at the time, and these people are expecting to hear back.'}
          </Banner>
        </div>
      )}

      <div className="stagger grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* HERO — the widest tile, and the only one with display type. */}
        <Card className="animate-rise lg:col-span-8">
          <CardBody className="sm:p-6">
            <p className="text-overline text-xs font-semibold text-ink-500">
              {setupComplete ? 'Your receptionist' : 'Getting started'}
            </p>
            <h1 className="text-display mt-2 text-2xl font-semibold text-ink-900 sm:text-3xl">
              {greeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}
            </h1>
            <p className="mt-2 max-w-prose text-sm text-ink-600">
              {setupComplete
                ? business.serviceMode === 'LIVE'
                  ? `Your AI receptionist is answering on ${describeDomains(verifiedDomains.length)}.`
                  : 'Setup is complete. See the note above to start answering real visitors.'
                : 'A few steps left before your AI receptionist can start work.'}
            </p>

            {!setupComplete && (
              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-ink-700">
                    Step {Math.min(completedSteps + 1, steps.length || 4)} of {steps.length || 4}
                  </span>
                  <span className="text-ink-500">
                    {steps.find((s) => !s.completed)?.label ?? 'Almost there'}
                  </span>
                </div>
                <ProgressBar completed={completedSteps} total={steps.length || 4} />
                <Link to="/onboarding" className="mt-5 inline-block">
                  <Button size="lg">
                    {completedSteps === 0 ? 'Start setup' : 'Continue setup'}
                  </Button>
                </Link>
              </div>
            )}
          </CardBody>
        </Card>

        {/* STATUS — narrow and tall, carrying the two badges that were
            previously crowded into the hero's top-right corner. Given its own
            tile because "is it live?" is a question, not a decoration. */}
        <Card className="animate-rise lg:col-span-4">
          {/* Content sits at the top and the caption is pushed to the bottom
              with `mt-auto`. Spreading three items with `justify-between`
              left the badge floating in the middle of a tall tile, which
              reads as a layout accident rather than as breathing room. */}
          <CardBody className="flex h-full flex-col sm:p-6">
            <p className="text-overline text-xs font-semibold text-ink-500">Status</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              {setupComplete && (
                // The halo only fires for LIVE. TEST and INACTIVE are states to
                // resolve, not states to celebrate.
                <Badge variant={modeBadge.variant} dot pulse={business.serviceMode === 'LIVE'}>
                  {modeBadge.label}
                </Badge>
              )}
            </div>
            <p className="mt-auto pt-6 text-xs text-ink-500">
              {setupComplete
                ? business.serviceMode === 'LIVE'
                  ? 'Answering real visitors.'
                  : 'Everything works — it just is not answering real visitors yet.'
                : 'Finish setup to bring your receptionist online.'}
            </p>
          </CardBody>
        </Card>

        {/* OUTCOMES — what the receptionist produced, before anything about
            how it is configured.

            This ordering is the point of the page. It previously opened with
            three tiles describing settings the owner typed in themselves:
            their business name, their industry, their website. None of that is
            news. What IS news is that four people asked something and one of
            them left a number. */}
        {summary && summary.leadsWaiting > 0 && (
          <div className="animate-rise lg:col-span-4">
            <StatCard
              label="Waiting for a reply"
              value={String(summary.leadsWaiting)}
              sub={
                summary.leadsWaiting === 1
                  ? 'Somebody asked and left their details'
                  : 'People who asked and left their details'
              }
              to="/dashboard/leads"
              urgent
            />
          </div>
        )}
        {summary && summary.asked > 0 && (
          <div className="animate-rise lg:col-span-4">
            <StatCard
              label="Questions answered"
              value={`${summary.answered} of ${summary.asked}`}
              /* The trend replaces the caption rather than joining it: "In the
                 last 30 days" and "up from 75% last month" say the same thing
                 about the window, and two lines of it reads as padding. */
              sub={trend?.text ?? 'In the last 30 days'}
              tone={trend?.tone ?? 'neutral'}
              to="/dashboard/widget"
            />
          </div>
        )}
        {summary && summary.unanswered > 0 && (
          <div className="animate-rise lg:col-span-4">
            <StatCard
              label="Could not answer"
              value={String(summary.unanswered)}
              /* Volume, not a verdict. A drop in failures means nothing
                 without knowing whether anybody turned up — and this is the
                 tile where that mistake would be made. */
              sub={describeVolume(summary.trend) ?? 'Each one is a short answer away'}
              to="/dashboard/widget"
            />
          </div>
        )}

        {/* SUPPORTING DETAIL — configuration, which is only worth a tile when
            something is missing from it. */}
        <div className="animate-rise lg:col-span-4">
          <StatCard
            label="Verified websites"
            value={String(verifiedDomains.length)}
            sub={
              verifiedDomains.length === 0
                ? 'None yet'
                : verifiedDomains.map((d) => d.domain).join(', ')
            }
            to="/dashboard/domains"
          />
        </div>
        <div className="animate-rise lg:col-span-4">
          <StatCard
            label="Answers it knows"
            value={summary ? String(summary.knowledgeItems) : '—'}
            sub={
              summary && summary.knowledgeItems === 0
                ? 'It cannot answer anything yet'
                : 'From your website and your own edits'
            }
            to="/dashboard/knowledge"
          />
        </div>
        <div className="animate-rise lg:col-span-4">
          <StatCard
            label="Website"
            value={business.websiteUrl ? stripScheme(business.websiteUrl) : 'Not set'}
            sub={business.websiteUrl ? 'From your profile' : 'Add one in settings'}
            to="/dashboard/settings"
          />
        </div>

        <Card className="animate-rise lg:col-span-12">
          <CardHeader>
            <h2 className="text-title text-sm font-semibold text-ink-900">What’s next</h2>
          </CardHeader>
          <CardBody>
            <ul className="space-y-3 text-sm">
              <NextStep
                done={setupComplete}
                title="Finish setup"
                description="Profile and a verified website."
                to="/onboarding"
              />
              <NextStep
                done={Boolean(summary && summary.knowledgeItems > 0)}
                title="Teach it about your business"
                description="Let us read your website, or write the answers yourself."
                to="/dashboard/knowledge"
              />
              <NextStep
                // Nothing proves the snippet is pasted in except traffic
                // arriving, so a question having been asked IS the test. It is
                // also the only honest one: a checklist that ticks itself when
                // the owner visits the install page would claim the widget is
                // live when it is not.
                done={Boolean(summary && summary.asked > 0)}
                title="Add the widget to your site"
                description="One line of code, and your receptionist starts answering."
                to="/dashboard/widget"
              />
              {/* Only once somebody has actually visited. Shown to a brand-new
                  owner it is a task they cannot do, linking to an empty page —
                  a checklist that lists impossible work stops being read. */}
              {summary && summary.asked > 0 && (
                <NextStep
                  done={summary.leadsWaiting === 0}
                  title="Reply to anyone waiting"
                  description="When it cannot answer, it takes their number instead. Those people are expecting to hear back."
                  to="/dashboard/leads"
                />
              )}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  to,
  urgent,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  to?: string;
  /**
   * Colour for the caption, when the caption is a comparison.
   *
   * Only ever decoration: the words already say "up from" or "down from", so
   * an owner who cannot distinguish the two colours loses nothing. Colour
   * carrying information on its own is the oldest accessibility bug there is.
   */
  tone?: TrendTone;
  /**
   * For the one tile that is a person waiting rather than a number.
   *
   * Set larger and tinted, because somebody who asked an hour ago should not
   * be drawn at the same weight as which industry the owner picked. Exactly
   * one tile may be urgent: two competing emphases are none.
   */
  urgent?: boolean;
}) {
  const content = (
    <Card
      className={`${to ? 'interactive hover:shadow-raised hover:-translate-y-px' : ''} ${
        urgent ? 'border-emerald-300 bg-emerald-50/60' : ''
      }`}
    >
      <CardBody>
        <p
          className={`text-xs font-medium uppercase tracking-wide ${
            urgent ? 'text-emerald-800' : 'text-ink-500'
          }`}
        >
          {label}
        </p>
        <p
          className={
            urgent
              ? 'text-display mt-1 text-3xl font-semibold text-emerald-900'
              : 'mt-1 truncate text-sm font-semibold text-ink-900'
          }
        >
          {value}
        </p>
        {/* Clamped to two lines, not truncated to one.
            `truncate` cut the trend comparison mid-word — "up from 69…" —
            which is the most useful sentence on the dashboard and the only
            one the owner cannot reconstruct from the number above it. Two
            lines still contains a long list of domain names, which is what
            the single line was protecting the layout from. */}
        <p
          className={`mt-0.5 line-clamp-2 text-xs ${
            urgent ? 'text-emerald-700' : toneClass(tone)
          }`}
        >
          {sub}
        </p>
      </CardBody>
    </Card>
  );
  return to ? (
    <Link to={to} className="block rounded-card">
      {content}
    </Link>
  ) : (
    content
  );
}

/**
 * The ramp is role-preserving rather than lightness-ordered, and these are
 * the rungs with dark-theme overrides that invert — so they stay readable in
 * both themes without a `dark:` variant. See the comments in `index.css`.
 */
function toneClass(tone?: TrendTone): string {
  if (tone === 'good') return 'text-emerald-700';
  if (tone === 'warn') return 'text-amber-700';
  return 'text-ink-500';
}

function NextStep({
  done,
  title,
  description,
  to,
}: {
  done: boolean;
  title: string;
  description: string;
  to?: string;
}) {
  const body = (
    <>
      <span
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
          done ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-400'
        }`}
        aria-hidden="true"
      >
        {done ? (
          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth="3" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        ) : (
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        )}
      </span>
      <span>
        <span className={`block font-medium ${done ? 'text-ink-500 line-through' : 'text-ink-900'}`}>
          {title}
        </span>
        <span className="block text-ink-600">{description}</span>
      </span>
    </>
  );

  return (
    <li>
      {to && !done ? (
        <Link to={to} className="flex gap-3 rounded-lg p-1 -m-1 hover:bg-ink-50">
          {body}
        </Link>
      ) : (
        <span className="flex gap-3">{body}</span>
      )}
    </li>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function describeDomains(count: number): string {
  return count === 1 ? 'your website' : `${count} websites`;
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}
