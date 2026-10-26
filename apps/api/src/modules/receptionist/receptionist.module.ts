import { Module } from '@nestjs/common';
import { KnowledgeModule } from '../knowledge/knowledge.module.js';
import { ReceptionistController } from './receptionist.controller.js';
import { ReceptionistPreviewController } from './receptionist-preview.controller.js';
import { ReceptionistService } from './receptionist.service.js';
import { LeadService } from './lead.service.js';
import { EmailService } from '../../infrastructure/email/email.service.js';

@Module({
  /**
   * The receptionist knows about knowledge, never the other way round.
   *
   * Answering a gap writes a knowledge item, and that write belongs to the
   * service that owns it — including the source upsert and the ordering,
   * which a second implementation here would get subtly wrong. Retrieval
   * already reads `knowledge_items`, so the dependency runs in the direction
   * it already ran.
   */
  imports: [KnowledgeModule],
  controllers: [ReceptionistController, ReceptionistPreviewController],
  providers: [ReceptionistService, LeadService, EmailService],
})
export class ReceptionistModule {}
