import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useVerificationInstructions, useVerifyDomain } from '../../hooks/useBusiness';
import type { BusinessDomain, VerificationMethod } from '../../api/business';
import { getErrorCopy } from '../../api/client';
import type { ErrorCopy } from '../../api/error-copy';
import { copyForCode } from '../../api/error-copy';
import { Button } from '../ui/Button';
import { Banner, ErrorBanner } from '../ui/Banner';
import { CopyField } from '../ui/CopyField';
import { Skeleton } from '../ui/Skeleton';

interface VerificationPanelProps {
  businessId: string;
  domain: BusinessDomain;
  /** Called once the domain reaches VERIFIED. */
  onVerified: () => void;
}

interface MethodOption {
  id: VerificationMethod;
  title: string;
  /** The question this method answers for the user: "can I do this one?" */
  subtitle: string;
  /** Honest expectation-setting, shown as a small tag. */
  timing: string;
  icon: ReactNode;
}

const DNS_OPTION: MethodOption = {
  id: 'DNS_TXT',
  title: 'Add a DNS record',
  subtitle: 'Best if you can sign in wherever you bought the domain — GoDaddy, Cloudflare, Namecheap.',
  timing: 'Usually minutes',
  icon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
    />
  ),
};

const WEBSITE_OPTION: MethodOption = {
  id: 'HTML_META',
  title: 'Add a snippet to your website',
  subtitle: 'Best if you can edit your site — most site builders have a place to paste this.',
  timing: 'Works immediately',
  icon: (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5"
    />
  ),
};

/**
 * Everything a user needs to prove they own a domain.
 *
 * Shared by the onboarding wizard and the Domains page so the two can never
 * drift into describing the same mechanism differently — which is precisely
 * the failure mode that produced two incompatible descriptions of the website
 * method in earlier revisions of the spec.
 *
 * Three things this deliberately does:
 *
 *  - **Separates "not yet" from "wrong".** A pending result is amber and
 *    reassuring; a mismatch is red and tells you to re-copy. Collapsing them
 *    into one "verification failed" sends half of users hunting for a typo
 *    that does not exist.
 *  - **Relabels the button after a pending result.** "Verify domain" becomes
 *    "Check again", which frames the retry as expected rather than as a second
 *    attempt at something that failed.
 *  - **Never re-fetches new instructions.** The token is immutable, so the
 *    values on screen are stable across retries and across days.
 */
export function VerificationPanel({ businessId, domain, onVerified }: VerificationPanelProps) {
  const isSandbox = domain.isSandbox;
  const [method, setMethod] = useState<VerificationMethod>(isSandbox ? 'SANDBOX' : 'DNS_TXT');
  // Tracked as a discriminated pair rather than inferred from the copy text:
  // the button label depends on *why* we are showing a banner, and matching on
  // prose would break the moment someone reworded it.
  const [result, setResult] = useState<{ copy: ErrorCopy; pending: boolean } | null>(null);

  const verifyMutation = useVerifyDomain(businessId);
  const { data: instructions, isLoading: instructionsLoading } = useVerificationInstructions(
    businessId,
    domain.id,
    method,
  );

  // Switching method clears the previous outcome: a mismatch on DNS says
  // nothing about the snippet the user is now looking at.
  useEffect(() => setResult(null), [method]);

  const handleVerify = async () => {
    setResult(null);
    try {
      const outcome = await verifyMutation.mutateAsync({ domainId: domain.id, method });
      if (outcome.domain.status === 'VERIFIED') {
        onVerified();
        return;
      }
      setResult({ copy: copyForCode('DOMAIN_VERIFICATION_PENDING'), pending: true });
    } catch (error) {
      setResult({ copy: getErrorCopy(error), pending: false });
    }
  };

  if (domain.status === 'VERIFIED') {
    return (
      <Banner
        tone={isSandbox ? 'test' : 'success'}
        title={isSandbox ? 'Verified as a test domain' : `${domain.domain} is verified`}
      >
        {isSandbox
          ? 'This is a reserved test address, so it verifies instantly. Add a real domain when you’re ready to go live.'
          : 'Your AI receptionist can work on this website.'}
      </Banner>
    );
  }

  const busy = verifyMutation.isPending;

  return (
    <div className="space-y-5">
      {isSandbox ? (
        <SandboxExplainer domain={domain.domain} reason={instructions?.sandboxReason ?? null} />
      ) : (
        <>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink-800">
              How would you like to prove you own {domain.domain}?
            </legend>
            <p className="mb-3 text-sm text-ink-600">
              Either one works — pick whichever you have access to. You only need to do one.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {[DNS_OPTION, WEBSITE_OPTION].map((option) => (
                <MethodCard
                  key={option.id}
                  option={option}
                  selected={method === option.id}
                  onSelect={() => setMethod(option.id)}
                />
              ))}
            </div>
          </fieldset>

          <div className="rounded-lg border border-ink-200 bg-white p-4">
            {instructionsLoading || !instructions ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : method === 'DNS_TXT' ? (
              <DnsInstructions
                recordName={instructions.recordName ?? ''}
                recordValue={instructions.recordValue ?? ''}
              />
            ) : (
              <WebsiteInstructions
                metaTag={instructions.metaTag ?? ''}
                wellKnownPath={instructions.wellKnownPath ?? ''}
                wellKnownContent={instructions.wellKnownContent ?? ''}
                domain={domain.domain}
              />
            )}
          </div>
        </>
      )}

      {busy && (
        <Banner tone="info" title="Checking now…" live>
          {method === 'DNS_TXT'
            ? 'Looking up your DNS record.'
            : method === 'HTML_META'
              ? 'Loading your homepage.'
              : 'Confirming your test domain.'}
        </Banner>
      )}

      {!busy && result && <ErrorBanner copy={result.copy} />}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
        {!isSandbox && (
          <p className="text-xs text-ink-500">
            You can close this and come back — these instructions never change.
          </p>
        )}
        <Button
          onClick={handleVerify}
          loading={busy}
          loadingLabel="Checking…"
          size="lg"
          className="sm:ml-auto"
        >
          {isSandbox
            ? 'Verify test domain'
            : result?.pending
              ? 'Check again'
              : 'Verify domain'}
        </Button>
      </div>
    </div>
  );
}

