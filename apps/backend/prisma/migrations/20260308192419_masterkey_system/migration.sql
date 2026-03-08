/*
  Warnings:

  - Added the required column `encryptedFileKey` to the `File` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fileKeyIv` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `File` ADD COLUMN `encryptedFileKey` TEXT NOT NULL,
    ADD COLUMN `fileKeyIv` VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `encryptedMasterKey` TEXT NULL,
    ADD COLUMN `masterKeyIv` VARCHAR(50) NULL,
    ADD COLUMN `masterKeySalt` VARCHAR(50) NULL;
