/*
  Warnings:

  - A unique constraint covering the columns `[shareToken]` on the table `File` will be added. If there are existing duplicate values, this will fail.
  - The required column `shareToken` was added to the `File` table with a prisma-level default value. This is not possible if the table is not empty. Please add this column as optional, then populate it before making it required.

*/
-- AlterTable
ALTER TABLE `File` ADD COLUMN `shareToken` VARCHAR(191) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX `File_shareToken_key` ON `File`(`shareToken`);
