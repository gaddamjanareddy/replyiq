import { useState } from 'react';
import { useAuthStore } from '../stores/auth.store';
import { useBusiness, useDomains, useAddDomain, useDeleteDomain } from '../hooks/useBusiness';
import type { BusinessDomain } from '../api/business';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Badge, domainStatusBadge } from '../components/ui/Badge';
import { Banner, ErrorBanner } from '../components/ui/Banner';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { VerificationPanel } from '../components/domains/VerificationPanel';
import { getErrorCode, getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';
import { describeDomainProblem, isSandboxDomain, normalizeDomain } from '../lib/domain';
import { ServiceModeBanner } from '../components/domains/ServiceModeBanner';
import { PageHeader } from '../components/layout/PageHeader';

export function DomainsPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId ?? '';

  const { data: businessData } = useBusiness(businessId);
  const { data, isLoading } = useDomains(businessId);
  const addDomainMutation = useAddDomain(businessId);

  const [domainInput, setDomainInput] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [error, setError] = useState<ErrorCopy | null>(null);
  const [verifying, setVerifying] = useState<BusinessDomain | null>(null);
  const [deleting, setDeleting] = useState<BusinessDomain | null>(null);

  const domains = data?.domains ?? [];
  const serviceMode = businessData?.business.serviceMode ?? 'INACTIVE';
  const looksLikeTest = domainInput.trim().length > 0 && isSandboxDomain(domainInput);

  const handleAdd = async () => {
    const problem = describeDomainProblem(domainInput);
    if (problem) {
      setFieldError(problem);
      return;
    }
    setFieldError('');
    setError(null);
    try {
      await addDomainMutation.mutateAsync({ domain: normalizeDomain(domainInput) });
      setDomainInput('');
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  const verifiedCount = domains.filter((d) => d.status === 'VERIFIED').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        overline="Setup"
        title="Websites"
        subtitle="Your AI receptionist works on the websites you’ve verified here."
        actions={
          verifiedCount > 0 ? (
            <Badge variant="success">
              {verifiedCount} verified
            </Badge>
          ) : undefined
        }
      />

      {businessData && <ServiceModeBanner mode={serviceMode} context="domains" />}

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-900">Add a website</h2>
        </CardHeader>
        <CardBody className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="flex-1">
              <Input
                label="Website address"
                placeholder="acme.com"
                value={domainInput}
                error={fieldError}
                hint={fieldError ? undefined : 'Or use something like my-business.example.com to test.'}
                spellCheck={false}
                autoComplete="url"
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  setFieldError('');
                  setError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleAdd();
                  }
                }}
              />
            </div>
            <Button
              onClick={handleAdd}
              loading={addDomainMutation.isPending}
              loadingLabel="Adding…"
              disabled={!domainInput.trim()}
              className="sm:mt-7"
              size="lg"
            >
              Add website
            </Button>
          </div>
          {looksLikeTest && (
            <Banner tone="test" title="That’s a test address">
              It’ll verify instantly and won’t serve real visitors — useful for trying things out.
            </Banner>
          )}
          {error && <ErrorBanner copy={error} />}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold text-ink-900">Your websites</h2>
        </CardHeader>
        <CardBody className={domains.length === 0 && !isLoading ? 'p-0' : undefined}>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : domains.length === 0 ? (
            <EmptyState
              title="No websites yet"
              description="Add the website your AI receptionist should work on. If you're just exploring, a test address like my-business.example.com works too."
              icon={
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="1.7" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18zm0 0c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9M3 12h18" />
                </svg>
              }
            />
          ) : (
            <ul className="divide-y divide-ink-200 stagger">
              {domains.map((d) => (
                <DomainRow
                  key={d.id}
                  domain={d}
                  onVerify={() => setVerifying(d)}
                  onDelete={() => setDeleting(d)}
                />
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Modal
        open={verifying !== null}
        onClose={() => setVerifying(null)}
        title={verifying ? `Verify ${verifying.domain}` : ''}
        size="lg"
      >
        {verifying && (
          <VerificationPanel
            businessId={businessId}
            domain={verifying}
            onVerified={() => setVerifying(null)}
          />
        )}
      </Modal>

      {deleting && (
        <DeleteDomainDialog
          businessId={businessId}
          domain={deleting}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

function DomainRow({
  domain,
  onVerify,
  onDelete,
}: {
  domain: BusinessDomain;
  onVerify: () => void;
  onDelete: () => void;
}) {
  const badge = domainStatusBadge(domain.status, domain.isSandbox);
  const verified = domain.status === 'VERIFIED';

  return (
    <li className="flex animate-rise flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium text-ink-900">{domain.domain}</span>
          <Badge variant={badge.variant} dot>
            {badge.label}
          </Badge>
          {domain.isPrimary && <Badge variant="info">Primary</Badge>}
        </div>
        <p className="mt-0.5 text-xs text-ink-500">
          {verified
            ? `Verified ${formatDate(domain.verifiedAt)}${
                domain.verificationMethod ? ` · ${methodLabel(domain.verificationMethod)}` : ''
              }`
            : domain.lastCheckedAt
              ? `Last checked ${formatDate(domain.lastCheckedAt)} — not found yet`
              : 'Not verified yet'}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {!verified && (
          <Button size="sm" onClick={onVerify}>
            Verify
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onDelete}>
          Remove
        </Button>
      </div>
    </li>
  );
}

/**
 * Removal confirmation.
 *
 * Two levels, because the consequences differ by an order of magnitude:
 *
 *  - An unverified domain is a scratch entry. A single "Remove" is proportionate.
 *  - The **last verified** domain takes the receptionist offline. That gets a
 *    type-the-name confirmation, which is the only pattern that reliably stops
 *    an autopilot click, plus an explicit acknowledgement flag on the request
 *    itself so the safety survives outside this dialog (FR-DOM-11).
 */
function DeleteDomainDialog({
  businessId,
  domain,
  onClose,
}: {
  businessId: string;
  domain: BusinessDomain;
  onClose: () => void;
}) {
  const deleteMutation = useDeleteDomain(businessId);
  const [confirmText, setConfirmText] = useState('');
  const [needsAcknowledgement, setNeedsAcknowledgement] = useState(false);
  const [error, setError] = useState<ErrorCopy | null>(null);

  const typedCorrectly = confirmText.trim().toLowerCase() === domain.domain.toLowerCase();
  const canSubmit = !needsAcknowledgement || typedCorrectly;

  const handleDelete = async () => {
    setError(null);
    try {
      await deleteMutation.mutateAsync({
        domainId: domain.id,
        acknowledgeServiceInterruption: needsAcknowledgement,
      });
      onClose();
    } catch (err) {
      // The server is the authority on whether this is the last verified
      // domain — the client cannot know reliably under concurrency. So we ask
      // optimistically, and escalate to the typed confirmation when told to.
      if (getErrorCode(err) === 'DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED') {
        setNeedsAcknowledgement(true);
        setError(null);
        return;
      }
      setError(getErrorCopy(err));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Remove ${domain.domain}?`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Keep it
          </Button>
          <Button
            variant="danger"
            onClick={handleDelete}
            loading={deleteMutation.isPending}
            loadingLabel="Removing…"
            disabled={!canSubmit}
          >
            {needsAcknowledgement ? 'Take my receptionist offline' : 'Remove website'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {needsAcknowledgement ? (
          <>
            <Banner tone="warning" title="This is your only verified website">
              Your AI receptionist will stop answering until you add and verify another one.
              Nothing else is deleted, and you can add this website back at any time — you’ll just
              need to verify it again.
            </Banner>
            <Input
              label={`Type ${domain.domain} to confirm`}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={domain.domain}
              autoComplete="off"
              spellCheck={false}
            />
          </>
        ) : domain.status === 'VERIFIED' ? (
          <p className="text-sm text-ink-600">
            Your receptionist will stop working on this website. You can add it back later, but
            you’ll need to verify it again.
          </p>
        ) : (
          <p className="text-sm text-ink-600">
            This removes the website and its pending verification. You can add it again anytime.
          </p>
        )}

        {error && <ErrorBanner copy={error} />}
      </div>
    </Modal>
  );
}

function methodLabel(method: string): string {
  switch (method) {
    case 'DNS_TXT':
      return 'DNS record';
    case 'HTML_META':
      return 'Website snippet';
    case 'SANDBOX':
      return 'Test address';
    case 'DEV_BYPASS':
      return 'Developer bypass';
    default:
      return method;
  }
}

function formatDate(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(date);
}
