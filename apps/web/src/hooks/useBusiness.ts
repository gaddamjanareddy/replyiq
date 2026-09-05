import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getBusiness,
  updateBusiness,
  getDomains,
  addDomain,
  deleteDomain,
  verifyDomain,
  getVerificationInstructions,
  getOnboardingProgress,
  updateOnboardingStep,
} from '../api/business';
import type {
  Business,
  BusinessDomain,
  VerificationInstructions,
  VerificationMethod,
  OnboardingProgress,
} from '../api/business';

/**
 * Server state lives here and only here (TanStack Query); Zustand holds
 * client-only state; `useState` holds transient form state. Keeping domain and
 * onboarding data out of a store is what makes the wizard resume correctly
 * after a refresh or on a second device — there is no local copy to go stale.
 */

/**
 * Anything that changes a domain can change onboarding progress and the
 * business's service mode, so all three are invalidated together. Getting this
 * wrong shows a stale "no verified website" banner right after the user
 * verified one, which reads as the product being broken.
 */
function useDomainMutationInvalidation(businessId: string) {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ['domains', businessId] });
    void queryClient.invalidateQueries({ queryKey: ['onboarding', businessId] });
    void queryClient.invalidateQueries({ queryKey: ['business', businessId] });
  };
}

export function useBusiness(businessId: string | undefined) {
  return useQuery<{ business: Business }, Error>({
    queryKey: ['business', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getBusiness(businessId);
    },
    enabled: !!businessId,
  });
}

export function useUpdateBusiness(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      name?: string;
      industry?: string;
      description?: string;
      websiteUrl?: string;
    }) => updateBusiness(businessId, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['business', businessId] });
    },
  });
}

export function useDomains(businessId: string | undefined) {
  return useQuery<{ domains: BusinessDomain[] }, Error>({
    queryKey: ['domains', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getDomains(businessId);
    },
    enabled: !!businessId,
  });
}

export function useAddDomain(businessId: string) {
  const invalidate = useDomainMutationInvalidation(businessId);
  return useMutation({
    mutationFn: ({ domain, isPrimary }: { domain: string; isPrimary?: boolean }) =>
      addDomain(businessId, domain, isPrimary),
    onSuccess: invalidate,
  });
}

export function useVerifyDomain(businessId: string) {
  const invalidate = useDomainMutationInvalidation(businessId);
  return useMutation({
    mutationFn: ({ domainId, method }: { domainId: string; method: VerificationMethod }) =>
      verifyDomain(businessId, domainId, method),
    // Invalidate on settle rather than only on success: a mismatch updates
    // `lastCheckedAt` on the server, so the row is stale either way.
    onSettled: invalidate,
  });
}

export function useDeleteDomain(businessId: string) {
  const invalidate = useDomainMutationInvalidation(businessId);
  return useMutation({
    mutationFn: ({
      domainId,
      acknowledgeServiceInterruption,
    }: {
      domainId: string;
      acknowledgeServiceInterruption?: boolean;
    }) => deleteDomain(businessId, domainId, acknowledgeServiceInterruption ?? false),
    onSuccess: invalidate,
  });
}

export function useVerificationInstructions(
  businessId: string | undefined,
  domainId: string | undefined,
  method: VerificationMethod | undefined,
) {
  return useQuery<VerificationInstructions, Error>({
    queryKey: ['verification-instructions', businessId, domainId, method],
    queryFn: async () => {
      if (!businessId || !domainId || !method) throw new Error('Missing parameters');
      return getVerificationInstructions(businessId, domainId, method);
    },
    enabled: !!businessId && !!domainId && !!method,
    // The token never changes (FR-DOM-02), so these values are immutable for
    // the life of the domain. Refetching them would only risk showing a user
    // a spinner in place of instructions they were mid-way through copying.
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

export function useOnboardingProgress(businessId: string | undefined) {
  return useQuery<OnboardingProgress, Error>({
    queryKey: ['onboarding', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getOnboardingProgress(businessId);
    },
    enabled: !!businessId,
  });
}

export function useUpdateOnboardingStep(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (step: string) => updateOnboardingStep(businessId, step),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['onboarding', businessId] });
      void queryClient.invalidateQueries({ queryKey: ['business', businessId] });
    },
  });
}
