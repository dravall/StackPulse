-- DropForeignKey
ALTER TABLE "website" DROP CONSTRAINT "website_user_id_fkey";

-- DropForeignKey
ALTER TABLE "website_tick" DROP CONSTRAINT "website_tick_website_id_fkey";

-- AlterTable
ALTER TABLE "website_tick" ADD COLUMN     "error_message" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "region_name_key" ON "region"("name");

-- CreateIndex
CREATE UNIQUE INDEX "website_user_id_url_key" ON "website"("user_id", "url");

-- CreateIndex
CREATE INDEX "website_tick_website_id_createdAt_idx" ON "website_tick"("website_id", "createdAt");

-- AddForeignKey
ALTER TABLE "website" ADD CONSTRAINT "website_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "website_tick" ADD CONSTRAINT "website_tick_website_id_fkey" FOREIGN KEY ("website_id") REFERENCES "website"("id") ON DELETE CASCADE ON UPDATE CASCADE;

