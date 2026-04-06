/*
  Warnings:

  - You are about to alter the column `originalName` on the `File` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.

*/
-- AlterTable
ALTER TABLE `File` MODIFY `originalName` VARCHAR(100) NOT NULL;
