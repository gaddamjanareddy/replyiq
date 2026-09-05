import { IsIn, IsNotEmpty } from 'class-validator';
import {
  ACCEPTED_VERIFICATION_METHODS,
  type VerificationMethodInput as VerificationMethodInputType,
} from '../../../config/verification-methods.js';

export type VerificationMethodInput = VerificationMethodInputType;

/** Value companion to the type, so callers compare against a constant rather
 *  than a bare string literal. */
export const VerificationMethod = {
  DNS_TXT: 'DNS_TXT',
  HTML_META: 'HTML_META',
  SANDBOX: 'SANDBOX',
  DEV_BYPASS: 'DEV_BYPASS',
} as const satisfies Record<string, VerificationMethodInputType>;

/**
 * Note the `@IsIn(ACCEPTED_VERIFICATION_METHODS)` rather than `@IsEnum`.
 *
 * The accepted set is computed at boot from the environment gate
 * (config/verification-methods.ts). In production it does not contain
 * DEV_BYPASS, so a request carrying that value is rejected by exactly the same
 * code path, with exactly the same 422 body, as any other unrecognised string.
 * That indistinguishability is structural - there is no second check to keep in
 * sync and nothing to get subtly wrong in a later refactor.
 */
export class VerifyDomainDto {
  @IsNotEmpty()
  @IsIn(ACCEPTED_VERIFICATION_METHODS as unknown as readonly string[])
  method!: VerificationMethodInputType;
}
