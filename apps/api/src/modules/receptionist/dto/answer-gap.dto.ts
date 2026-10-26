import { ArrayMaxSize, ArrayMinSize, IsArray, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Writing the answer to an unanswered question, from the to-do list.
 *
 * `phrasings` carries every wording in the cluster rather than a cluster id,
 * because a cluster has no identity — it is computed per request and changes
 * the moment somebody phrases the question a new way. The client sends back
 * what it was given.
 *
 * `question` is what will be stored as the heading of the new answer, and is
 * sent separately because the owner is allowed to tidy it before saving. The
 * phrasings are a visitor's words and are never edited; this one is the
 * owner's own, about to become something their receptionist says.
 */
export class AnswerGapDto {
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  question!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  answer!: string;

  @IsArray()
  @ArrayMinSize(1)
  // Generous, but bounded: this drives an `IN (...)` and arrives from a
  // client. The clustering upstream reads at most a hundred phrasings, so a
  // legitimate request cannot exceed that.
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(500, { each: true })
  phrasings!: string[];
}
