import { Module } from '@nestjs/common';
import { DomainController } from './domain.controller.js';
import { DomainService } from './domain.service.js';
import { DomainVerificationService } from './domain-verification.service.js';
import { SafeHttpService } from '../../common/security/safe-http.service.js';

@Module({
  controllers: [DomainController],
  providers: [DomainService, DomainVerificationService, SafeHttpService],
  exports: [DomainService],
})
export class DomainModule {}
