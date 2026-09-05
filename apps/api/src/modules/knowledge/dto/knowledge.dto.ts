import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateFaqDto {
  @IsString()
  @Transform(trim)
  @MinLength(3)
  @MaxLength(500)
  question!: string;

  @IsString()
  @Transform(trim)
  @MinLength(1)
  // Long enough for a genuinely thorough answer, short enough that a paste of
  // an entire terms-and-conditions page is rejected rather than silently
  // becoming one unusable chunk.
  @MaxLength(4000)
  answer!: string;
}

export class UpdateKnowledgeItemDto {
  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(500)
  question?: string;

  @IsOptional()
  @IsString()
  @Transform(trim)
  @MinLength(1)
  @MaxLength(4000)
  content?: string;
}

export class SearchKnowledgeDto {
  @IsString()
  @Transform(trim)
  @MaxLength(300)
  q!: string;
}
