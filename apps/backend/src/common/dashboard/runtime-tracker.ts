import { ServiceRuntimeName } from '@prisma/client';
import { PrismaService } from 'src/prisma.service';
import { getLogicalStorageMetrics } from './storage-metrics';

const HEARTBEAT_INTERVAL_MS = 15_000;
const STORAGE_SNAPSHOT_INTERVAL_MS = 60 * 60 * 1000;

async function upsertRuntime(
  prisma: PrismaService,
  service: ServiceRuntimeName,
  startedAt: Date,
) {
  const now = new Date();
  await prisma.serviceRuntime.upsert({
    where: { service },
    update: {
      startedAt,
      lastHeartbeatAt: now,
    },
    create: {
      service,
      startedAt,
      lastHeartbeatAt: now,
    },
  });
}

export async function startServiceRuntimeHeartbeat(
  prisma: PrismaService,
  service: ServiceRuntimeName,
) {
  const startedAt = new Date();
  await upsertRuntime(prisma, service, startedAt);

  const interval = setInterval(() => {
    void upsertRuntime(prisma, service, startedAt).catch((error) => {
      console.error(`Failed to update runtime heartbeat for ${service}:`, error);
    });
  }, HEARTBEAT_INTERVAL_MS);

  interval.unref?.();
}

async function captureStorageSnapshot(prisma: PrismaService) {
  const metrics = await getLogicalStorageMetrics(prisma);
  await prisma.adminStorageSnapshot.create({
    data: {
      uploadsBytes: BigInt(metrics.uploadsBytes),
      mailBytes: BigInt(metrics.mailBytes),
      binsBytes: BigInt(metrics.binsBytes),
      totalUsedBytes: BigInt(metrics.totalUsedBytes),
    },
  });
}

export async function startMainAppDashboardTelemetry(prisma: PrismaService) {
  await startServiceRuntimeHeartbeat(prisma, ServiceRuntimeName.MAIN_APP);
  await captureStorageSnapshot(prisma);

  const interval = setInterval(() => {
    void captureStorageSnapshot(prisma).catch((error) => {
      console.error('Failed to capture storage snapshot:', error);
    });
  }, STORAGE_SNAPSHOT_INTERVAL_MS);

  interval.unref?.();
}
