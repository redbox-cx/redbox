/*
  Warnings:

  - You are about to drop the column `role` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `User` DROP COLUMN `role`;

-- CreateTable
CREATE TABLE `AdminUser` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(50) NOT NULL,
    `passwordHash` VARCHAR(100) NOT NULL,
    `avatar` ENUM('DEFAULT_AVATAR', 'avatar_robot', 'avatar_mesh_r', 'avatar_mesh_y', 'avatar_mesh_p') NOT NULL DEFAULT 'DEFAULT_AVATAR',
    `sessionKey` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `AdminUser_username_key`(`username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
