import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminDefaultRateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get('ping')
  async getPing() {
    return {
      message: 'Admin ping fetched successfully',
      result: await this.adminDashboardService.getPing(),
    };
  }

  @Get('dashboard')
  async getDashboard() {
    return {
      message: 'Dashboard fetched successfully',
      result: await this.adminDashboardService.getDashboard(),
    };
  }

  @Get('storagecount')
  async getStorageCount() {
    return {
      message: 'Storage count fetched successfully',
      result: await this.adminDashboardService.getStorageCount(),
    };
  }

  @Get('traffic')
  getTraffic() {
    return {
      message: 'Traffic fetched successfully',
      result: this.adminDashboardService.getTraffic(),
    };
  }
}
