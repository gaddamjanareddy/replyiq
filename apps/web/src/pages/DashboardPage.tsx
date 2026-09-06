import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness, useDomains, useOnboardingProgress } from '../hooks/useBusiness';
import { Badge, onboardingStatusBadge, serviceModeBadge } from '../components/ui/Badge';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { ProgressBar } from '../components/ui/Stepper';
import { PageSkeleton } from '../components/ui/Skeleton';
import { ServiceModeBanner } from '../components/domains/ServiceModeBanner';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId;

  const { data: businessData, isLoading } = useBusiness(businessId);
  const { data: onboarding } = useOnboardingProgress(businessId);
  const { data: domainsData } = useDomains(businessId);

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

        {/* SUPPORTING DETAIL — equal weight is correct here, because these
            three genuinely are peers. */}
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
            label="Business"
            value={business.name}
            sub={business.industry ?? 'No industry set'}
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
                done={false}
                title="Teach it about your business"
                description="Let us read your website, or write the answers yourself."
                to="/dashboard/knowledge"
              />
              <NextStep
                done={false}
                title="Add the widget to your site"
                description="One line of code, and your receptionist is live. Coming soon."
              />
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
}: {
  label: string;
  value: string;
  sub: string;
  to?: string;
}) {
  const content = (
    <Card className={to ? 'interactive hover:shadow-raised hover:-translate-y-px' : ''}>
      <CardBody>
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
        <p className="mt-1 truncate text-sm font-semibold text-ink-900">{value}</p>
        <p className="mt-0.5 truncate text-xs text-ink-500">{sub}</p>
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
