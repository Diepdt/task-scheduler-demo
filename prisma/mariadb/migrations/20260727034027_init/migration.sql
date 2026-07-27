-- CreateTable
CREATE TABLE `SyncedTask` (
    `id` INTEGER NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `expression` VARCHAR(191) NOT NULL,
    `syncedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
