-- AlterTable
ALTER TABLE `User` ADD COLUMN `encryptedMasterKey` TEXT NULL,
    ADD COLUMN `masterKeyIv` VARCHAR(50) NULL;
