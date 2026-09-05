import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createFaq,
  deleteKnowledgeItem,
  deleteKnowledgeSource,
  getKnowledge,
  ingestSite,
  searchKnowledge,
  updateKnowledgeItem,
} from '../api/knowledge';
import type { KnowledgeResponse, SearchHit } from '../api/knowledge';

/**
 * Knowledge is the only part of the app with genuinely asynchronous server
 * work: a crawl runs in the background after the request returns. So this hook
 * polls while `summary.isIngesting` is true and stops the moment it isn't -
 * pages appearing one by one is the feature working visibly, and a fixed
 * interval that never stops would be a needless drain on a sleeping free-tier
 * instance.
 */
export function useKnowledge(businessId: string | undefined) {
  return useQuery<KnowledgeResponse, Error>({
    queryKey: ['knowledge', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getKnowledge(businessId);
    },
    enabled: !!businessId,
    refetchInterval: (query) => (query.state.data?.summary.isIngesting ? 2000 : false),
  });
}

function useKnowledgeInvalidation(businessId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['knowledge', businessId] });
  };
}

export function useIngestSite(businessId: string) {
  const invalidate = useKnowledgeInvalidation(businessId);
  return useMutation({
    mutationFn: () => ingestSite(businessId),
    // Invalidate immediately so the first PENDING rows appear and the poll
    // starts, rather than the page looking inert until the crawl finishes.
    onSuccess: invalidate,
  });
}

export function useCreateFaq(businessId: string) {
  const invalidate = useKnowledgeInvalidation(businessId);
  return useMutation({
    mutationFn: ({ question, answer }: { question: string; answer: string }) =>
      createFaq(businessId, question, answer),
    onSuccess: invalidate,
  });
}

export function useUpdateKnowledgeItem(businessId: string) {
  const invalidate = useKnowledgeInvalidation(businessId);
  return useMutation({
    mutationFn: ({
      itemId,
      ...data
    }: {
      itemId: string;
      question?: string;
      content?: string;
    }) => updateKnowledgeItem(businessId, itemId, data),
    onSuccess: invalidate,
  });
}

export function useDeleteKnowledgeItem(businessId: string) {
  const invalidate = useKnowledgeInvalidation(businessId);
  return useMutation({
    mutationFn: (itemId: string) => deleteKnowledgeItem(businessId, itemId),
    onSuccess: invalidate,
  });
}

export function useDeleteKnowledgeSource(businessId: string) {
  const invalidate = useKnowledgeInvalidation(businessId);
  return useMutation({
    mutationFn: (sourceId: string) => deleteKnowledgeSource(businessId, sourceId),
    onSuccess: invalidate,
  });
}

/**
 * Search is deliberately a mutation, not a query keyed on the term: it runs
 * when the user asks, not on every keystroke. That keeps it honest as a
 * "what would my receptionist find?" probe rather than a live filter, and
 * avoids a query per character against a full-text index.
 */
export function useSearchKnowledge(businessId: string) {
  return useMutation<{ hits: SearchHit[] }, Error, string>({
    mutationFn: (query: string) => searchKnowledge(businessId, query),
  });
}
