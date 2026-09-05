import { Module } from '@nestjs/common';
import { SecurityModule } from '../../infrastructure/security/security.module.js';
import { SessionModule } from '../../infrastructure/security/session/session.module.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { WorkspaceProvisioningService } from './workspace-provisioning.service.js';
import { JwtStrategy } from './jwt.strategy.js';
import { PasswordResetService } from './password-reset.service.js';
import { EmailService } from '../../infrastructure/email/email.service.js';

@Module({
  imports: [SecurityModule, SessionModule],
  controllers: [AuthController],
  providers: [JwtStrategy, AuthService, WorkspaceProvisioningService, PasswordResetService, EmailService],
})
export class AuthModule {}
