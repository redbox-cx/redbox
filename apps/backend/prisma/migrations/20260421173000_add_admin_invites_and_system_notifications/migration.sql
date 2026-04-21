-- AlterTable
ALTER TABLE `InviteCode`
ADD COLUMN `createdByAdminUserId` VARCHAR(191) NULL,
ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- CreateTable
CREATE TABLE `SystemNotification` (
    `id` VARCHAR(191) NOT NULL,
    `category` ENUM('INFO', 'WARNING', 'ERROR', 'SUCCESS', 'MAINTENANCE') NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `createdByAdminUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `SystemNotification_category_idx`(`category`),
    INDEX `SystemNotification_createdAt_idx`(`createdAt`),
    INDEX `SystemNotification_expiresAt_idx`(`expiresAt`),
    INDEX `SystemNotification_createdByAdminUserId_idx`(`createdByAdminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `InviteCode_createdByAdminUserId_idx` ON `InviteCode`(`createdByAdminUserId`);

-- CreateIndex
CREATE INDEX `InviteCode_createdAt_idx` ON `InviteCode`(`createdAt`);

-- AddForeignKey
ALTER TABLE `InviteCode` ADD CONSTRAINT `InviteCode_createdByAdminUserId_fkey`
FOREIGN KEY (`createdByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `SystemNotification` ADD CONSTRAINT `SystemNotification_createdByAdminUserId_fkey`
FOREIGN KEY (`createdByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
