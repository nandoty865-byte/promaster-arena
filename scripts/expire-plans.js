require('dotenv/config')

const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  const result = await prisma.organization.updateMany({
    where: {
      plan: { in: ['pro', 'master'] },
      planExpiresAt: {
        lt: new Date(),
      },
    },
    data: {
      plan: 'free',
      planExpiresAt: null,
    },
  })

  console.log(`[expire-plans] ${result.count} plano(s) expirado(s)`)
}

main()
  .catch(error => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
    await pool.end()
  })
