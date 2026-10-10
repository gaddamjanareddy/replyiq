import { IsIn, IsOptional } from 'class-validator';

/**
 * The owner judging one answer.
 *
 * `null` is a meaningful value, not an omission: it clears a verdict, so
 * somebody who mis-taps on a phone is not stuck having marked their own
 * receptionist wrong forever. `@IsOptional()` skips validation for null and
 * undefined alike, which is exactly the set we accept here.
 */
export class RateAnswerDto {
  @IsOptional()
  @IsIn(['GOOD', 'WRONG'])
  verdict?: 'GOOD' | 'WRONG' | null;
}
