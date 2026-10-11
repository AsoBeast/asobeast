ALTER TABLE "EmailAlert" ADD COLUMN     "confirmationSentAt" TIMESTAMP(3),
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);

UPDATE "EmailAlert" SET "confirmedAt" = "createdAt" WHERE "active" = true;