function MethodCard({
  option,
  selected,
  onSelect,
}: {
  option: MethodOption;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={[
        'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
        selected
          ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500'
          : 'border-ink-200 bg-white hover:border-ink-300 hover:bg-ink-50',
      ].join(' ')}
    >
      <input
        type="radio"
        name="verification-method"
        value={option.id}
        checked={selected}
        onChange={onSelect}
        className="mt-1 h-4 w-4 shrink-0 accent-[oklch(0.546_0.245_262.9)]"
      />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <svg
            className={`h-4 w-4 shrink-0 ${selected ? 'text-brand-600' : 'text-ink-400'}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.7"
            stroke="currentColor"
            aria-hidden="true"
          >
            {option.icon}
          </svg>
          <span className="text-sm font-medium text-ink-900">{option.title}</span>
        </span>
        <span className="mt-1 block text-xs text-ink-600">{option.subtitle}</span>
        <span className="mt-1.5 inline-block rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
          {option.timing}
        </span>
      </span>
    </label>
  );
}

function DnsInstructions({
  recordName,
  recordValue,
}: {
  recordName: string;
  recordValue: string;
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink-900">Add this TXT record to your DNS</p>
        <p className="mt-0.5 text-sm text-ink-600">
          Sign in wherever you manage your domain, find the DNS settings, and add a new record of
          type <strong className="font-medium">TXT</strong> with these two values.
        </p>
      </div>
      <CopyField
        label="Record name"
        value={recordName}
        hint="Some providers call this Host or Name. A few want only the part before your domain."
      />
      <CopyField
        label="Record value"
        value={recordValue}
        hint="Some providers call this Content, Value, or Data."
      />
      <p className="text-xs text-ink-500">
        DNS changes usually take a few minutes to spread, and occasionally up to a day. If we
        don’t find it straight away, that’s normal — just check again in a bit.
      </p>
    </div>
  );
}

function WebsiteInstructions({
  metaTag,
  wellKnownPath,
  wellKnownContent,
  domain,
}: {
  metaTag: string;
  wellKnownPath: string;
  wellKnownContent: string;
  domain: string;
}) {
  const [showAlternative, setShowAlternative] = useState(false);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium text-ink-900">Paste this into your homepage</p>
        <p className="mt-0.5 text-sm text-ink-600">
          It goes inside the <code className="text-xs">&lt;head&gt;</code> section of{' '}
          <span className="font-medium">{domain}</span>. Most site builders have a box for this
          called “header code”, “custom head”, or “site-wide scripts”. It’s invisible to visitors.
        </p>
      </div>
      <CopyField label="Snippet" value={metaTag} wrap />

      {/* Progressive disclosure: the file route matters to maybe one user in
          ten, and putting three options on screen at once makes the common
          case harder for the other nine. */}
      <button
        type="button"
        onClick={() => setShowAlternative((v) => !v)}
        aria-expanded={showAlternative}
        className="text-xs font-medium text-brand-700 hover:text-brand-800"
      >
        {showAlternative ? 'Hide' : 'Can’t edit your homepage? Upload a file instead'}
      </button>

      {showAlternative && (
        <div className="space-y-3 rounded-lg border border-ink-200 bg-ink-50 p-3">
          <p className="text-sm text-ink-600">
            Create a plain text file at this address on your site containing only the value below.
            Either route works — we check both.
          </p>
          <CopyField label="File path" value={`https://${domain}${wellKnownPath}`} />
          <CopyField label="File contents" value={wellKnownContent} wrap />
        </div>
      )}
    </div>
  );
}

function SandboxExplainer({ domain, reason }: { domain: string; reason: string | null }) {
  return (
    <Banner tone="test" title={`${domain} is a test address`}>
      <p>
        {/* Deliberately not capitalised: the reason starts with a hostname
            ("example.com is reserved..."), and title-casing it produces
            "Example.com", which reads as a typo. */}
        {reason
          ? `${reason}, so there's no real website for us to check.`
          : "There's no real website for us to check."}{' '}
        It verifies instantly, and lets you finish setup and see everything working before you
        involve a real domain.
      </p>
      <p className="mt-1.5">
        Your receptionist won’t answer real visitors on a test address — add your real domain when
        you’re ready to go live.
      </p>
    </Banner>
  );
}
