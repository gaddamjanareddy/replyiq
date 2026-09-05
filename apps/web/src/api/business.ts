import { apiFetch, apiRequest } from './client';

/** Which verification routes the UI can offer. Mirrors the server enum, minus
 *  DEV_BYPASS, which is a CI affordance and is never surfaced in the UI. */
export type VerificationMethod = 'DNS_TXT' | 'HTML_META' | 'SANDBOX';

/** A business's current ability to serve traffic (FR-BIZ-07). */
export type ServiceMode = 'LIVE' | 'TEST' | 'INACTIVE';

export interface Business {
  id: string;
  organizationId: string;
  name: string;
  industry: string | null;
  description: string | null;
  websiteUrl: string | null;
  onboardingStatus: string;
  status: string;
  serviceMode: ServiceMode;
  createdAt: string;
  updatedAt: string;
}

export interface BusinessDomain {
  id: string;
  businessId: string;
  domain: string;
  isPrimary: boolean;
  status: string;
  /** Reserved test domain: verifies instantly, never serves live traffic. */
  isSandbox: boolean;
  verifiedAt: string | null;
  verificationMethod: string | null;
  lastCheckedAt: string | null;
  createdAt: string;
}

export interface VerificationInstructions {
  method: string;
  isSandbox: boolean;
  sandboxReason?: string | null;
  recordName?: string | null;
  recordValue?: string | null;
  metaTag?: string | null;
  wellKnownPath?: string | null;
  wellKnownContent?: string | null;
}

export interface OnboardingStep {
  key: string;
  label: string;
  completed: boolean;
}

export interface OnboardingProgress {
  onboardingStatus: string;
  progress: {
    profileCompleted: boolean;
    firstDomainAdded: boolean;
    firstDomainVerified: boolean;
    onboardingCompleted: boolean;
  } | null;
  steps: OnboardingStep[];
  serviceMode: ServiceMode;
}

export async function getBusiness(businessId: string): Promise<{ business: Business }> {
  return apiFetch(`/api/v1/businesses/${businessId}`);
}

export async function updateBusiness(
  businessId: string,
  data: { name?: string; industry?: string; description?: string; websiteUrl?: string },
): Promise<{ business: Business }> {
  return apiFetch(`/api/v1/businesses/${businessId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function getDomains(businessId: string): Promise<{ domains: BusinessDomain[] }> {
  return apiFetch(`/api/v1/businesses/${businessId}/domains`);
}

export async function addDomain(
  businessId: string,
  domain: string,
  isPrimary?: boolean,
): Promise<{ domain: BusinessDomain }> {
  return apiFetch(`/api/v1/businesses/${businessId}/domains`, {
    method: 'POST',
    body: JSON.stringify({ domain, isPrimary }),
  });
}

export interface VerifyDomainResult {
  domain: BusinessDomain;
  /**
   * True when nothing was found yet. This is a 200, not an error: it is the
   * normal state while DNS propagates. A value that does not match is an error
   * with code DOMAIN_VERIFICATION_MISMATCH and is thrown, not returned here.
   */
  pending: boolean;
}

export async function verifyDomain(
  businessId: string,
  domainId: string,
  method: VerificationMethod,
): Promise<VerifyDomainResult> {
  const { data, infoCode } = await apiRequest<{ domain: BusinessDomain }>(
    `/api/v1/businesses/${businessId}/domains/${domainId}/verify`,
    { method: 'POST', body: JSON.stringify({ method }) },
  );
  return { domain: data.domain, pending: infoCode === 'DOMAIN_VERIFICATION_PENDING' };
}

/**
 * Removing the last verified domain takes the business offline, so the server
 * requires an explicit acknowledgement (FR-DOM-11). Without it the call fails
 * with DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED, which is how the UI knows to ask
 * the harder confirmation question rather than the ordinary one.
 */
export async function deleteDomain(
  businessId: string,
  domainId: string,
  acknowledgeServiceInterruption = false,
): Promise<{ serviceMode: ServiceMode }> {
  const query = acknowledgeServiceInterruption
    ? '?acknowledgeServiceInterruption=true'
    : '';
  return apiFetch(
    `/api/v1/businesses/${businessId}/domains/${domainId}${query}`,
    { method: 'DELETE' },
  );
}

export async function getVerificationInstructions(
  businessId: string,
  domainId: string,
  method: VerificationMethod,
): Promise<VerificationInstructions> {
  return apiFetch(
    `/api/v1/businesses/${businessId}/domains/${domainId}/verification-instructions?method=${method}`,
  );
}

export async function getOnboardingProgress(
  businessId: string,
): Promise<OnboardingProgress> {
  return apiFetch(`/api/v1/businesses/${businessId}/onboarding`);
}

export async function updateOnboardingStep(
  businessId: string,
  step: string,
): Promise<OnboardingProgress> {
  return apiFetch(`/api/v1/businesses/${businessId}/onboarding/steps`, {
    method: 'PATCH',
    body: JSON.stringify({ step }),
  });
}
