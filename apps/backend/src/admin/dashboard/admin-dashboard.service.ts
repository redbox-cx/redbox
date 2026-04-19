import { Injectable } from '@nestjs/common';
import { ServiceRuntimeName, UserStatus } from '@prisma/client';
import type { AdminHistory } from '../admin.data';
import { PrismaService } from 'src/prisma.service';
import { getLogicalStorageMetrics } from 'src/common/dashboard/storage-metrics';

const HEARTBEAT_STALE_THRESHOLD_MS = 45_000;
const BYTES_IN_GB = 1024 ** 3;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

type HistoryBucket = {
  label: string;
  at: Date;
};

type StorageSnapshotPoint = {
  recordedAt: Date;
  totalUsedBytes: bigint;
};

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPing() {
    const [mainAppRuntime, adminRuntime] = await Promise.all([
      this.prismaService.serviceRuntime.findUnique({
        where: { service: ServiceRuntimeName.MAIN_APP },
      }),
      this.prismaService.serviceRuntime.findUnique({
        where: { service: ServiceRuntimeName.ADMIN_BACKEND },
      }),
    ]);

    return {
      ok: true,
      message: 'pong',
      serverTime: new Date().toISOString(),
      services: {
        mainApp: this.mapRuntime(mainAppRuntime),
        adminBackend: this.mapRuntime(adminRuntime),
      },
    };
  }

  async getDashboard() {
    const [storage, userStats, userGrowthHistory] = await Promise.all([
      this.getStorageCount(),
      this.getUserStats(),
      this.getUserGrowthHistory(),
    ]);

    return {
      stats: {
        users: {
          total: userStats.totalUsers,
          new24h: userStats.newLast1d,
          new7d: userStats.newLast7d,
        },
        storage: {
          usedBytes: storage.totalUsedBytes,
          new24hBytes: storage.newUsedLast24hBytes,
          new7dBytes: storage.newUsedLast7dBytes,
          new30dBytes: storage.newUsedLast30dBytes,
        },
        reportsOpen: 0,
        traffic: null,
      },
      breakdown: storage.breakdown,
      charts: {
        storage: storage.history,
        userGrowth: userGrowthHistory,
      },
    };
  }

  async getStorageCount() {
    const now = new Date();
    const [currentMetrics, last24hMetrics, last7dMetrics, last30dMetrics] = await Promise.all([
      getLogicalStorageMetrics(this.prismaService),
      getLogicalStorageMetrics(this.prismaService, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      getLogicalStorageMetrics(this.prismaService, new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)),
      getLogicalStorageMetrics(this.prismaService, new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)),
    ]);

    const history = await this.getStorageHistory(currentMetrics.totalUsedBytes);

    return {
      totalUsedBytes: currentMetrics.totalUsedBytes,
      newUsedLast24hBytes: last24hMetrics.totalUsedBytes,
      newUsedLast7dBytes: last7dMetrics.totalUsedBytes,
      newUsedLast30dBytes: last30dMetrics.totalUsedBytes,
      breakdown: {
        uploadsBytes: currentMetrics.uploadsBytes,
        mailBytes: currentMetrics.mailBytes,
        binsBytes: currentMetrics.binsBytes,
      },
      history,
    };
  }

  getTraffic() {
    return {
      totalTraffic: 'Not configured',
      status: 'Traffic tracking not implemented yet',
      history: null,
    };
  }

  private mapRuntime(runtime: {
    startedAt: Date;
    lastHeartbeatAt: Date;
  } | null) {
    if (!runtime) {
      return {
        status: 'unknown',
        startedAt: null,
        lastHeartbeatAt: null,
        uptimeSeconds: null,
      };
    }

    const isOnline =
      Date.now() - runtime.lastHeartbeatAt.getTime() <= HEARTBEAT_STALE_THRESHOLD_MS;

    return {
      status: isOnline ? 'online' : 'offline',
      startedAt: runtime.startedAt.toISOString(),
      lastHeartbeatAt: runtime.lastHeartbeatAt.toISOString(),
      uptimeSeconds: Math.max(
        0,
        Math.floor((Date.now() - runtime.startedAt.getTime()) / 1000),
      ),
    };
  }

  private async getUserStats() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const where = {
      status: { not: UserStatus.DELETED },
    } as const;

    const [totalUsers, newLast1d, newLast7d] = await Promise.all([
      this.prismaService.user.count({ where }),
      this.prismaService.user.count({
        where: {
          ...where,
          createdAt: { gte: oneDayAgo },
        },
      }),
      this.prismaService.user.count({
        where: {
          ...where,
          createdAt: { gte: sevenDaysAgo },
        },
      }),
    ]);

    return {
      totalUsers,
      newLast1d,
      newLast7d,
    };
  }

  private async getStorageHistory(currentTotalUsedBytes: number): Promise<AdminHistory> {
    const now = new Date();
    const snapshots = await this.prismaService.adminStorageSnapshot.findMany({
      orderBy: { recordedAt: 'asc' },
      select: {
        recordedAt: true,
        totalUsedBytes: true,
      },
    });

    const fallbackBytes = snapshots[0]?.totalUsedBytes ?? BigInt(currentTotalUsedBytes);
    const firstRecordedAt = snapshots[0]?.recordedAt ?? now;
    const includeYearInTotal = firstRecordedAt.getFullYear() !== now.getFullYear();

    return {
      '24h': this.mapStorageHistory(
        snapshots,
        this.build24HourBuckets(now),
        fallbackBytes,
        now,
      ),
      '7d': this.mapStorageHistory(
        snapshots,
        this.build7DayBuckets(now),
        fallbackBytes,
        now,
      ),
      '30d': this.mapStorageHistory(
        snapshots,
        this.build30DayBuckets(now),
        fallbackBytes,
        now,
      ),
      total: this.mapStorageHistory(
        snapshots,
        this.buildTotalBuckets(firstRecordedAt, now, 6, includeYearInTotal),
        fallbackBytes,
        now,
      ),
    };
  }

  private async getUserGrowthHistory(): Promise<AdminHistory> {
    const now = new Date();
    const users = await this.prismaService.user.findMany({
      where: {
        status: { not: UserStatus.DELETED },
      },
      select: {
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const timestamps = users.map((user) => user.createdAt.getTime());
    const firstCreatedAt = users[0]?.createdAt ?? now;
    const includeYearInTotal = firstCreatedAt.getFullYear() !== now.getFullYear();

    return {
      '24h': this.buildCumulativeHistory(
        timestamps,
        this.build24HourBuckets(now),
        now,
      ),
      '7d': this.buildCumulativeHistory(
        timestamps,
        this.build7DayBuckets(now),
        now,
      ),
      '30d': this.buildCumulativeHistory(
        timestamps,
        this.build30DayBuckets(now),
        now,
      ),
      total: this.buildCumulativeHistory(
        timestamps,
        this.buildTotalBuckets(firstCreatedAt, now, 6, includeYearInTotal),
        now,
      ),
    };
  }

  private mapStorageHistory(
    snapshots: StorageSnapshotPoint[],
    buckets: HistoryBucket[],
    fallbackBytes: bigint,
    now: Date,
  ) {
    let cursor = 0;
    let lastKnownBytes = fallbackBytes;

    return buckets.map((bucket) => {
      const effectiveTime = Math.min(bucket.at.getTime(), now.getTime());

      while (
        cursor < snapshots.length &&
        snapshots[cursor].recordedAt.getTime() <= effectiveTime
      ) {
        lastKnownBytes = snapshots[cursor].totalUsedBytes;
        cursor += 1;
      }

      return {
        time: bucket.label,
        value: this.toChartStorageValue(lastKnownBytes),
      };
    });
  }

  private buildCumulativeHistory(
    timestamps: number[],
    buckets: HistoryBucket[],
    now: Date,
  ) {
    let cursor = 0;

    return buckets.map((bucket) => {
      const bucketTime = Math.min(bucket.at.getTime(), now.getTime());

      while (cursor < timestamps.length && timestamps[cursor] <= bucketTime) {
        cursor += 1;
      }

      return {
        time: bucket.label,
        value: cursor,
      };
    });
  }

  private build24HourBuckets(now: Date): HistoryBucket[] {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    return [0, 6, 12, 18, 24].map((hour) => ({
      label: hour.toString().padStart(2, '0'),
      at: new Date(startOfDay.getTime() + hour * HOUR_MS),
    }));
  }

  private build7DayBuckets(now: Date): HistoryBucket[] {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return Array.from({ length: 7 }, (_, index) => {
      const offset = 6 - index;
      const date = new Date(endOfToday.getTime() - offset * DAY_MS);

      return {
        label: this.formatWeekdayLabel(date),
        at: date,
      };
    });
  }

  private build30DayBuckets(now: Date): HistoryBucket[] {
    const endOfToday = new Date(now);
    endOfToday.setHours(23, 59, 59, 999);

    return [30, 25, 20, 15, 10, 5, 0].map((offset) => {
      const date = new Date(endOfToday.getTime() - offset * DAY_MS);

      return {
        label: this.formatDateLabel(date),
        at: date,
      };
    });
  }

  private buildTotalBuckets(
    firstDate: Date,
    now: Date,
    points: number,
    includeYear: boolean,
  ): HistoryBucket[] {
    const startTime = firstDate.getTime();
    const endTime = now.getTime();
    const span = Math.max(endTime - startTime, 0);

    return Array.from({ length: points }, (_, index) => {
      const ratio = points === 1 ? 1 : index / (points - 1);
      const date = new Date(startTime + Math.round(span * ratio));

      return {
        label: this.formatDateLabel(date, includeYear),
        at: index === points - 1 ? now : date,
      };
    });
  }

  private formatWeekdayLabel(date: Date) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short',
    })
      .format(date)
      .toLowerCase();
  }

  private formatDateLabel(date: Date, includeYear = false) {
    const month = new Intl.DateTimeFormat('en-GB', {
      month: 'short',
    })
      .format(date)
      .toLowerCase();

    const parts = [date.getDate().toString().padStart(2, '0'), month];

    if (includeYear) {
      parts.push(date.getFullYear().toString().slice(-2));
    }

    return parts.join(' ');
  }

  private toChartStorageValue(bytes: bigint) {
    return Number((Number(bytes) / BYTES_IN_GB).toFixed(2));
  }
}
