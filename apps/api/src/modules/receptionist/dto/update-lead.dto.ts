import { IsEnum } from 'class-validator';

/**
 * The owner moving a lead along.
 *
 * NEW -> CONTACTED is the only transition that matters; ARCHIVED is how spam
 * and mistakes leave the list. Deliberately not a workflow: a two-person
 * business does not need stages, and the moment this becomes a pipeline it
 * becomes a CRM nobody asked for.
 *
 * Any status may follow any other. An owner who marked something CONTACTED by
 * mistake can put it back, and refusing that would be the product arguing with
 * somebody about their own customers.
 */
export const LEAD_STATUSES = ['NEW', 'CONTACTED', 'ARCHIVED'] as const;
export type LeadStatusValue = (typeof LEAD_STATUSES)[number];

export class UpdateLeadDto {
  @IsEnum(LEAD_STATUSES)
  status!: LeadStatusValue;
}
