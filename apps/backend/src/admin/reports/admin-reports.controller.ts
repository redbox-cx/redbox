import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminReportsService } from './admin-reports.service';
import { AdminContentReportsQueryDto, ResolveAdminReportDto } from '../dto/reports.dto';
import { OffsetPaginationQueryDto } from '../dto/common.dto';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
export class AdminReportsController {
  constructor(private readonly adminReportsService: AdminReportsService) {}

  @Get('reports/summary')
  getReportsSummary() {
    return {
      message: 'Report summary fetched successfully',
      result: this.adminReportsService.getReportsSummary(),
    };
  }

  @Get('reports/content')
  getContentReports(@Query() query: AdminContentReportsQueryDto) {
    return {
      message: 'Content reports fetched successfully',
      result: this.adminReportsService.getContentReports(query),
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
  getArchivedReports(@Query() query: OffsetPaginationQueryDto) {
    return {
      message: 'Archived reports fetched successfully',
      result: this.adminReportsService.getArchivedReports(query),
    };
  }

  @Post('reports/:reportId/resolve')
  resolveReport(@Param('reportId') reportId: string, @Body() dto: ResolveAdminReportDto) {
    const result = this.adminReportsService.resolveReport(reportId, dto);
    return {
      message: result.message,
      result,
    };
  }
}
