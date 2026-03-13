/*
  Warnings:

  - The primary key for the `InviteCode` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `Link` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.

*/
-- DropForeignKey
ALTER TABLE `File` DROP FOREIGN KEY `File_userId_fkey`;

-- DropForeignKey
ALTER TABLE `InviteCode` DROP FOREIGN KEY `InviteCode_userId_fkey`;

-- DropForeignKey
ALTER TABLE `Link` DROP FOREIGN KEY `Link_userId_fkey`;

-- DropIndex
DROP INDEX `File_userId_fkey` ON `File`;

-- DropIndex
DROP INDEX `InviteCode_userId_fkey` ON `InviteCode`;

-- DropIndex
DROP INDEX `Link_userId_fkey` ON `Link`;

-- AlterTable
ALTER TABLE `File` MODIFY `userId` VARCHAR(191) NOT NULL;

-- AlterTable
ALTER TABLE `InviteCode` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `Link` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    MODIFY `userId` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AlterTable
ALTER TABLE `User` DROP PRIMARY KEY,
    MODIFY `id` VARCHAR(191) NOT NULL,
    ADD PRIMARY KEY (`id`);

-- AddForeignKey
ALTER TABLE `InviteCode` ADD CONSTRAINT `InviteCode_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `File` ADD CONSTRAINT `File_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Link` ADD CONSTRAINT `Link_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
