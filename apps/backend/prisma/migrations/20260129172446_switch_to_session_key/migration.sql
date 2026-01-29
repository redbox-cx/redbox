/*
  Warnings:

  - You are about to drop the column `tokenVersion` on the `User` table. All the data in the column will be lost.
  - The required column `sessionKey` was added to the `User` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `tokenVersion`,
    ADD COLUMN `sessionKey` VARCHAR(191) NOT NULL;
