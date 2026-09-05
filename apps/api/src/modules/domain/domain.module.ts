import { Module } from '@nestjs/common';
import { DomainController } from './domain.controller.js';
import { DomainService } from './domain.service.js';
import { DomainVerificationService } from './domain-verification.service.js';

@Module({
  controllers: [DomainController],
  providers: [DomainService, DomainVerificationService],
  exports: [DomainService],
})
export class DomainModule {}
