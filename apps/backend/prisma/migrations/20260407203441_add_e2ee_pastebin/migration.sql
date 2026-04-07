-- CreateTable
CREATE TABLE `Bin` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(100) NULL,
    `content` MEDIUMTEXT NOT NULL,
    `size` INTEGER NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NULL,
    `shareToken` VARCHAR(191) NOT NULL,
    `passwordHash` VARCHAR(100) NULL,
    `encryptedBinKey` TEXT NOT NULL,
    `binKeyIv` VARCHAR(50) NOT NULL,

    UNIQUE INDEX `Bin_shareToken_key`(`shareToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Bin` ADD CONSTRAINT `Bin_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
