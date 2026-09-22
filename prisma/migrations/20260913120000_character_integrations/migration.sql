CREATE TABLE "IntegrationClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "redirectUris" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationClient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationGrant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "refreshHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "refreshExpiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IntegrationGrant_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IntegrationCode" (
    "id" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "challenge" TEXT NOT NULL,
    "scopes" TEXT[],
    "resource" TEXT NOT NULL,
    "authVersion" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IntegrationCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IntegrationGrant_tokenHash_key" ON "IntegrationGrant"("tokenHash");
CREATE UNIQUE INDEX "IntegrationGrant_refreshHash_key" ON "IntegrationGrant"("refreshHash");
CREATE INDEX "IntegrationGrant_userId_createdAt_idx" ON "IntegrationGrant"("userId", "createdAt");
CREATE UNIQUE INDEX "IntegrationCode_codeHash_key" ON "IntegrationCode"("codeHash");
CREATE INDEX "IntegrationCode_expiresAt_idx" ON "IntegrationCode"("expiresAt");

ALTER TABLE "IntegrationGrant" ADD CONSTRAINT "IntegrationGrant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationGrant" ADD CONSTRAINT "IntegrationGrant_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "IntegrationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationCode" ADD CONSTRAINT "IntegrationCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IntegrationCode" ADD CONSTRAINT "IntegrationCode_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "IntegrationClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
