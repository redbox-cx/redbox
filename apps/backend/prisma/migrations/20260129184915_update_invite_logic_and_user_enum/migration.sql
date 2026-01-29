/*
  Warnings:

  - You are about to drop the column `comment` on the `InviteCode` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `InviteCode` table. All the data in the column will be lost.
  - You are about to drop the column `maxUses` on the `InviteCode` table. All the data in the column will be lost.
  - You are about to drop the column `usedCount` on the `InviteCode` table. All the data in the column will be lost.
  - You are about to drop the column `inviteCode` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `User` DROP FOREIGN KEY `User_inviteCode_fkey`;

-- DropIndex
DROP INDEX `User_inviteCode_fkey` ON `User`;

-- AlterTable
ALTER TABLE `InviteCode` DROP COLUMN `comment`,
    DROP COLUMN `createdAt`,
    DROP COLUMN `maxUses`,
    DROP COLUMN `usedCount`,
    ADD COLUMN `usage` INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE `User` DROP COLUMN `inviteCode`,
    ADD COLUMN `avatar` ENUM('DEFAULT_AVATAR', 'EXAMPLE1', 'EXAMPLE2', 'EXAMPLE3') NOT NULL DEFAULT 'DEFAULT_AVATAR',
    ADD COLUMN `issuedCodes` INTEGER NOT NULL DEFAULT 0;
