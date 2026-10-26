import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { answerGap, getGaps, type GapsResponse } from '../api/gaps';

export function useGaps(businessId: string | undefined) {
  return useQuery<GapsResponse, Error>({
    queryKey: ['gaps', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getGaps(businessId);
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

/**
 * Answer a gap.
 *
 * Nothing optimistic here, unlike rating. A rating is a one-tap judgement
 * that can be corrected with another tap; this writes something the
 * receptionist will start saying to customers, and showing it as done before
 * the server agrees would mean an owner closing the tab believing an answer
 * is live when it is not.
 */
export function useAnswerGap(businessId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { question: string; answer: string; phrasings: string[] }) => {
      if (!businessId) throw new Error('No business ID');
      return answerGap(businessId, input);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['gaps', businessId] });
      // The answer itself now exists, so the list below it is stale too — and
      // so is every count derived from either.
      void queryClient.invalidateQueries({ queryKey: ['knowledge', businessId] });
      void queryClient.invalidateQueries({ queryKey: ['receptionist-summary', businessId] });
    },
  });
}
