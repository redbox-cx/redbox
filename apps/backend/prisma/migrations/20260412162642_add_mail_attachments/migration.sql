-- CreateTable
CREATE TABLE `MailAttachment` (
    `id` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(255) NOT NULL,
    `mimetype` VARCHAR(100) NOT NULL,
    `size` INTEGER NOT NULL,
    `storageKey` VARCHAR(191) NOT NULL,
    `mailId` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MailAttachment_storageKey_key`(`storageKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `MailAttachment` ADD CONSTRAINT `MailAttachment_mailId_fkey` FOREIGN KEY (`mailId`) REFERENCES `Mail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
