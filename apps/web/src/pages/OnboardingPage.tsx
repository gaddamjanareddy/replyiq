import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import {
  useBusiness,
  useUpdateBusiness,
  useDomains,
  useAddDomain,
  useOnboardingProgress,
  useUpdateOnboardingStep,
} from '../hooks/useBusiness';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { Badge, domainStatusBadge } from '../components/ui/Badge';
import { Stepper, ProgressBar } from '../components/ui/Stepper';
import { PageSkeleton } from '../components/ui/Skeleton';
import { VerificationPanel } from '../components/domains/VerificationPanel';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';
import { INDUSTRY_SUGGESTIONS } from '../lib/industries';
import {
  describeDomainProblem,
  hostnameFromWebsiteUrl,
  isSandboxDomain,
  normalizeDomain,
} from '../lib/domain';

/**
 * Step names and blurbs, in the user's words rather than the schema's.
 *
 * The API also returns a `label` ("Business Profile", "Add Domain", ...), but
 * those are backend-authored strings and rendering them would breach the same
 * rule as rendering a backend error message (NFR-USE-05): every word a person
 * reads is chosen here. The API label is kept only as a fallback for a step key
 * this build does not know about.
 */
const STEP_COPY: Record<string, { title: string; summary: string }> = {
  PROFILE: {
    title: 'About your business',
    summary: 'The more we know, the more your receptionist sounds like you.',
  },
  FIRST_DOMAIN: {
    title: 'Your website',
    summary: 'Which website should your receptionist work on?',
  },
  DOMAIN_VERIFICATION: {
    title: 'Prove it’s yours',
    summary: 'A quick check that the website is yours.',
  },
  COMPLETE: {
    title: 'Finish',
    summary: 'That’s everything we need.',
  },
};

