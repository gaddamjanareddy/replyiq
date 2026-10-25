import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getConversations,
  rateAnswer,
  type Conversation,
  type Verdict,
} from '../api/conversations';

export function useConversations(businessId: string | undefined) {
  return useQuery<{ conversations: Conversation[] }, Error>({
    queryKey: ['conversations', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getConversations(businessId);
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

/**
 * Rating an answer, written straight into the cache.
 *
 * This is a one-tap judgement on a list. A round trip before the button
 * changes makes it feel broken enough that people tap twice, and tapping
 * twice here means the opposite verdict. On failure the cache is restored
 * from the server rather than from a remembered value: a rating that silently
 * did not save is worse than one that visibly failed, because the owner
 * believes it was recorded.
 */
export function useRateAnswer(businessId: string | undefined) {
  const queryClient = useQueryClient();
  const key = ['conversations', businessId];

  return useMutation({
    mutationFn: ({ questionId, verdict }: { questionId: string; verdict: Verdict }) => {
      if (!businessId) throw new Error('No business ID');
      return rateAnswer(businessId, questionId, verdict);
    },
    onMutate: ({ questionId, verdict }) => {
      queryClient.setQueryData<{ conversations: Conversation[] }>(key, (current) =>
        current
          ? {
              conversations: current.conversations.map((c) => ({
                ...c,
                turns: c.turns.map((t) => (t.id === questionId ? { ...t, verdict } : t)),
              })),
            }
          : current,
      );
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
}
