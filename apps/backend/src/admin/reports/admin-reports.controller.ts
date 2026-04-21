import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminDefaultRateLimit, RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminReportsService } from './admin-reports.service';
import {
  AdminContentReportsQueryDto,
  BanReportedUserDto,
  DeleteReportedContentDto,
  ReopenAdminReportDto,
  ResolveAdminReportDto,
} from '../dto/reports.dto';
import { OffsetPaginationQueryDto } from '../dto/common.dto';

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('reports/summary')
  async getReportsSummary() {
    return {
      message: 'Report summary fetched successfully',
      result: await this.adminReportsService.getReportsSummary(),
    };
  }

  @Get('reports/content')
  async getContentReports(@Query() query: AdminContentReportsQueryDto) {
    return {
      message: 'Content reports fetched successfully',
      result: await this.adminReportsService.getContentReports(query),
    };
  }

  @Get('reports/bugs')
  async getBugReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Bug reports fetched successfully',
      result: await this.adminReportsService.getBugReports(query),
    };
  }

  @Get('reports/bugs/:reportId/attachments/:attachmentId')
  async downloadBugReportAttachment(
    @Param('reportId') reportId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.adminReportsService.downloadBugReportAttachment(
      reportId,
      attachmentId,
    );
    const safeName = file.filename.replace(/[^\w.\-]/g, '_');
    const encodedName = encodeURIComponent(file.filename);

    res.set({
      'Content-Type': file.mimetype,
      'Content-Disposition': `attachment; filename="${safeName}"; filename*=UTF-8''${encodedName}`,
    });

    return new StreamableFile(file.stream);
  }

  @Get('reports/archived')
  async getArchivedReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Archived reports fetched successfully',
      result: await this.adminReportsService.getArchivedReports(query),
    };
  }

  @Post('reports/:reportId/delete-content')
  @RateLimit({ name: 'admin:danger:admin', limit: 10, windowSeconds: 10 * 60, subject: 'admin' })
  async deleteReportedContent(
    @GetUserId() adminUserId: string,
    @Param('reportId') reportId: string,
    @Body() dto: DeleteReportedContentDto,
  ) {
    const result = await this.adminReportsService.deleteReportedContent(
      reportId,
      dto,
      adminUserId,
    );
    return {
      message: result.message,
      result,
    };
  }

  @Post('reports/:reportId/ban-user')
  @RateLimit({ name: 'admin:danger:admin', limit: 10, windowSeconds: 10 * 60, subject: 'admin' })
  async banReportedUser(
    @GetUserId() adminUserId: string,
    @Param('reportId') reportId: string,
    @Body() dto: BanReportedUserDto,
  ) {
    const result = await this.adminReportsService.banReportedUser(reportId, dto, adminUserId);
    return {
      message: result.message,
      result,
    };
  }

  @Post('reports/:reportId/resolve')
  async resolveReport(
    @GetUserId() adminUserId: string,
    @Param('reportId') reportId: string,
    @Body() dto: ResolveAdminReportDto,
  ) {
    const result = await this.adminReportsService.resolveReport(reportId, dto, adminUserId);
    return {
      message: result.message,
      result,
    };
  }

  @Post('reports/:reportId/reopen')
  async reopenReport(
    @GetUserId() adminUserId: string,
    @Param('reportId') reportId: string,
    @Body() dto: ReopenAdminReportDto,
  ) {
    const result = await this.adminReportsService.reopenReport(reportId, dto, adminUserId);
    return {
      message: result.message,
      result,
    };
  }
}
