import { Module, Global } from '@nestjs/common';
import { AuditService } from './audit.service.js';

/**
 * Global so that any module can record an audit event without every feature
 * module having to import it. Audit is cross-cutting by nature.
 */
@Global()
@Module({
  providers: [AuditService],
  exports: [AuditService],
})
export class AuditModule {}
