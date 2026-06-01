require('dotenv/config')

const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter
})

async function main() {

  console.log('Iniciando seed...')

  async function ensureTemplate(sportId, template) {
    const existing = await prisma.tournamentTemplate.findFirst({
      where: {
        sportId,
        name: template.name,
        playerCount: template.playerCount,
        format: template.format,
        eliminationType: template.eliminationType,
      },
    })

    if (existing) return existing

    return prisma.tournamentTemplate.create({
      data: {
        sportId,
        ...template,
      },
    })
  }

  const sinuca = await prisma.sport.upsert({
    where: { slug: 'sinuca' },
    update: {
      name: 'Sinuca',
    },
    create: {
      name: 'Sinuca',
      slug: 'sinuca',
    },
  })

  console.log('✔ Sport criado:', sinuca.name)

  const templates = [16, 32, 64, 128]

  for (const players of templates) {

    // Mata-mata
    await ensureTemplate(sinuca.id, {
      name: `Sinuca ${players} jogadores — Mata-mata`,
      playerCount: players,
      format: 'knockout',
      eliminationType: 'single',
    })

    // Dupla eliminação
    await ensureTemplate(sinuca.id, {
      name: `Sinuca ${players} jogadores — Dupla eliminação`,
      playerCount: players,
      format: 'double',
      eliminationType: 'double',
    })
  }

  // Modo livre
  await ensureTemplate(sinuca.id, {
    name: 'Sinuca — Modo livre',
    playerCount: 0,
    format: 'custom',
    eliminationType: 'custom',
  })

  const bingo = await prisma.sport.upsert({
    where: { slug: 'bingo' },
    update: {},
    create: {
      name: 'Bingo',
      slug: 'bingo'
    }
  })

  await ensureTemplate(bingo.id, {
    name: 'Bingo — Evento livre',
    playerCount: 0,
    format: 'bingo',
    eliminationType: 'bingo',
  })

  console.log('✔ Templates criados com sucesso')
  console.log('Seed finalizado 🚀')
}

main()
  .catch((e) => {
    console.error('Erro no seed:', e)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
