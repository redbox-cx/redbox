-- CreateTable
CREATE TABLE `BugReport` (
    `id` VARCHAR(191) NOT NULL,
    `description` TEXT NOT NULL,
    `contactEmail` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `actionTaken` VARCHAR(500) NULL,
    `resolvedByAdminUserId` VARCHAR(191) NULL,

    INDEX `BugReport_createdAt_idx`(`createdAt`),
    INDEX `BugReport_resolvedAt_idx`(`resolvedAt`),
    INDEX `BugReport_resolvedByAdminUserId_idx`(`resolvedByAdminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `BugReportAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `bugReportId` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimetype` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BugReportAttachment_storageKey_key`(`storageKey`),
    INDEX `BugReportAttachment_bugReportId_idx`(`bugReportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BugReport` ADD CONSTRAINT `BugReport_resolvedByAdminUserId_fkey`
FOREIGN KEY (`resolvedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BugReportAttachment` ADD CONSTRAINT `BugReportAttachment_bugReportId_fkey`
FOREIGN KEY (`bugReportId`) REFERENCES `BugReport`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
