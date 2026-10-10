import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getLeads,
  getReceptionistSummary,
  updateLeadStatus,
  type LeadStatus,
  type LeadsResponse,
  type ReceptionistSummary,
} from '../api/leads';

export function useLeads(businessId: string | undefined) {
  return useQuery<LeadsResponse, Error>({
    queryKey: ['leads', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getLeads(businessId);
    },
    enabled: !!businessId,
    /**
     * Refetched when the tab regains focus, which React Query does by
     * default and which is exactly right here: an enquiry arrives while the
     * owner is elsewhere, and coming back to the tab should show it. Nothing
     * polls — a dashboard that polls a free-tier instance all day to find
     * three enquiries a week is a cost with no benefit, and the email is what
     * actually tells them.
     */
    staleTime: 30_000,
  });
}

/** The dashboard's numbers. Tolerates failure — see DashboardPage. */
export function useReceptionistSummary(businessId: string | undefined) {
  return useQuery<ReceptionistSummary, Error>({
    queryKey: ['receptionist-summary', businessId],
    queryFn: async () => {
      if (!businessId) throw new Error('No business ID');
      return getReceptionistSummary(businessId);
    },
    enabled: !!businessId,
    staleTime: 30_000,
  });
}

export function useUpdateLeadStatus(businessId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: LeadStatus }) =>
      updateLeadStatus(businessId, leadId, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['leads', businessId] });
    },
  });
}
