-- CreateTable
CREATE TABLE `ContentReport` (
    `id` VARCHAR(191) NOT NULL,
    `contentType` ENUM('FILE', 'BIN') NOT NULL,
    `reportedUserId` VARCHAR(191) NOT NULL,
    `fileId` VARCHAR(191) NULL,
    `binId` VARCHAR(191) NULL,
    `contentLink` TEXT NOT NULL,
    `reason` TEXT NOT NULL,
    `reporterEmail` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,
    `actionTaken` VARCHAR(500) NULL,
    `resolvedByAdminUserId` VARCHAR(191) NULL,

    INDEX `ContentReport_reportedUserId_idx`(`reportedUserId`),
    INDEX `ContentReport_fileId_idx`(`fileId`),
    INDEX `ContentReport_binId_idx`(`binId`),
    INDEX `ContentReport_createdAt_idx`(`createdAt`),
    INDEX `ContentReport_resolvedAt_idx`(`resolvedAt`),
    INDEX `ContentReport_resolvedByAdminUserId_idx`(`resolvedByAdminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ContentReport` ADD CONSTRAINT `ContentReport_reportedUserId_fkey`
FOREIGN KEY (`reportedUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentReport` ADD CONSTRAINT `ContentReport_fileId_fkey`
FOREIGN KEY (`fileId`) REFERENCES `File`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentReport` ADD CONSTRAINT `ContentReport_binId_fkey`
FOREIGN KEY (`binId`) REFERENCES `Bin`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ContentReport` ADD CONSTRAINT `ContentReport_resolvedByAdminUserId_fkey`
FOREIGN KEY (`resolvedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
