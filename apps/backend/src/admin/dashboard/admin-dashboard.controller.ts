import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { AdminDashboardService } from './admin-dashboard.service';

@Controller('admin')
@UseGuards(AdminJwtAuthGuard)
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
