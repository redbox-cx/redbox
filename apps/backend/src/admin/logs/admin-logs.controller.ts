import { Controller, Get, Query, Req, Sse, UseGuards } from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminDefaultRateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { RateLimitService } from 'src/common/rate-limit/rate-limit.service';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminLogsQueryDto } from '../dto/logs.dto';
import { AdminLogsService } from './admin-logs.service';

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminLogsController {
  constructor(
    private readonly adminLogsService: AdminLogsService,
    private readonly rateLimitService: RateLimitService,
  ) {}

  @Get('logs/backend')
  getBackendLogs(@Query() query: AdminLogsQueryDto) {
    return {
      message: 'Backend logs fetched successfully',
      result: this.adminLogsService.getBackendLogs(query),
    };
  }

  @Sse('logs/backend/stream')
  getBackendLogStream(
    @GetUserId() adminUserId: string,
    @Req() request: Request,
  ): Observable<MessageEvent> {
    return this.rateLimitService.trackConcurrentSse(
      this.adminLogsService.getBackendLogStream(),
      {
        scope: 'admin:logs:backend:stream',
        userSubject: adminUserId,
        userLimit: 2,
        ipSubject: this.rateLimitService.getClientIp(request),
        ipLimit: 5,
      },
    );
  }

  @Get('logs/frontend')
  getFrontendLogs(@Query() query: AdminLogsQueryDto) {
    return {
      message: 'Frontend logs fetched successfully',
      result: this.adminLogsService.getFrontendLogs(query),
    };
  }

  @Sse('logs/frontend/stream')
  getFrontendLogStream(
    @GetUserId() adminUserId: string,
    @Req() request: Request,
  ): Observable<MessageEvent> {
    return this.rateLimitService.trackConcurrentSse(
      this.adminLogsService.getFrontendLogStream(),
      {
        scope: 'admin:logs:frontend:stream',
        userSubject: adminUserId,
        userLimit: 2,
        ipSubject: this.rateLimitService.getClientIp(request),
        ipLimit: 5,
      },
    );
  }
}
