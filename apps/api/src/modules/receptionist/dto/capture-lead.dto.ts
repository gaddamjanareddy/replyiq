import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_QUESTION_LENGTH } from '../receptionist.service.js';
import {
  MAX_CONTACT_LENGTH,
  MAX_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
} from '../lead-capture.js';

/**
 * A visitor leaving a way to be contacted.
 *
 * `contact` is the only required field, and that is the whole design: the
 * widget asks for it at the moment the receptionist has just admitted it
 * cannot help, which is the moment someone is most likely to close the tab.
 * Each extra required field is another reason to.
 *
 * Shape only is validated here. Whether the string is something a person could
 * actually be reached on is decided in `lead-capture.ts`, because the answer
 * is a judgement rather than a constraint and deserves to be reasoned about
 * and tested in one place.
 */
export class CaptureLeadDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_CONTACT_LENGTH)
  contact!: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_NAME_LENGTH)
  name?: string;

  /**
   * The question that went unanswered, sent back by the widget.
   *
   * Client-supplied rather than looked up, because the alternative is to find
   * the visitor's last question by session key — which would mean joining a
   * lead to the anonymous question log and retroactively attaching a name to
   * everything else asked during that visit. The copy is the point: it keeps
   * the two records apart.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_QUESTION_LENGTH)
  question?: string;

  @IsOptional()
  @IsString()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message?: string;

  /**
   * Deliberately NO sessionKey.
   *
   * `AskDto` carries one and the question log stores it. Storing it here too
   * would make a lead joinable to that log by equality, which is precisely the
   * de-anonymisation this record is designed not to permit. There is nothing
   * the server needs it for.
   */
}
