import { Controller, Get, Query, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminLogsQueryDto } from '../dto/logs.dto';
import { AdminLogsService } from './admin-logs.service';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminLogsController {
  constructor(private readonly adminLogsService: AdminLogsService) {}

  @Get('logs/backend')
  getBackendLogs(@Query() query: AdminLogsQueryDto) {
    return {
      message: 'Backend logs fetched successfully',
      result: this.adminLogsService.getBackendLogs(query),
    };
  }

  @Sse('logs/backend/stream')
  getBackendLogStream(): Observable<MessageEvent> {
    return this.adminLogsService.getBackendLogStream();
  }

  @Get('logs/frontend')
  getFrontendLogs(@Query() query: AdminLogsQueryDto) {
    return {
      message: 'Frontend logs fetched successfully',
      result: this.adminLogsService.getFrontendLogs(query),
    };
  }

  @Sse('logs/frontend/stream')
  getFrontendLogStream(): Observable<MessageEvent> {
    return this.adminLogsService.getFrontendLogStream();
  }
}
