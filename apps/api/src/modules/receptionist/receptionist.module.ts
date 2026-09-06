import { Module } from '@nestjs/common';
import { ReceptionistController } from './receptionist.controller.js';
import { ReceptionistPreviewController } from './receptionist-preview.controller.js';
import { ReceptionistService } from './receptionist.service.js';

@Module({
  controllers: [ReceptionistController, ReceptionistPreviewController],
  providers: [ReceptionistService],
})
export class ReceptionistModule {}
