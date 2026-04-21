-- AlterTable
ALTER TABLE `InviteCode`
ADD COLUMN `isAdminCreated` BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing admin-created rows from the previous implementation.
UPDATE `InviteCode`
SET `isAdminCreated` = true
WHERE `createdByAdminUserId` IS NOT NULL;

-- CreateIndex
CREATE INDEX `InviteCode_isAdminCreated_idx` ON `InviteCode`(`isAdminCreated`);
