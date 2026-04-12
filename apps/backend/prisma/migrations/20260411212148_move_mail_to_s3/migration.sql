/*
  Warnings:

  - You are about to drop the column `content` on the `Mail` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[storageKey]` on the table `Mail` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `storageKey` to the `Mail` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `Mail` DROP COLUMN `content`,
    ADD COLUMN `storageKey` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `Mail_storageKey_key` ON `Mail`(`storageKey`);
