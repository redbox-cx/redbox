import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AuditLogsQueryDto } from '../dto/audit.dto';
import { AdminAuditService } from './admin-audit.service';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminAuditController {
  constructor(private readonly adminAuditService: AdminAuditService) {}

  @Get('audit-logs')
  async getAuditLogsLegacy(@Query() query: AuditLogsQueryDto) {
    return {
      message: 'Audit logs fetched successfully',
      result: await this.adminAuditService.getLogs(query),
    };
  }

  @Get('audit/logs')
  async getAuditLogs(@Query() query: AuditLogsQueryDto) {
    return {
      message: 'Audit logs fetched successfully',
      result: await this.adminAuditService.getLogs(query),
    };
  }
}
