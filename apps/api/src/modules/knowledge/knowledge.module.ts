import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller.js';
import { KnowledgeService } from './knowledge.service.js';
import { SiteIngestionService } from './site-ingestion.service.js';
import { SafeHttpService } from '../../common/security/safe-http.service.js';

@Module({
  controllers: [KnowledgeController],
  providers: [KnowledgeService, SiteIngestionService, SafeHttpService],
  exports: [KnowledgeService],
})
export class KnowledgeModule {}
