-- AlterTable
ALTER TABLE `User`
    MODIFY `status` ENUM('ACTIVE', 'BANNED', 'LOCKED', 'PENDING', 'DELETED') NOT NULL DEFAULT 'ACTIVE';

-- AlterTable
ALTER TABLE `InviteCode`
    ADD COLUMN `isValid` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `UserRestriction` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` ENUM('LOCK', 'BAN') NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `isPermanent` BOOLEAN NOT NULL DEFAULT false,
    `expiresAt` DATETIME(3) NULL,
    `createdByAdminUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `resolvedAt` DATETIME(3) NULL,

    INDEX `UserRestriction_userId_type_resolvedAt_idx`(`userId`, `type`, `resolvedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserDeletionRequest` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deleteAfterAt` DATETIME(3) NOT NULL,
    `cancelledAt` DATETIME(3) NULL,
    `processedAt` DATETIME(3) NULL,

    INDEX `UserDeletionRequest_userId_cancelledAt_processedAt_idx`(`userId`, `cancelledAt`, `processedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdminAuditLog` (
    `id` VARCHAR(191) NOT NULL,
    `actorType` ENUM('ADMIN', 'USER', 'SYSTEM') NOT NULL DEFAULT 'ADMIN',
    `adminUserId` VARCHAR(191) NULL,
    `targetUserId` VARCHAR(191) NULL,
    `action` VARCHAR(100) NOT NULL,
    `previousStatus` ENUM('ACTIVE', 'BANNED', 'LOCKED', 'PENDING', 'DELETED') NULL,
    `newStatus` ENUM('ACTIVE', 'BANNED', 'LOCKED', 'PENDING', 'DELETED') NULL,
    `reason` VARCHAR(500) NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminAuditLog_adminUserId_idx`(`adminUserId`),
    INDEX `AdminAuditLog_targetUserId_idx`(`targetUserId`),
    INDEX `AdminAuditLog_action_idx`(`action`),
    INDEX `AdminAuditLog_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserRestriction`
    ADD CONSTRAINT `UserRestriction_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserRestriction`
    ADD CONSTRAINT `UserRestriction_createdByAdminUserId_fkey`
    FOREIGN KEY (`createdByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserDeletionRequest`
    ADD CONSTRAINT `UserDeletionRequest_userId_fkey`
    FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog`
    ADD CONSTRAINT `AdminAuditLog_adminUserId_fkey`
    FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdminAuditLog`
    ADD CONSTRAINT `AdminAuditLog_targetUserId_fkey`
    FOREIGN KEY (`targetUserId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
