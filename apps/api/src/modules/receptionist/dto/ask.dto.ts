import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_QUESTION_LENGTH } from '../receptionist.service.js';

export class AskDto {
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_QUESTION_LENGTH)
  question!: string;
}
