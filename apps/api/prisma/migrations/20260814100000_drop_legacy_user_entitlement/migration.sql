/*
  Warnings:

  - You are about to drop the column `billingCustomerId` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `plan` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `planExpiresAt` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `trialEndsAt` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "User_billingCustomerId_key";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "billingCustomerId",
DROP COLUMN "plan",
DROP COLUMN "planExpiresAt",
DROP COLUMN "trialEndsAt";
