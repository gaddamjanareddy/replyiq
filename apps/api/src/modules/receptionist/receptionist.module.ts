import { Module } from '@nestjs/common';
import { ReceptionistController } from './receptionist.controller.js';
import { ReceptionistPreviewController } from './receptionist-preview.controller.js';
import { ReceptionistService } from './receptionist.service.js';
import { LeadService } from './lead.service.js';
import { EmailService } from '../../infrastructure/email/email.service.js';

@Module({
  controllers: [ReceptionistController, ReceptionistPreviewController],
  providers: [ReceptionistService, LeadService, EmailService],
})
export class ReceptionistModule {}
