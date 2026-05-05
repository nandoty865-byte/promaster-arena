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

  // Criar esporte SINUCA
  const sinuca = await prisma.sport.create({
    data: {
      name: 'Sinuca',
      slug: 'sinuca'
    }
  })

  console.log('✔ Sport criado:', sinuca.name)

  const templates = [16, 32, 64, 128]

  for (const players of templates) {

    // Mata-mata
    await prisma.tournamentTemplate.create({
      data: {
        sportId: sinuca.id,
        name: `Sinuca ${players} jogadores — Mata-mata`,
        playerCount: players,
        format: 'knockout',
        eliminationType: 'single'
      }
    })

    // Dupla eliminação
    await prisma.tournamentTemplate.create({
      data: {
        sportId: sinuca.id,
        name: `Sinuca ${players} jogadores — Dupla eliminação`,
        playerCount: players,
        format: 'double',
        eliminationType: 'double'
      }
    })
  }

  // Modo livre
  await prisma.tournamentTemplate.create({
    data: {
      sportId: sinuca.id,
      name: 'Sinuca — Modo livre',
      playerCount: 0,
      format: 'custom',
      eliminationType: 'custom'
    }
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
