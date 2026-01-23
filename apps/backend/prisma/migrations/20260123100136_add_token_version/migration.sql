/*
  Warnings:

  - You are about to drop the column `hashedRt` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `hashedRt`,
    ADD COLUMN `tokenVersion` INTEGER NOT NULL DEFAULT 1;
