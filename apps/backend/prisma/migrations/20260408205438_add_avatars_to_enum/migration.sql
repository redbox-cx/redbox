/*
  Warnings:

  - The values [EXAMPLE1,EXAMPLE2,EXAMPLE3] on the enum `User_avatar` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterTable
ALTER TABLE `User` MODIFY `avatar` ENUM('DEFAULT_AVATAR', 'avatar_robot', 'avatar_mesh_r', 'avatar_mesh_y', 'avatar_mesh_p') NOT NULL DEFAULT 'DEFAULT_AVATAR';
