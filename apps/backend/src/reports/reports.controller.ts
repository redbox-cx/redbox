import { Body, Controller, Post, UploadedFiles, UseGuards, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ReportsService } from './reports.service';
import { RateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';

const bugReportUploadConfig = {
  storage: memoryStorage(),
  limits: {
    files: 5,
    fileSize: 25 * 1024 * 1024,
  },
};

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('content')
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'reports:content:ip-10m', limit: 5, windowSeconds: 10 * 60, subject: 'ip' },
    { name: 'reports:content:ip-day', limit: 20, windowSeconds: 24 * 60 * 60, subject: 'ip' },
  )
  async createContentReport(@Body() dto: CreateContentReportDto) {
    return {
      message: 'Content report submitted successfully',
      result: await this.reportsService.createContentReport(dto),
    };
  }

  @Post('bugs')
  @UseGuards(RateLimitGuard)
  @RateLimit(
    { name: 'reports:bugs:ip-15m', limit: 3, windowSeconds: 15 * 60, subject: 'ip' },
    { name: 'reports:bugs:ip-day', limit: 10, windowSeconds: 24 * 60 * 60, subject: 'ip' },
  )
  @UseInterceptors(FilesInterceptor('attachments', 5, bugReportUploadConfig))
  async createBugReport(
    @Body() dto: CreateBugReportDto,
    @UploadedFiles() attachments: Express.Multer.File[] = [],
  ) {
    return {
      message: 'Bug report submitted successfully',
      result: await this.reportsService.createBugReport(dto, attachments),
    };
  }
}
