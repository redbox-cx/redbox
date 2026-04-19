-- CreateTable
CREATE TABLE `ServiceRuntime` (
    `service` ENUM('MAIN_APP', 'ADMIN_BACKEND') NOT NULL,
    `startedAt` DATETIME(3) NOT NULL,
    `lastHeartbeatAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ServiceRuntime_lastHeartbeatAt_idx`(`lastHeartbeatAt`),
    PRIMARY KEY (`service`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminStorageSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `uploadsBytes` BIGINT NOT NULL DEFAULT 0,
    `mailBytes` BIGINT NOT NULL DEFAULT 0,
    `binsBytes` BIGINT NOT NULL DEFAULT 0,
    `totalUsedBytes` BIGINT NOT NULL DEFAULT 0,
    `recordedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminStorageSnapshot_recordedAt_idx`(`recordedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
