-- AlterTable
ALTER TABLE `InternalMailAttachment` ADD COLUMN `storageKey` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `InternalMailAttachment_storageKey_key` ON `InternalMailAttachment`(`storageKey`);
