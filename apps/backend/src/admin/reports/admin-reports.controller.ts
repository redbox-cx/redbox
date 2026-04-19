import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { GetUserId } from 'src/auth/decorator/get-user.decorator';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminReportsService } from './admin-reports.service';
import {
  AdminContentReportsQueryDto,
  BanReportedUserDto,
  DeleteReportedContentDto,
  ResolveAdminReportDto,
} from '../dto/reports.dto';
import { OffsetPaginationQueryDto } from '../dto/common.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
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
  getBugReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Bug reports fetched successfully',
      result: this.adminReportsService.getBugReports(query),
    };
  }

  @Get('reports/archived')
  async getArchivedReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Archived reports fetched successfully',
      result: await this.adminReportsService.getArchivedReports(query),
    };
  }

  @Post('reports/:reportId/delete-content')
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
}
