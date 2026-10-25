import { apiFetch } from './client';
import type { Trend } from '../lib/trend-copy';

export type LeadStatus = 'NEW' | 'CONTACTED' | 'ARCHIVED';
export type LeadContactKind = 'EMAIL' | 'PHONE';

export interface Lead {
  id: string;
  name: string | null;
  /** Exactly what the visitor typed. Never reformatted — a number the owner
   *  does not recognise is worse than one formatted oddly. */
  contact: string;
  contactKind: LeadContactKind;
  /** The question the receptionist would not guess at. Why this lead exists,
   *  and what the owner should open the call with. */
  question: string | null;
  message: string | null;
  /** Captured while the business was in Test Mode. Labelled everywhere. */
  isTest: boolean;
  status: LeadStatus;
  /** Whether the "new enquiry" email actually reached the owner. */
  notifyStatus: 'PENDING' | 'SENT' | 'FAILED' | 'NOT_CONFIGURED';
  createdAt: string;
}

export interface LeadsResponse {
  leads: Lead[];
  counts: {
    /** Totals behind each tab, test leads included — they are in the list. */
    new: number;
    contacted: number;
    archived: number;
    /** Real people expecting a call. Matches the dashboard's number, and is
     *  the only one shown as a headline. */
    waiting: number;
  };
}

/**
 * Numbers for the dashboard: no visitor text, no contact details.
 *
 * A separate endpoint from `getLeads` rather than a count derived from it,
 * because the dashboard would otherwise have to fetch every enquiry — a
 * stranger's name and phone number — in order to render the digit 3.
 */
export interface ReceptionistSummary {
  asked: number;
  answered: number;
  unanswered: number;
  knowledgeItems: number;
  leadsWaiting: number;
  reviewed: number;
  markedWrong: number;
  /** This window against the one before it. See `../lib/trend-copy.ts`. */
  trend: Trend;
}

export async function getReceptionistSummary(
  businessId: string,
): Promise<ReceptionistSummary> {
  return apiFetch(`/api/v1/businesses/${businessId}/receptionist/summary`);
}

export async function getLeads(businessId: string): Promise<LeadsResponse> {
  return apiFetch(`/api/v1/businesses/${businessId}/receptionist/leads`);
}

export async function updateLeadStatus(
  businessId: string,
  leadId: string,
  status: LeadStatus,
): Promise<{ id: string; status: LeadStatus }> {
  return apiFetch(`/api/v1/businesses/${businessId}/receptionist/leads/${leadId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * Erase an enquiry for good.
 *
 * A hard delete on the server, unlike everything else in the product. The row
 * holds a stranger's contact details and the only reason to remove it is that
 * nobody should be holding them any more, so "archive" would not be an
 * honest answer.
 */
export async function deleteLead(businessId: string, leadId: string): Promise<void> {
  await apiFetch(`/api/v1/businesses/${businessId}/receptionist/leads/${leadId}`, {
    method: 'DELETE',
  });
}

/**
 * A link that does the thing the owner is about to do anyway.
 *
 * On a phone this is most of the value of the list: it is useless if reaching
 * somebody means selecting a number and pasting it into the dialler.
 *
 * Both branches filter to a safe character set rather than escaping. The
 * string came from a stranger through a public endpoint, and it is about to
 * become a URL — `tel:` and `mailto:` both take parameters after a `?`, so an
 * unfiltered value is a way to attach a subject, a body, or a second
 * recipient to a link the owner is going to click. Whitelisting the
 * characters that occur in real numbers and addresses closes that without
 * needing to be clever.
 */
export function contactHref(lead: Lead): string {
  return lead.contactKind === 'PHONE'
    ? `tel:${lead.contact.replace(/[^\d+]/g, '')}`
    : `mailto:${lead.contact.replace(/[^A-Za-z0-9@._%+-]/g, '')}`;
}
