const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {

  const sinuca = await prisma.sport.create({
    data: {
      name: 'Sinuca',
      slug: 'sinuca'
    }
  })

  const templates = [
    { players: 16 },
    { players: 32 },
    { players: 64 },
    { players: 128 }
  ]

  for (const t of templates) {
    await prisma.tournamentTemplate.create({
      data: {
        sportId: sinuca.id,
        name: `Sinuca ${t.players} jogadores — Mata-mata`,
        playerCount: t.players,
        format: 'knockout',
        eliminationType: 'single'
      }
    })

    await prisma.tournamentTemplate.create({
      data: {
        sportId: sinuca.id,
        name: `Sinuca ${t.players} jogadores — Dupla eliminação`,
        playerCount: t.players,
        format: 'double',
        eliminationType: 'double'
      }
    })
  }

  await prisma.tournamentTemplate.create({
    data: {
      sportId: sinuca.id,
      name: 'Sinuca — Modo livre',
      playerCount: 0,
      format: 'custom',
      eliminationType: 'custom'
    }
  })

  console.log('Seed executado 🚀')
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect())
