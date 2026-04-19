import { Body, Controller, Post } from '@nestjs/common';
import { CreateContentReportDto } from './dto/create-content-report.dto';
import { ReportsService } from './reports.service';

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
}
