/**
 * Stable machine-readable API error codes (approved hardening decision).
 *
 * Contract rules:
 *  - Error responses always carry a `code` field next to `statusCode`.
 *  - Codes are part of the public API contract: never rename, only add.
 *  - Frontend MUST translate via these codes and never render raw messages.
 *  - Keep the set minimal: only codes some client behavior depends on.
 */
export enum ErrorCode {
  // Authentication
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_UNAUTHENTICATED = 'AUTH_UNAUTHENTICATED',
  AUTH_REFRESH_INVALID = 'AUTH_REFRESH_INVALID',
  AUTH_EMAIL_TAKEN = 'AUTH_EMAIL_TAKEN',
  /** The reset link is unknown, expired, or already spent. Deliberately one
   *  code for all three - distinguishing them tells an attacker which guesses
   *  were close. */
  AUTH_RESET_TOKEN_INVALID = 'AUTH_RESET_TOKEN_INVALID',
  /** This deployment has no email transport, so reset cannot work at all. A
   *  property of the deployment, not of any account. */
  AUTH_RESET_UNAVAILABLE = 'AUTH_RESET_UNAVAILABLE',

  // Authorization / resources
  AUTHZ_FORBIDDEN = 'AUTHZ_FORBIDDEN',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',

  // Request problems
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  RATE_LIMITED = 'RATE_LIMITED',

  /**
   * Any unhandled server-side failure. Emitted by GlobalExceptionFilter so a
   * 500 still carries a code - without it the client falls through to its
   * generic fallback and loses the one thing worth saying here, which is that
   * the user did not cause this and retrying is reasonable.
   */
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Domains
  DOMAIN_NOT_FOUND = 'DOMAIN_NOT_FOUND',
  DOMAIN_ALREADY_REGISTERED = 'DOMAIN_ALREADY_REGISTERED',
  DOMAIN_ALREADY_VERIFIED = 'DOMAIN_ALREADY_VERIFIED',

  /**
   * A record or snippet was found, but its value did not match. Distinct from
   * "not found yet" (InfoCode.DOMAIN_VERIFICATION_PENDING) because the two have
   * different causes and different fixes: a mismatch is almost always a
   * copy-paste error the user can fix now, while pending usually just needs
   * time (FR-DOM-10).
   */
  DOMAIN_VERIFICATION_MISMATCH = 'DOMAIN_VERIFICATION_MISMATCH',

  /** @deprecated Superseded by DOMAIN_VERIFICATION_MISMATCH. Retained so that
   * any client pinned to the old code keeps resolving to copy. Never emitted. */
  DOMAIN_VERIFICATION_FAILED = 'DOMAIN_VERIFICATION_FAILED',

  /** SANDBOX attempted on a domain that is not in a reserved namespace. */
  DOMAIN_SANDBOX_NOT_ELIGIBLE = 'DOMAIN_SANDBOX_NOT_ELIGIBLE',

  /** A live method attempted on a reserved test domain, which cannot resolve. */
  DOMAIN_SANDBOX_ONLY = 'DOMAIN_SANDBOX_ONLY',

  /**
   * Deleting the last verified domain requires an explicit acknowledgement on
   * the request itself, so that the safety survives outside the UI (FR-DOM-11).
   */
  DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED = 'DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED',

  /** @deprecated Superseded by DOMAIN_LAST_VERIFIED_CONFIRM_REQUIRED (D-06R:
   * the action is now confirmable rather than blocked). Never emitted. */
  DOMAIN_LAST_VERIFIED = 'DOMAIN_LAST_VERIFIED',

  // Knowledge
  KNOWLEDGE_NOT_FOUND = 'KNOWLEDGE_NOT_FOUND',
  /** Nothing verified yet, so there is no site we are entitled to read. */
  KNOWLEDGE_NO_VERIFIED_DOMAIN = 'KNOWLEDGE_NO_VERIFIED_DOMAIN',
  /** Only a reserved test domain is verified - there is no real site behind it. */
  KNOWLEDGE_SANDBOX_DOMAIN = 'KNOWLEDGE_SANDBOX_DOMAIN',

  // Onboarding
  ONBOARDING_STEP_OUT_OF_ORDER = 'ONBOARDING_STEP_OUT_OF_ORDER',
  ONBOARDING_ALREADY_COMPLETED = 'ONBOARDING_ALREADY_COMPLETED',
  ONBOARDING_NO_DOMAIN = 'ONBOARDING_NO_DOMAIN',
  ONBOARDING_NO_VERIFIED_DOMAIN = 'ONBOARDING_NO_VERIFIED_DOMAIN',
}

/** Success responses may carry an informational code (e.g. verification pending). */
export enum InfoCode {
  DOMAIN_VERIFICATION_PENDING = 'DOMAIN_VERIFICATION_PENDING',
}

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';

type CodedBody = { code: string; message: string };

function codedFactory(
  exceptionCtor: new (response: CodedBody) => Error,
) {
  return (code: ErrorCode, message: string): Error =>
    new exceptionCtor({ code, message });
}

export const codedBadRequest = codedFactory(BadRequestException);
export const codedUnauthorized = codedFactory(UnauthorizedException);
export const codedForbidden = codedFactory(ForbiddenException);
export const codedNotFound = codedFactory(NotFoundException);
export const codedConflict = codedFactory(ConflictException);
