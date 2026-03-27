-- AlterTable
ALTER TABLE "client_profiles"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "bio" TEXT;

-- AlterTable
ALTER TABLE "developer_profiles"
ADD COLUMN "avatarUrl" TEXT,
ADD COLUMN "bio" TEXT;
