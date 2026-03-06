/*
  Warnings:

  - You are about to drop the column `encryptedMasterKey` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `masterKeyIv` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `masterKeySalt` on the `User` table. All the data in the column will be lost.
  - Added the required column `expiresAt` to the `File` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `File` ADD COLUMN `expiresAt` DATETIME(3) NOT NULL,
    ADD COLUMN `passwordHash` VARCHAR(100) NULL;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `encryptedMasterKey`,
    DROP COLUMN `masterKeyIv`,
    DROP COLUMN `masterKeySalt`;
