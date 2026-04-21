import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminDefaultRateLimit } from 'src/common/rate-limit/rate-limit.decorators';
import { RateLimitGuard } from 'src/common/rate-limit/rate-limit.guard';
import { AdminJwtAuthGuard } from '../guard/admin-auth.guard';
import { PauseAdminRouteDto } from '../dto/routes.dto';
import { AdminRoutesService } from './admin-routes.service';

@Controller('admin')
@AdminDefaultRateLimit()
@UseGuards(AdminJwtAuthGuard, RateLimitGuard)
export class AdminRoutesController {
  constructor(private readonly adminRoutesService: AdminRoutesService) {}

  @Get('routes')
  getRoutes() {
    return {
      message: 'Routes fetched successfully',
      result: this.adminRoutesService.getRoutes(),
    };
  }

  @Post('routes/:routeId/pause')
  pauseRoute(@Param('routeId') routeId: string, @Body() dto: PauseAdminRouteDto) {
    const result = this.adminRoutesService.pauseRoute(routeId, dto);
    return {
      message: result.message,
      result,
    };
  }

  @Post('routes/:routeId/unpause')
  unpauseRoute(@Param('routeId') routeId: string) {
    const result = this.adminRoutesService.unpauseRoute(routeId);
    return {
      message: result.message,
      result,
    };
  }
}
