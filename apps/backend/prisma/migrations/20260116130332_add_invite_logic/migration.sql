/*
  Warnings:

  - You are about to alter the column `inviteCode` on the `User` table. The data in that column could be lost. The data in that column will be cast from `VarChar(100)` to `VarChar(50)`.

*/
-- AlterTable
ALTER TABLE `User` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `inviteCode` VARCHAR(50) NOT NULL;

-- CreateTable
CREATE TABLE `InviteCode` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(50) NOT NULL,
    `maxUses` INTEGER NOT NULL DEFAULT 1,
    `usedCount` INTEGER NOT NULL DEFAULT 0,
    `comment` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `InviteCode_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_inviteCode_fkey` FOREIGN KEY (`inviteCode`) REFERENCES `InviteCode`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;
