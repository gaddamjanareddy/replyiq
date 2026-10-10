import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth.store';
import { useLeads, useUpdateLeadStatus } from '../hooks/useLeads';
import { contactHref, type Lead, type LeadStatus } from '../api/leads';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorBanner } from '../components/ui/Banner';
import { PageHeader } from '../components/layout/PageHeader';
import { PageSkeleton } from '../components/ui/Skeleton';
import { getErrorCopy } from '../api/client';
import type { ErrorCopy } from '../api/error-copy';
import { relativeTime } from '../lib/relative-time';
import { pluralize } from '../lib/plural';

/**
 * Enquiries: the page that makes the product worth paying for.
 *
 * Every other screen is about configuration. This one is about money — these
 * are people who wanted something, did not get it, and left a number. So the
 * design is built around a single action, taken on a phone, in a hurry:
 *
 *   * The contact detail is a LINK, not text. On a phone, tapping it dials.
 *     A list that requires selecting a number and pasting it into the dialler
 *     is a list nobody works through.
 *   * The question is shown with the contact, not behind a click, because
 *     knowing what it was about before ringing is the difference between a
 *     good call and a confused one.
 *   * "Needs a reply" is the default filter and the first thing on the page.
 *     An enquiry list that opens on everything ever received is an archive;
 *     this has to be a to-do list.
 *
 * Deliberately not a CRM. No stages, no assignment, no notes — a two-person
 * business does not need a pipeline, and the moment this becomes one it is a
 * worse version of software they already refuse to use.
 */

const TABS: Array<{ status: LeadStatus; label: string }> = [
  { status: 'NEW', label: 'Needs a reply' },
  { status: 'CONTACTED', label: 'Replied' },
  { status: 'ARCHIVED', label: 'Archived' },
];

export function LeadsPage() {
  const user = useAuthStore((s) => s.user);
  const businessId = user?.businessId ?? '';

  const { data, isLoading } = useLeads(businessId);
  const update = useUpdateLeadStatus(businessId);
  const [tab, setTab] = useState<LeadStatus>('NEW');
  const [error, setError] = useState<ErrorCopy | null>(null);

  if (isLoading) return <PageSkeleton label="Loading your enquiries" />;

  const leads = data?.leads ?? [];
  const counts = data?.counts ?? { new: 0, contacted: 0, archived: 0 };
  const shown = leads.filter((lead) => lead.status === tab);
  const countFor = (status: LeadStatus) =>
    status === 'NEW' ? counts.new : status === 'CONTACTED' ? counts.contacted : counts.archived;

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    setError(null);
    try {
      await update.mutateAsync({ leadId: lead.id, status });
    } catch (err) {
      setError(getErrorCopy(err));
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        overline="Your receptionist"
        title="Enquiries"
        subtitle="When the receptionist could not answer, it asked for a way to reach the visitor. These are the people waiting to hear from you."
        actions={
          counts.new > 0 ? (
            <Badge variant="success" dot pulse>
              {pluralize(counts.new, 'waiting', 'waiting')}
            </Badge>
          ) : undefined
        }
      />

      {error && <ErrorBanner copy={error} />}

      {leads.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              title="No enquiries yet"
              description="Your receptionist offers to take someone's number whenever it cannot answer their question honestly. Anyone who leaves one appears here, and you get an email."
              action={
                <Link to="/dashboard/widget">
                  <Button variant="secondary">Check the widget is installed</Button>
                </Link>
              }
            />
          </CardBody>
        </Card>
      ) : (
        <>
          {/* A tab list rather than a dropdown: three options, and the counts
              are information the owner wants whether or not they switch. */}
          <div role="tablist" aria-label="Enquiries by status" className="flex flex-wrap gap-2">
            {TABS.map((item) => {
              const active = tab === item.status;
              return (
                <button
                  key={item.status}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => setTab(item.status)}
                  className={`interactive rounded-full px-4 py-1.5 text-sm font-medium ring-1 ring-inset ${
                    active
                      ? 'bg-brand-600 text-white ring-brand-600'
                      : 'bg-surface text-ink-700 ring-ink-300 hover:bg-ink-50'
                  }`}
                >
                  {item.label}
                  <span className={active ? 'ml-1.5 text-white/80' : 'ml-1.5 text-ink-500'}>
                    {countFor(item.status)}
                  </span>
                </button>
              );
            })}
          </div>

          {shown.length === 0 ? (
            <Card>
              <CardBody>
                <p className="py-6 text-center text-sm text-ink-600">
                  {tab === 'NEW'
                    ? 'Nothing is waiting for a reply. Everything has been dealt with.'
                    : 'Nothing here.'}
                </p>
              </CardBody>
            </Card>
          ) : (
            <ul className="stagger space-y-3">
              {shown.map((lead) => (
                <LeadRow
                  key={lead.id}
                  lead={lead}
                  busy={update.isPending}
                  onStatus={(status) => void setStatus(lead, status)}
                />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function LeadRow({
  lead,
  busy,
  onStatus,
}: {
  lead: Lead;
  busy: boolean;
  onStatus: (status: LeadStatus) => void;
}) {
  return (
    <li className="animate-rise">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              {/* Visitor-authored text throughout this row. React escapes it,
                  and it is never interpolated into markup. */}
              <p className="text-title text-base font-semibold text-ink-900">
                {lead.name ?? 'Someone'}
              </p>
              <a
                href={contactHref(lead)}
                // A genuinely large tap target: this is the one thing on the
                // page the owner came to press, often one-handed.
                className="interactive mt-1 inline-flex min-h-9 items-center gap-1.5 text-sm font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:decoration-brand-600"
              >
                {lead.contactKind === 'PHONE' ? <PhoneIcon /> : <MailIcon />}
                {lead.contact}
              </a>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {lead.isTest && <Badge variant="test">Test</Badge>}
              <span className="text-xs text-ink-500">{relativeTime(lead.createdAt)}</span>
            </div>
          </div>

          {lead.question && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
              <p className="text-overline text-xs font-semibold text-amber-700">
                They asked, and it could not answer
              </p>
              <p className="mt-1 text-sm text-amber-900">{lead.question}</p>
            </div>
          )}

          {lead.message && <p className="text-sm text-ink-700">{lead.message}</p>}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {lead.status !== 'CONTACTED' && (
              <Button size="sm" disabled={busy} onClick={() => onStatus('CONTACTED')}>
                Mark as replied
              </Button>
            )}
            {lead.status === 'CONTACTED' && (
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => onStatus('NEW')}>
                Still needs a reply
              </Button>
            )}
            {lead.status !== 'ARCHIVED' ? (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStatus('ARCHIVED')}>
                Archive
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => onStatus('NEW')}>
                Restore
              </Button>
            )}
            {lead.question && (
              // The second half of the loop: ring this person, then write the
              // answer so the next one never has to ask.
              <Link
                to="/dashboard/knowledge"
                className="ml-auto text-sm font-medium text-brand-700 underline"
              >
                Answer this for next time
              </Link>
            )}
          </div>
        </CardBody>
      </Card>
    </li>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
      />
    </svg>
  );
}

function MailIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="1.8" stroke="currentColor" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
      />
    </svg>
  );
}
