ALTER TABLE "Tournament"
ADD COLUMN "bingoMode" TEXT,
ADD COLUMN "bingoDrawMode" TEXT,
ADD COLUMN "bingoCardMode" TEXT,
ADD COLUMN "bingoMaxNumber" INTEGER NOT NULL DEFAULT 75,
ADD COLUMN "bingoCardPrice" DOUBLE PRECISION,
ADD COLUMN "bingoCardsPerParticipant" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "bingoDrawnNumbers" TEXT,
ADD COLUMN "bingoWinners" TEXT;

CREATE TABLE "BingoCard" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "playerId" INTEGER,
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerWhatsapp" TEXT,
    "numbers" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "source" TEXT NOT NULL DEFAULT 'online',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BingoCard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BingoDraw" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "roundName" TEXT,
    "number" INTEGER NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'virtual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BingoDraw_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BingoWinner" (
    "id" SERIAL NOT NULL,
    "tournamentId" INTEGER NOT NULL,
    "cardId" INTEGER,
    "roundName" TEXT,
    "winnerName" TEXT NOT NULL,
    "prize" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BingoWinner_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BingoCard_tournamentId_idx" ON "BingoCard"("tournamentId");
CREATE INDEX "BingoDraw_tournamentId_idx" ON "BingoDraw"("tournamentId");
CREATE INDEX "BingoWinner_tournamentId_idx" ON "BingoWinner"("tournamentId");

ALTER TABLE "BingoCard" ADD CONSTRAINT "BingoCard_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BingoCard" ADD CONSTRAINT "BingoCard_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BingoDraw" ADD CONSTRAINT "BingoDraw_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BingoWinner" ADD CONSTRAINT "BingoWinner_tournamentId_fkey" FOREIGN KEY ("tournamentId") REFERENCES "Tournament"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BingoWinner" ADD CONSTRAINT "BingoWinner_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "BingoCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "Sport" ("name", "slug", "createdAt")
VALUES ('Bingo', 'bingo', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "TournamentTemplate" ("sportId", "name", "playerCount", "format", "eliminationType")
SELECT "id", 'Bingo — Evento livre', 0, 'bingo', 'bingo'
FROM "Sport"
WHERE "slug" = 'bingo';
