import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { MAX_QUESTION_LENGTH } from '../receptionist.service.js';

export class AskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_QUESTION_LENGTH)
  question!: string;

  /**
   * Groups one visit's questions so the owner can read a conversation rather
   * than a pile of unrelated lines.
   *
   * Generated in the browser, never linked to a person, and constrained to a
   * safe character set here because it is visitor-supplied and ends up in a
   * database column: there is no reason to accept anything but an opaque id.
   * Absent on the owner's own preview, which is what keeps the gap report to
   * real traffic.
   */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, { message: 'sessionKey must be an opaque identifier' })
  sessionKey?: string;
}
