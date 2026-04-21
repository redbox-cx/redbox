-- The previous blog implementation stored structured JSON/HTML content and separate blog assets.
-- This rewrite intentionally drops those blog tables and recreates metadata for Markdown-only posts.

-- DropForeignKey
ALTER TABLE `BlogAsset` DROP FOREIGN KEY `BlogAsset_blogPostId_fkey`;

-- DropForeignKey
ALTER TABLE `BlogAsset` DROP FOREIGN KEY `BlogAsset_uploadedByAdminUserId_fkey`;

-- DropTable
DROP TABLE `BlogAsset`;

-- DropTable
DROP TABLE `BlogPost`;

-- CreateTable
CREATE TABLE `BlogPost` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(150) NULL,
    `subtitle` VARCHAR(300) NOT NULL,
    `categories` JSON NULL,
    `storageName` VARCHAR(191) NOT NULL,
    `contentSize` INTEGER NOT NULL,
    `status` ENUM('DRAFT', 'PUBLISHED', 'WITHDRAWN') NOT NULL DEFAULT 'DRAFT',
    `authorAdminUserId` VARCHAR(191) NULL,
    `authorName` VARCHAR(80) NOT NULL,
    `authorTitle` VARCHAR(100) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NULL,
    `withdrawnAt` DATETIME(3) NULL,

    UNIQUE INDEX `BlogPost_storageName_key`(`storageName`),
    INDEX `BlogPost_status_publishedAt_idx`(`status`, `publishedAt`),
    INDEX `BlogPost_createdAt_idx`(`createdAt`),
    INDEX `BlogPost_authorAdminUserId_idx`(`authorAdminUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `BlogPost` ADD CONSTRAINT `BlogPost_authorAdminUserId_fkey`
FOREIGN KEY (`authorAdminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
