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
    <div className="max-w-5xl space-y-6">
      {/* The most important thing on the page: whether this actually works
          right now. Above the greeting, because it is more urgent than one. */}
      {setupComplete && <ServiceModeBanner mode={business.serviceMode} context="dashboard" />}

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-lg font-semibold text-ink-900">
                {greeting()}{user ? `, ${user.name.split(' ')[0]}` : ''}
              </h1>
              <p className="mt-1 text-sm text-ink-600">
                {setupComplete
                  ? business.serviceMode === 'LIVE'
                    ? `Your AI receptionist is answering on ${describeDomains(verifiedDomains.length)}.`
                    : 'Setup is complete. See the note above to start answering real visitors.'
                  : 'A few steps left before your AI receptionist can start work.'}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
              {setupComplete && (
                <Badge variant={modeBadge.variant} dot>
                  {modeBadge.label}
                </Badge>
              )}
            </div>
          </div>

          {!setupComplete && (
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ink-700">
                  Step {Math.min(completedSteps + 1, steps.length || 4)} of {steps.length || 4}
                </span>
                <span className="text-ink-500">
                  {steps.find((s) => !s.completed)?.label ?? 'Almost there'}
                </span>
              </div>
              <ProgressBar completed={completedSteps} total={steps.length || 4} />
              <Link to="/onboarding" className="mt-4 inline-block">
                <Button size="lg">
                  {completedSteps === 0 ? 'Start setup' : 'Continue setup'}
                </Button>
              </Link>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Business" value={business.name} sub={business.industry ?? 'No industry set'} />
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
        <StatCard
          label="Website"
          value={business.websiteUrl ? stripScheme(business.websiteUrl) : 'Not set'}
          sub={business.websiteUrl ? 'From your profile' : 'Add one in settings'}
          to="/dashboard/settings"
        />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-900">What’s next</h2>
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
              description="Services, hours, and the questions people always ask. Coming soon."
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
    <Card className={to ? 'transition-shadow hover:shadow-raised' : ''}>
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
