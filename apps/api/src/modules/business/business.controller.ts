import { Controller, Get, Patch, Param, Body, UseGuards, Request } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { BusinessService } from './business.service.js';
import type { BusinessResponse } from './business.service.js';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- value imports required for emitDecoratorMetadata DI
import { UpdateBusinessDto } from './dto/update-business.dto.js';
 
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
 
import { OrganizationGuard } from '../auth/guards/organization.guard.js';
 
import { RolesGuard } from '../auth/guards/roles.guard.js';
 
import { Roles } from '../auth/decorators/roles.decorator.js';
import type { JwtPayload } from '../../common/types/jwt-payload.interface.js';

@UseGuards(JwtAuthGuard, OrganizationGuard, RolesGuard)
@Controller('businesses')
export class BusinessController {
  constructor(private readonly businessService: BusinessService) {}

  @Get(':businessId')
  findOne(
    @Param('businessId') businessId: string,
    @Request() req: { user: JwtPayload },
  ): Promise<BusinessResponse> {
    return this.businessService.findById(businessId, req.user.organizationId);
  }

  @Roles('OWNER', 'ADMIN')
  @Patch(':businessId')
  update(
    @Param('businessId') businessId: string,
    @Body() dto: UpdateBusinessDto,
    @Request() req: { user: JwtPayload },
  ): Promise<BusinessResponse> {
    return this.businessService.update(businessId, req.user.organizationId, dto);
  }
}
