import { Body, Controller, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CreateBugReportDto } from './dto/create-bug-report.dto';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ReportsService } from './reports.service';

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
  async createContentReport(@Body() dto: CreateContentReportDto) {
    return {
      message: 'Content report submitted successfully',
      result: await this.reportsService.createContentReport(dto),
    };
  }

  @Post('bugs')
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
