ALTER TABLE "ServiceRequest"
ADD COLUMN "lastCustomerEditAt" TIMESTAMP(3);

ALTER TABLE "RequestInvitation"
ADD COLUMN "openedAt" TIMESTAMP(3);
