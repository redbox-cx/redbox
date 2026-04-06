/*
  Warnings:

  - Added the required column `recoveryEncryptedMasterKey` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recoveryMasterKeyIv` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recoveryMasterKeySalt` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `recoveryPhraseHash` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `recoveryEncryptedMasterKey` TEXT NOT NULL,
    ADD COLUMN `recoveryMasterKeyIv` VARCHAR(50) NOT NULL,
    ADD COLUMN `recoveryMasterKeySalt` VARCHAR(50) NOT NULL,
    ADD COLUMN `recoveryPhraseHash` VARCHAR(100) NOT NULL;
