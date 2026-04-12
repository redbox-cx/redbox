/*
  Warnings:

  - Added the required column `encryptedMailKey` to the `Mail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `mailKeyIv` to the `Mail` table without a default value. This is not possible if the table is not empty.
  - Added the required column `encryptedPrivateKey` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `privateKeyIv` to the `User` table without a default value. This is not possible if the table is not empty.
  - Added the required column `publicKey` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Mail` ADD COLUMN `encryptedMailKey` TEXT NOT NULL,
    ADD COLUMN `mailKeyIv` VARCHAR(50) NOT NULL;

-- AlterTable
ALTER TABLE `User` ADD COLUMN `encryptedPrivateKey` TEXT NOT NULL,
    ADD COLUMN `privateKeyIv` VARCHAR(50) NOT NULL,
    ADD COLUMN `publicKey` TEXT NOT NULL;
