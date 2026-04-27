-- CreateTable
CREATE TABLE "TournamentTemplate" (
    "id" SERIAL NOT NULL,
    "sportId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "playerCount" INTEGER NOT NULL,
    "format" TEXT NOT NULL,
    "eliminationType" TEXT NOT NULL,

    CONSTRAINT "TournamentTemplate_pkey" PRIMARY KEY ("id")
);
