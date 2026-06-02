INSERT INTO "Sport" ("name", "slug", "createdAt")
VALUES ('Sinuca', 'sinuca', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "Sport" ("name", "slug", "createdAt")
VALUES ('Bingo', 'bingo', CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "TournamentTemplate" ("sportId", "name", "playerCount", "format", "eliminationType")
SELECT sport.id, template.name, template."playerCount", template.format, template."eliminationType"
FROM "Sport" sport
CROSS JOIN (
  VALUES
    ('Sinuca 16 jogadores — Mata-mata', 16, 'knockout', 'single'),
    ('Sinuca 16 jogadores — Dupla eliminação', 16, 'double', 'double'),
    ('Sinuca 32 jogadores — Mata-mata', 32, 'knockout', 'single'),
    ('Sinuca 32 jogadores — Dupla eliminação', 32, 'double', 'double'),
    ('Sinuca 64 jogadores — Mata-mata', 64, 'knockout', 'single'),
    ('Sinuca 64 jogadores — Dupla eliminação', 64, 'double', 'double'),
    ('Sinuca 128 jogadores — Mata-mata', 128, 'knockout', 'single'),
    ('Sinuca 128 jogadores — Dupla eliminação', 128, 'double', 'double'),
    ('Sinuca — Modo livre', 0, 'custom', 'custom')
) AS template(name, "playerCount", format, "eliminationType")
WHERE sport.slug = 'sinuca'
AND NOT EXISTS (
  SELECT 1
  FROM "TournamentTemplate" existing
  WHERE existing."sportId" = sport.id
    AND existing.name = template.name
    AND existing."playerCount" = template."playerCount"
    AND existing.format = template.format
    AND existing."eliminationType" = template."eliminationType"
);

INSERT INTO "TournamentTemplate" ("sportId", "name", "playerCount", "format", "eliminationType")
SELECT sport.id, 'Bingo — Evento livre', 0, 'bingo', 'bingo'
FROM "Sport" sport
WHERE sport.slug = 'bingo'
AND NOT EXISTS (
  SELECT 1
  FROM "TournamentTemplate" existing
  WHERE existing."sportId" = sport.id
    AND existing.name = 'Bingo — Evento livre'
    AND existing."playerCount" = 0
    AND existing.format = 'bingo'
    AND existing."eliminationType" = 'bingo'
);
