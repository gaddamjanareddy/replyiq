import { apiFetch } from './client';

export type KnowledgeSourceType = 'SITE_PAGE' | 'FAQ' | 'DOCUMENT';
export type KnowledgeSourceStatus = 'PENDING' | 'FETCHING' | 'READY' | 'FAILED';

export interface KnowledgeItem {
  id: string;
  question: string | null;
  content: string;
  /** True once a person has changed it. A re-crawl leaves these alone. */
  isEdited: boolean;
  position: number;
}

export interface KnowledgeSource {
  id: string;
  type: KnowledgeSourceType;
  status: KnowledgeSourceStatus;
  url: string | null;
  title: string | null;
  lastFetchedAt: string | null;
  /** Owner-facing reason a page could not be read. Never a raw fetch error. */
  failureReason: string | null;
  items: KnowledgeItem[];
}

export interface KnowledgeSummary {
  /** True while a crawl is in flight, so the UI polls instead of sitting still. */
  isIngesting: boolean;
  sourceCount: number;
  itemCount: number;
  failedCount: number;
}

export interface KnowledgeResponse {
  summary: KnowledgeSummary;
  sources: KnowledgeSource[];
}

export interface SearchHit {
  id: string;
  question: string | null;
  content: string;
  sourceTitle: string | null;
  sourceUrl: string | null;
  rank: number;
}

export async function getKnowledge(businessId: string): Promise<KnowledgeResponse> {
  return apiFetch(`/api/v1/businesses/${businessId}/knowledge`);
}

export async function searchKnowledge(
  businessId: string,
  query: string,
): Promise<{ hits: SearchHit[] }> {
  return apiFetch(
    `/api/v1/businesses/${businessId}/knowledge/search?q=${encodeURIComponent(query)}`,
  );
}

/**
 * Ask the server to read the verified website.
 *
 * Returns as soon as the crawl is scheduled (202), not when it finishes. The
 * caller polls `getKnowledge` and watches `summary.isIngesting`.
 */
export async function ingestSite(businessId: string): Promise<{ domain: string }> {
  return apiFetch(`/api/v1/businesses/${businessId}/knowledge/ingest`, { method: 'POST' });
}

export async function createFaq(
  businessId: string,
  question: string,
  answer: string,
): Promise<{ item: KnowledgeItem }> {
  return apiFetch(`/api/v1/businesses/${businessId}/knowledge/faqs`, {
    method: 'POST',
    body: JSON.stringify({ question, answer }),
  });
}

export async function updateKnowledgeItem(
  businessId: string,
  itemId: string,
  data: { question?: string; content?: string },
): Promise<{ item: KnowledgeItem }> {
  return apiFetch(`/api/v1/businesses/${businessId}/knowledge/items/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function deleteKnowledgeItem(businessId: string, itemId: string): Promise<unknown> {
  return apiFetch(`/api/v1/businesses/${businessId}/knowledge/items/${itemId}`, {
    method: 'DELETE',
  });
}

export async function deleteKnowledgeSource(
  businessId: string,
  sourceId: string,
): Promise<unknown> {
  return apiFetch(`/api/v1/businesses/${businessId}/knowledge/sources/${sourceId}`, {
    method: 'DELETE',
  });
}
