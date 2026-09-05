import { IsEnum, IsNotEmpty } from 'class-validator';

export enum OnboardingStep {
  PROFILE = 'PROFILE',
  FIRST_DOMAIN = 'FIRST_DOMAIN',
  DOMAIN_VERIFICATION = 'DOMAIN_VERIFICATION',
  COMPLETE = 'COMPLETE',
}

export class UpdateOnboardingDto {
  @IsEnum(OnboardingStep)
  @IsNotEmpty()
  step!: OnboardingStep;
}
