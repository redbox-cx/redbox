-- CreateTable
CREATE TABLE `InternalMail` (
    `id` VARCHAR(191) NOT NULL,
    `createdByAdminUserId` VARCHAR(191) NULL,
    `senderId` VARCHAR(50) NOT NULL,
    `senderAddress` VARCHAR(255) NOT NULL,
    `senderLabel` VARCHAR(100) NOT NULL,
    `toAddress` VARCHAR(255) NOT NULL,
    `targetType` ENUM('BROADCAST', 'USER') NOT NULL,
    `targetUsername` VARCHAR(50) NULL,
    `subject` VARCHAR(255) NOT NULL,
    `body` MEDIUMTEXT NOT NULL,
    `isHtml` BOOLEAN NOT NULL DEFAULT false,
    `template` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recalledAt` DATETIME(3) NULL,
    `recallReason` VARCHAR(500) NULL,
    `recalledByAdminUserId` VARCHAR(191) NULL,
    `deletedAt` DATETIME(3) NULL,
    `deleteReason` VARCHAR(500) NULL,
    `deletedByAdminUserId` VARCHAR(191) NULL,

    INDEX `InternalMail_createdAt_idx`(`createdAt`),
    INDEX `InternalMail_senderId_idx`(`senderId`),
    INDEX `InternalMail_targetType_idx`(`targetType`),
    INDEX `InternalMail_targetUsername_idx`(`targetUsername`),
    INDEX `InternalMail_recalledAt_idx`(`recalledAt`),
    INDEX `InternalMail_deletedAt_idx`(`deletedAt`),
    INDEX `InternalMail_createdByAdminUserId_idx`(`createdByAdminUserId`),
    INDEX `InternalMail_recalledByAdminUserId_idx`(`recalledByAdminUserId`),
    INDEX `InternalMail_deletedByAdminUserId_idx`(`deletedByAdminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InternalMailDelivery` (
    `id` VARCHAR(191) NOT NULL,
    `internalMailId` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `mailId` VARCHAR(191) NULL,
    `deliveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `recalledAt` DATETIME(3) NULL,

    UNIQUE INDEX `InternalMailDelivery_mailId_key`(`mailId`),
    UNIQUE INDEX `InternalMailDelivery_internalMailId_userId_key`(`internalMailId`, `userId`),
    INDEX `InternalMailDelivery_internalMailId_idx`(`internalMailId`),
    INDEX `InternalMailDelivery_userId_idx`(`userId`),
    INDEX `InternalMailDelivery_recalledAt_idx`(`recalledAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `InternalMailAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `internalMailId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `size` INTEGER NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `InternalMailAttachment_internalMailId_idx`(`internalMailId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `InternalMail` ADD CONSTRAINT `InternalMail_createdByAdminUserId_fkey`
FOREIGN KEY (`createdByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalMail` ADD CONSTRAINT `InternalMail_recalledByAdminUserId_fkey`
FOREIGN KEY (`recalledByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalMail` ADD CONSTRAINT `InternalMail_deletedByAdminUserId_fkey`
FOREIGN KEY (`deletedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalMailDelivery` ADD CONSTRAINT `InternalMailDelivery_internalMailId_fkey`
FOREIGN KEY (`internalMailId`) REFERENCES `InternalMail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalMailDelivery` ADD CONSTRAINT `InternalMailDelivery_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalMailDelivery` ADD CONSTRAINT `InternalMailDelivery_mailId_fkey`
FOREIGN KEY (`mailId`) REFERENCES `Mail`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `InternalMailAttachment` ADD CONSTRAINT `InternalMailAttachment_internalMailId_fkey`
FOREIGN KEY (`internalMailId`) REFERENCES `InternalMail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
