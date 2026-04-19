import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ADMIN_BUG_REPORTS,
  ADMIN_CONTENT_REPORTS,
  ADMIN_REPORTS_HISTORY,
  type AdminBugReport,
  type AdminContentReport,
} from '../admin.data';
import { AdminContentReportsQueryDto, ResolveAdminReportDto } from '../dto/reports.dto';
import { OffsetPaginationQueryDto } from '../dto/common.dto';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminReportsService {
  private contentReports: AdminContentReport[] = clone(ADMIN_CONTENT_REPORTS);
  private bugReports: AdminBugReport[] = clone(ADMIN_BUG_REPORTS);

  getOpenReportsCount() {
    return this.contentReports.length + this.bugReports.length;
  }

  getReportsSummary() {
    return {
      openReports: this.getOpenReportsCount(),
      contentReportsOpen: this.contentReports.length,
      bugReportsOpen: this.bugReports.length,
      archivedReports: 0,
      history: clone(ADMIN_REPORTS_HISTORY),
    };
  }

  getContentReports(query: AdminContentReportsQueryDto) {
    const source = query.status === 'archived' ? [] : this.contentReports;
    return this.paginateArray(source, query);
  }

  getBugReports(query: OffsetPaginationQueryDto) {
    return this.paginateArray(this.bugReports, query);
  }

  getArchivedReports(query: OffsetPaginationQueryDto) {
    return this.paginateArray([], query);
  }

  resolveReport(reportId: string, dto: ResolveAdminReportDto) {
    const contentReport = this.contentReports.find((report) => report.id === reportId);
    if (contentReport) {
      this.contentReports = this.contentReports.filter((report) => report.id !== reportId);
      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    const bugReport = this.bugReports.find((report) => report.id === reportId);
    if (bugReport) {
      this.bugReports = this.bugReports.filter((report) => report.id !== reportId);
      return {
        success: true,
        message: 'Report resolved and archived',
      };
    }

    throw new NotFoundException('Report not found');
  }

  private paginateArray<T>(items: T[], query: OffsetPaginationQueryDto) {
    return clone(items.slice(query.offset, query.offset + query.limit));
  }
}
