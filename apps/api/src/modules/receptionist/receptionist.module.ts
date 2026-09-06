import { Module } from '@nestjs/common';
import { ReceptionistController } from './receptionist.controller.js';
import { ReceptionistService } from './receptionist.service.js';

@Module({
  controllers: [ReceptionistController],
  providers: [ReceptionistService],
})
export class ReceptionistModule {}
