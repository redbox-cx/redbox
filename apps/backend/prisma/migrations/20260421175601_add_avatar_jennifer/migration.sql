-- AlterTable
ALTER TABLE `AdminUser` MODIFY `avatar` ENUM('DEFAULT_AVATAR', 'avatar_robot', 'avatar_mesh_r', 'avatar_mesh_y', 'avatar_mesh_p', 'avatar_jennifer') NOT NULL DEFAULT 'DEFAULT_AVATAR';

-- AlterTable
ALTER TABLE `User` MODIFY `avatar` ENUM('DEFAULT_AVATAR', 'avatar_robot', 'avatar_mesh_r', 'avatar_mesh_y', 'avatar_mesh_p', 'avatar_jennifer') NOT NULL DEFAULT 'DEFAULT_AVATAR';
