import { Injectable, NotFoundException } from '@nestjs/common';
import { ADMIN_ROUTES, type AdminRouteRecord } from '../admin.data';
import { PauseAdminRouteDto } from '../dto/routes.dto';

function clone<T>(value: T): T {
  return structuredClone(value);
}

@Injectable()
export class AdminRoutesService {
  private readonly adminProfile = {
    username: 'Admin',
  };

  private routes: AdminRouteRecord[] = clone(ADMIN_ROUTES);

  getRoutes() {
    return clone(this.routes);
  }

  pauseRoute(routeId: string, dto: PauseAdminRouteDto) {
    const route = this.findRouteOrThrow(routeId);
    route.paused = true;
    route.pausedBy = this.adminProfile.username;
    route.pausedAt = this.formatDisplayTimestamp();
    route.reason = dto.reason;

    return {
      success: true,
      message: 'Route paused successfully',
    };
  }

  unpauseRoute(routeId: string) {
    const route = this.findRouteOrThrow(routeId);
    route.paused = false;
    route.pausedBy = null;
    route.pausedAt = null;
    route.reason = null;

    return {
      success: true,
      message: 'Route unpaused successfully',
    };
  }

  private findRouteOrThrow(routeId: string) {
    const decodedRouteId = this.decodeRouteId(routeId);
    const route = this.routes.find((entry) => entry.route === decodedRouteId);
    if (!route) {
      throw new NotFoundException('Route not found');
    }

    return route;
  }

  private decodeRouteId(routeId: string) {
    try {
      return decodeURIComponent(routeId);
    } catch {
      return routeId;
    }
  }

  private formatDisplayTimestamp(date = new Date()) {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  }
}