export function OnboardingPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId ?? '';
  const navigate = useNavigate();

  const { data: businessData, isLoading: businessLoading } = useBusiness(businessId);
  const { data: onboarding, isLoading: onboardingLoading } = useOnboardingProgress(businessId);
  const { data: domainsData } = useDomains(businessId);

  const updateBusinessMutation = useUpdateBusiness(businessId);
  const addDomainMutation = useAddDomain(businessId);
  const updateStepMutation = useUpdateOnboardingStep(businessId);

  const business = businessData?.business;
  const domains = domainsData?.domains ?? [];

  const [profileForm, setProfileForm] = useState({ industry: '', description: '', websiteUrl: '' });
  const [domainInput, setDomainInput] = useState('');
  const [domainFieldError, setDomainFieldError] = useState('');
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [error, setError] = useState<ErrorCopy | null>(null);
  /** Which step the user is *looking at*. Null means "wherever the server says". */
  const [viewIndex, setViewIndex] = useState<number | null>(null);

  const profileLoaded = useRef(false);
  const domainPrefilled = useRef(false);

  const steps = onboarding?.steps ?? [];
  // Progress is always derived from server state, so a refresh, a new device or
  // a week away all resume in the same place (Design Principle 4).
  const firstIncomplete = steps.findIndex((s) => !s.completed);
  const frontier = firstIncomplete >= 0 ? firstIncomplete : Math.max(steps.length - 1, 0);
  const displayStep = viewIndex !== null ? Math.min(viewIndex, frontier) : frontier;

  const selectedDomain = domains.find((d) => d.id === selectedDomainId);

  // Load the profile form once. Re-syncing on every business refetch would
  // overwrite whatever the user is currently typing.
  useEffect(() => {
    if (business && !profileLoaded.current) {
      profileLoaded.current = true;
      setProfileForm({
        industry: business.industry ?? '',
        description: business.description ?? '',
        websiteUrl: business.websiteUrl ?? '',
      });
    }
  }, [business]);

  // Pre-fill the domain from the website URL they just typed (FR-DOM-16). Once
  // only: after that the two fields are independent and editing one must never
  // rewrite the other.
  useEffect(() => {
    if (domainPrefilled.current || displayStep !== 1 || domainInput) return;
    const suggested = hostnameFromWebsiteUrl(business?.websiteUrl);
    if (suggested) {
      domainPrefilled.current = true;
      setDomainInput(suggested);
    }
  }, [displayStep, business?.websiteUrl, domainInput]);

  // Advancing a step clears any banner from the previous one.
  useEffect(() => {
    setViewIndex(null);
    setError(null);
  }, [frontier]);

  // Default the verification step to whichever domain still needs proving.
  useEffect(() => {
    if (selectedDomainId || domains.length === 0) return;
    const next = domains.find((d) => d.status !== 'VERIFIED') ?? domains[0];
    if (next) setSelectedDomainId(next.id);
  }, [domains, selectedDomainId]);

  if (businessLoading || onboardingLoading) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageSkeleton label="Loading your setup" />
      </div>
    );
  }

  if (business?.onboardingStatus === 'COMPLETED') {
    return <AlreadyComplete onGo={() => navigate('/dashboard')} />;
  }

  const runStep = async (work: () => Promise<unknown>) => {
    setError(null);
    try {
      await work();
      setViewIndex(null);
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  const handleProfileSubmit = () =>
    runStep(async () => {
      await updateBusinessMutation.mutateAsync(profileForm);
      await updateStepMutation.mutateAsync('PROFILE');
    });

  const handleAddDomain = () => {
    const normalized = normalizeDomain(domainInput);
    const problem = describeDomainProblem(domainInput);
    if (problem) {
      setDomainFieldError(problem);
      return;
    }
    setDomainFieldError('');
    return runStep(async () => {
      const created = await addDomainMutation.mutateAsync({ domain: normalized });
      setSelectedDomainId(created.domain.id);
      setDomainInput('');
      await updateStepMutation.mutateAsync('FIRST_DOMAIN');
    });
  };

  /** Advance past the domain step using a website that is already on file. */
  const handleContinueWithSelected = () => {
    if (!selectedDomainId) return;
    setDomainFieldError('');
    return runStep(() => updateStepMutation.mutateAsync('FIRST_DOMAIN'));
  };

  const handleVerified = () => runStep(() => updateStepMutation.mutateAsync('DOMAIN_VERIFICATION'));
  const handleComplete = () => runStep(() => updateStepMutation.mutateAsync('COMPLETE'));

  const stepTitle = (key: string, fallback: string) => STEP_COPY[key]?.title ?? fallback;

  const stepDescriptors = steps.map((s) => ({
    key: s.key,
    label: stepTitle(s.key, s.label),
    summary: STEP_COPY[s.key]?.summary,
    completed: s.completed,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-ink-900">Let’s get you set up</h1>
        <p className="mt-1 text-sm text-ink-600">
          Four short steps. You can leave at any point — we’ll pick up exactly where you left off.
        </p>
      </header>

      <ProgressBar completed={steps.filter((s) => s.completed).length} total={steps.length || 4} />

      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <div className="lg:sticky lg:top-24 lg:self-start">
          <Stepper
            steps={stepDescriptors}
            current={displayStep}
            furthestReachable={frontier}
            onSelect={setViewIndex}
          />
        </div>

        <div className="space-y-4">
          {error && <ErrorBanner copy={error} />}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-ink-900">
                  {steps[displayStep]
                    ? stepTitle(steps[displayStep].key, steps[displayStep].label)
                    : 'Setup'}
                </h2>
                {displayStep < frontier && (
                  <Badge variant="success">Done — you’re reviewing</Badge>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {displayStep === 0 && (
                <ProfileStep
                  form={profileForm}
                  onChange={setProfileForm}
                  onSubmit={handleProfileSubmit}
                  busy={updateBusinessMutation.isPending || updateStepMutation.isPending}
                />
              )}

              {displayStep === 1 && (
                <DomainStep
                  value={domainInput}
                  error={domainFieldError}
                  domains={domains}
                  selectedDomainId={selectedDomainId}
                  onSelect={setSelectedDomainId}
                  onChange={(v) => {
                    setDomainInput(v);
                    setDomainFieldError('');
                  }}
                  onSubmit={handleAddDomain}
                  onContinueWithSelected={handleContinueWithSelected}
                  busy={addDomainMutation.isPending || updateStepMutation.isPending}
                />
              )}

              {displayStep === 2 &&
                (selectedDomain ? (
                  <VerificationPanel
                    businessId={businessId}
                    domain={selectedDomain}
                    onVerified={handleVerified}
                  />
                ) : (
                  <Banner tone="warning" title="Add a website first">
                    Go back a step and tell us which website your receptionist should work on.
                  </Banner>
                ))}

              {displayStep === 3 && (
                <FinishStep
                  serviceMode={onboarding?.serviceMode ?? 'INACTIVE'}
                  onComplete={handleComplete}
                  busy={updateStepMutation.isPending}
                />
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ProfileStep({
  form,
  onChange,
  onSubmit,
  busy,
}: {
  form: { industry: string; description: string; websiteUrl: string };
  onChange: (f: { industry: string; description: string; websiteUrl: string }) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-sm text-ink-600">
        All optional — but the more you tell us, the more your AI receptionist will sound like it
        actually works for you.
      </p>
      <Input
        label="What does your business do?"
        placeholder="e.g. Plumbing, dental practice, design agency"
        // Same treatment as the settings page, and this is the more important
        // of the two: onboarding is where someone meets this field first, and
        // where being rejected costs the most.
        maxLength={100}
        showCount
        suggestions={INDUSTRY_SUGGESTIONS}
        hint="A short label, not a description — there's room for detail below."
        value={form.industry}
        onChange={(e) => onChange({ ...form, industry: e.target.value })}
      />
      <Input
        label="Anything else worth knowing?"
        placeholder="e.g. Family-run since 1998, emergency callouts across Leeds"
        hint="One line is plenty. Your receptionist uses this for tone."
        maxLength={2000}
        showCount
        value={form.description}
        onChange={(e) => onChange({ ...form, description: e.target.value })}
      />
      <Input
        label="Your website"
        type="url"
        placeholder="https://acme.com"
        hint="We’ll use this to save you typing on the next step."
        value={form.websiteUrl}
        onChange={(e) => onChange({ ...form, websiteUrl: e.target.value })}
      />
      <div className="flex justify-end">
        <Button type="submit" loading={busy} loadingLabel="Saving…" size="lg">
          Save and continue
        </Button>
      </div>
    </form>
  );
}

function DomainStep({
  value,
  error,
  domains,
  selectedDomainId,
  onSelect,
  onChange,
  onSubmit,
  onContinueWithSelected,
  busy,
}: {
  value: string;
  error: string;
  domains: Array<{ id: string; domain: string; status: string; isSandbox: boolean }>;
  selectedDomainId: string;
  onSelect: (id: string) => void;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onContinueWithSelected: () => void;
  busy: boolean;
}) {
  const looksLikeTest = value.trim().length > 0 && isSandboxDomain(value);

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <p className="text-sm text-ink-600">
        This is the website your AI receptionist will greet visitors on. We just need to confirm
        it’s yours — it takes about a minute.
      </p>

      <Input
        label="Your website address"
        placeholder="acme.com"
        value={value}
        error={error}
        hint={error ? undefined : 'Paste the whole address if it’s easier — we’ll tidy it up.'}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="url"
        spellCheck={false}
      />

      {/* Told before they commit, not after: switching to a test domain is a
          choice, and finding out post-hoc that your receptionist won't answer
          real visitors is a bad surprise. */}
      {looksLikeTest && (
        <Banner tone="test" title="That’s a test address">
          Perfect for trying things out — it verifies instantly and you can see the whole setup
          working. Your receptionist won’t answer real visitors on it, but you can add your real
          website whenever you’re ready.
        </Banner>
      )}

      {domains.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-500">
            Websites you’ve already added
          </legend>
          <div className="space-y-2">
            {domains.map((d) => {
              const badge = domainStatusBadge(d.status, d.isSandbox);
              return (
                <label
                  key={d.id}
                  className={[
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors',
                    selectedDomainId === d.id
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
                      : 'border-ink-200 bg-surface hover:bg-ink-50',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="existing-domain"
                    checked={selectedDomainId === d.id}
                    onChange={() => onSelect(d.id)}
                    className="h-4 w-4 accent-[oklch(0.546_0.245_262.9)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-900">{d.domain}</span>
                  <Badge variant={badge.variant} dot>
                    {badge.label}
                  </Badge>
                </label>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-ink-500">
            Pick one to continue with, or add another above.
          </p>
        </fieldset>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        {domains.length > 0 && selectedDomainId && !value.trim() && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            loading={busy}
            onClick={onContinueWithSelected}
          >
            Continue with selected
          </Button>
        )}
        <Button type="submit" loading={busy} loadingLabel="Adding…" size="lg" disabled={!value.trim()}>
          Add website
        </Button>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer text-brand-700 hover:text-brand-800">
          Don’t have a domain yet, or can’t use it right now?
        </summary>
        <p className="mt-2 text-ink-600">
          Enter something like <code className="text-xs">my-business.example.com</code>. Addresses
          ending in <code className="text-xs">.example.com</code>, <code className="text-xs">.test</code>{' '}
          or <code className="text-xs">.localhost</code> are reserved for testing — they verify
          instantly, so you can walk through the whole setup now and swap in your real website later.
        </p>
      </details>
    </form>
  );
}

function FinishStep({
  serviceMode,
  onComplete,
  busy,
}: {
  serviceMode: string;
  onComplete: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 animate-pop items-center justify-center rounded-full bg-emerald-100">
          <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-ink-900">Your website is verified</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-ink-600">
          That’s the required part done. Next you’ll teach your receptionist about your business —
          your services, hours, and the questions people always ask.
        </p>
      </div>

      {serviceMode === 'TEST' && (
        <Banner tone="test" title="You’re finishing in test mode">
          You verified a test address, so everything here is a dry run. Add your real website from
          the Domains page whenever you’re ready to go live.
        </Banner>
      )}

      <div className="flex justify-center">
        <Button onClick={onComplete} loading={busy} loadingLabel="Finishing…" size="lg">
          Finish setup
        </Button>
      </div>
    </div>
  );
}

function AlreadyComplete({ onGo }: { onGo: () => void }) {
  return (
    <div className="mx-auto max-w-lg">
      <Card>
        <CardBody className="py-12 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 animate-pop items-center justify-center rounded-full bg-emerald-100">
            <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-ink-900">You’re all set up</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-600">
            Setup is complete. You can change anything from your dashboard at any time.
          </p>
          <Button className="mt-6" size="lg" onClick={onGo}>
            Go to dashboard
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
