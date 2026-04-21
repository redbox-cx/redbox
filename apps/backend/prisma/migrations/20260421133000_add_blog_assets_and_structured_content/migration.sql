-- AlterTable
ALTER TABLE `BlogPost`
ADD COLUMN `contentFormat` ENUM('SECTIONS_JSON', 'HTML', 'TEXT') NOT NULL DEFAULT 'SECTIONS_JSON';

-- CreateTable
CREATE TABLE `BlogAsset` (
    `id` VARCHAR(191) NOT NULL,
    `blogPostId` VARCHAR(191) NULL,
    `uploadedByAdminUserId` VARCHAR(191) NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimetype` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `BlogAsset_storageKey_key`(`storageKey`),
    INDEX `BlogAsset_blogPostId_idx`(`blogPostId`),
    INDEX `BlogAsset_uploadedByAdminUserId_idx`(`uploadedByAdminUserId`),
    INDEX `BlogAsset_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BlogAsset` ADD CONSTRAINT `BlogAsset_blogPostId_fkey`
FOREIGN KEY (`blogPostId`) REFERENCES `BlogPost`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `BlogAsset` ADD CONSTRAINT `BlogAsset_uploadedByAdminUserId_fkey`
FOREIGN KEY (`uploadedByAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
