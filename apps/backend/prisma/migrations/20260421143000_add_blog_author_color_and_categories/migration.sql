-- AlterTable
ALTER TABLE `BlogPost`
ADD COLUMN `categories` JSON NULL,
ADD COLUMN `authorColor` VARCHAR(20) NULL;
