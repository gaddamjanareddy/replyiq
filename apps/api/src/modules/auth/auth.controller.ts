import { Controller, Get, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { WorkspaceProvisioningService } from './workspace-provisioning.service.js';
import type { RegisterWorkspaceResponse } from './workspace-provisioning.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { AuthService } from './auth.service.js';
import type { LoginResponse, RefreshResponse, LogoutResponse, CurrentUserResponse } from './auth.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { RegisterWorkspaceDto } from './dto/register-workspace.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { LoginDto } from './dto/login.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { ResetPasswordDto } from './dto/reset-password.dto.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { PasswordResetService } from './password-reset.service.js';
 
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
 
import { ThrottlerGuard } from '@nestjs/throttler';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly workspaceProvisioningService: WorkspaceProvisioningService,
    private readonly authService: AuthService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body() dto: RegisterWorkspaceDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<RegisterWorkspaceResponse> {
    return this.workspaceProvisioningService.register(dto, {
      ipAddress: req.ip,
      userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Request() req: { ip?: string; headers?: Record<string, string | string[] | undefined> },
  ): Promise<LoginResponse> {
    return this.authService.login(dto, {
      ipAddress: req.ip,
      userAgent: typeof req.headers?.['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    });
  }

  @Post('refresh')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshTokenDto): Promise<RefreshResponse> {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  logout(
    @Body() _body: Record<string, never>,
    @Request() req: { user: JwtPayload },
  ): Promise<LogoutResponse> {
    return this.authService.logout(req.user.sessionId);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  getCurrentUser(
    @Request() req: { user: JwtPayload },
  ): Promise<CurrentUserResponse> {
    return this.authService.getCurrentUser(req.user);
  }

  /**
   * Ask for a reset link.
   *
   * Always 202 with the same body, whether or not the address has an account.
   * Answering differently would turn this into an account-enumeration oracle,
   * which is the classic way this endpoint leaks. The one exception is a
   * deployment with no email transport at all, which is a fact about the
   * server rather than about any address.
   */
  @Post('password/forgot')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  async forgotPassword(
    @Body() dto: ForgotPasswordDto,
    @Request() req: { ip?: string },
  ): Promise<{ success: boolean; message: string }> {
    await this.passwordResetService.requestReset(dto.email, req.ip);
    return {
      success: true,
      message: 'If that address has an account, a reset link is on its way.',
    };
  }

  /** Complete a reset. Revokes every session for the account on success. */
  @Post('password/reset')
  @UseGuards(ThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async resetPassword(
    @Body() dto: ResetPasswordDto,
  ): Promise<{ success: boolean; message: string }> {
    await this.passwordResetService.confirmReset(dto.token, dto.password);
    return {
      success: true,
      message: 'Your password has been changed. Sign in with your new password.',
    };
  }
}
