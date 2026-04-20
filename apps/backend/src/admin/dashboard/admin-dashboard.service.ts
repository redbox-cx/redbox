import { existsSync, readFileSync, statfsSync } from 'node:fs';
import { resolve } from 'node:path';
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

type StorageCapacityInfo = {
  totalBytes: number | null;
  source: 'env' | 'filesystem' | null;
  path: string | null;
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
    const [
      storage,
      userStats,
      userGrowthHistory,
      reportsHistory,
      contentReportsOpen,
      bugReportsOpen,
    ] = await Promise.all([
      this.getStorageCount(),
      this.getUserStats(),
      this.getUserGrowthHistory(),
      this.getReportsHistory(),
      this.prismaService.contentReport.count({
        where: { resolvedAt: null },
      }),
      this.prismaService.bugReport.count({
        where: { resolvedAt: null },
      }),
    ]);
    const openReports = contentReportsOpen + bugReportsOpen;

    return {
      stats: {
        users: {
          total: userStats.totalUsers,
          new24h: userStats.newLast1d,
          new7d: userStats.newLast7d,
        },
        storage: {
          usedBytes: storage.totalUsedBytes,
          usedAmount: storage.usedAmount,
          totalAmount: storage.totalAmount,
          totalAvailableBytes: storage.totalAvailableBytes,
          maxStorageBytes: storage.maxStorageBytes,
          availableBytes: storage.availableBytes,
          percentUsed: storage.percentUsed,
          usageRatio: storage.usageRatio,
          limitConfigured: storage.limitConfigured,
          limitSource: storage.limitSource,
          new24hBytes: storage.newUsedLast24hBytes,
          new7dBytes: storage.newUsedLast7dBytes,
          new30dBytes: storage.newUsedLast30dBytes,
        },
        reportsOpen: openReports,
        traffic: null,
      },
      breakdown: storage.breakdown,
      charts: {
        storage: storage.history,
        userGrowth: userGrowthHistory,
        'user-growth': userGrowthHistory,
        reports: reportsHistory,
        reportsGrowth: reportsHistory,
        'reports-growth': reportsHistory,
        report: reportsHistory,
        reportsHistory,
        'reports-history': reportsHistory,
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
    const storageCapacity = this.getStorageCapacityInfo();
    const totalAvailableBytes = storageCapacity.totalBytes;
    const availableBytes =
      totalAvailableBytes !== null
        ? Math.max(totalAvailableBytes - currentMetrics.totalUsedBytes, 0)
        : null;
    const usageRatio =
      totalAvailableBytes && totalAvailableBytes > 0
        ? Math.min(currentMetrics.totalUsedBytes / totalAvailableBytes, 1)
        : 0;
    const percentUsed = `${Math.round(usageRatio * 100)}%`;

    return {
      percentUsed,
      usedAmount: this.formatBytes(currentMetrics.totalUsedBytes),
      totalAmount:
        totalAvailableBytes !== null
          ? `of ${this.formatBytes(totalAvailableBytes)} used`
          : 'No storage limit configured',
      totalAvailableBytes,
      maxStorageBytes: totalAvailableBytes,
      storageLimitBytes: totalAvailableBytes,
      availableBytes,
      usageRatio,
      limitConfigured: totalAvailableBytes !== null,
      limitSource: storageCapacity.source,
      autoDetectedStoragePath: storageCapacity.path,
      totalUsedBytes: currentMetrics.totalUsedBytes,
      newUsedLast24hBytes: last24hMetrics.totalUsedBytes,
      newUsedLast7dBytes: last7dMetrics.totalUsedBytes,
      newUsedLast30dBytes: last30dMetrics.totalUsedBytes,
      breakdown: this.buildStorageBreakdown(
        {
          uploadsBytes: currentMetrics.uploadsBytes,
          mailBytes: currentMetrics.mailBytes,
          binsBytes: currentMetrics.binsBytes,
        },
        availableBytes,
      ),
      breakdownBytes: {
        uploadsBytes: currentMetrics.uploadsBytes,
        mailBytes: currentMetrics.mailBytes,
        binsBytes: currentMetrics.binsBytes,
        freeBytes: availableBytes ?? null,
        systemBytes: 0,
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

  private async getReportsHistory(): Promise<AdminHistory> {
    const now = new Date();
    const [contentReports, bugReports] = await Promise.all([
      this.prismaService.contentReport.findMany({
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
      this.prismaService.bugReport.findMany({
        select: {
          createdAt: true,
        },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const timestamps = [...contentReports, ...bugReports]
      .map((report) => report.createdAt.getTime())
      .sort((left, right) => left - right);

    const firstCreatedAt =
      timestamps.length > 0
        ? new Date(timestamps[0])
        : new Date(now.getTime() - 30 * DAY_MS);
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

  private getStorageCapacityInfo(): StorageCapacityInfo {
    const configuredLimit = this.parseStorageLimitBytes(
      process.env.ADMIN_STORAGE_LIMIT ||
        process.env.STORAGE_LIMIT ||
        process.env.ADMIN_STORAGE_LIMIT_BYTES ||
        process.env.STORAGE_LIMIT_BYTES,
    );

    if (configuredLimit !== null) {
      return {
        totalBytes: configuredLimit,
        source: 'env',
        path: null,
      };
    }

    const storagePath = this.getConfiguredStoragePath();
    if (!storagePath) {
      return {
        totalBytes: null,
        source: null,
        path: null,
      };
    }

    const detectedLimit = this.getFilesystemCapacityBytes(storagePath);
    if (detectedLimit === null) {
      return {
        totalBytes: null,
        source: null,
        path: storagePath,
      };
    }

    return {
      totalBytes: detectedLimit,
      source: 'filesystem',
      path: storagePath,
    };
  }

  private parseStorageLimitBytes(rawValue?: string | null) {
    if (!rawValue) {
      return null;
    }

    const normalizedValue =
      typeof rawValue === 'string'
        ? rawValue.trim().toUpperCase()
        : '';
    const match = normalizedValue.match(/^(\d+(?:\.\d+)?)\s*(B|KB|MB|GB|TB|PB)?$/);

    if (!match) {
      return null;
    }

    const value = Number(match[1]);
    const unit = match[2] ?? 'B';
    const multipliers: Record<string, number> = {
      B: 1,
      KB: 1024,
      MB: 1024 ** 2,
      GB: 1024 ** 3,
      TB: 1024 ** 4,
      PB: 1024 ** 5,
    };

    return Math.round(value * multipliers[unit]);
  }

  private getConfiguredStoragePath() {
    const explicitPath = [
      process.env.ADMIN_STORAGE_PATH,
      process.env.MINIO_STORAGE_PATH,
      process.env.MINIO_DATA_PATH,
      process.env.S3_STORAGE_PATH,
    ].find((value) => typeof value === 'string' && value.trim().length > 0);

    if (explicitPath) {
      return explicitPath.trim();
    }

    return this.getDockerComposeMinioDataPath();
  }

  private getDockerComposeMinioDataPath() {
    const candidateComposeFiles = [
      resolve(process.cwd(), 'docker-compose.yaml'),
      resolve(process.cwd(), '../docker-compose.yaml'),
      resolve(process.cwd(), '../../docker-compose.yaml'),
    ];

    for (const composeFile of candidateComposeFiles) {
      if (!existsSync(composeFile)) {
        continue;
      }

      const lines = readFileSync(composeFile, 'utf8').split(/\r?\n/);
      const match = lines
        .map((line) => line.split('#')[0]?.trim() ?? '')
        .find((line) => line.includes(':/data'))
        ?.match(/^-\s*(.+):\/data\b/);

      const detectedPath = match?.[1]?.trim();
      if (detectedPath) {
        return detectedPath.replace(/^["']|["']$/g, '');
      }
    }

    return null;
  }

  private getFilesystemCapacityBytes(storagePath: string) {
    if (!existsSync(storagePath)) {
      return null;
    }

    try {
      const stats = statfsSync(storagePath, { bigint: true });
      const totalBytes = stats.blocks * stats.bsize;

      return Number(totalBytes);
    } catch {
      return null;
    }
  }

  private buildStorageBreakdown(
    metrics: {
      uploadsBytes: number;
      mailBytes: number;
      binsBytes: number;
    },
    availableBytes: number | null,
  ) {
    return [
      { name: 'Uploads', value: this.toChartStorageValue(BigInt(metrics.uploadsBytes)), color: '#951d2a' },
      { name: 'Mail', value: this.toChartStorageValue(BigInt(metrics.mailBytes)), color: '#2b2732' },
      { name: 'Bin', value: this.toChartStorageValue(BigInt(metrics.binsBytes)), color: '#9ca3af' },
      { name: 'System', value: 0, color: '#e5e7eb' },
      { name: 'Free', value: this.toChartStorageValue(BigInt(Math.max(availableBytes ?? 0, 0))), color: '#ffffff' },
    ];
  }

  private formatBytes(bytes: number) {
    if (bytes === 0) {
      return '0 B';
    }

    const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / 1024 ** exponent;
    const decimals = exponent === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2;

    return `${value.toFixed(decimals)} ${units[exponent]}`;
  }
}
