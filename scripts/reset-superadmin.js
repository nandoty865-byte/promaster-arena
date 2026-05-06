require('dotenv/config')

const bcrypt = require('bcryptjs')
const { PrismaClient } = require('@prisma/client')
const { PrismaPg } = require('@prisma/adapter-pg')
const { Pool } = require('pg')

const email = process.argv[2]
const password = process.argv[3]
const name = process.argv[4] || 'Superadmin'

if (!email || !password) {
  console.error('Uso: node scripts/reset-superadmin.js email@dominio.com senha-forte')
  process.exit(1)
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

async function main() {
  const hashedPassword = await bcrypt.hash(password, 10)

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name,
      password: hashedPassword,
      role: 'superadmin',
      emailVerified: true,
      emailVerifyToken: null,
    },
    create: {
      name,
      email,
      password: hashedPassword,
      role: 'superadmin',
      emailVerified: true,
      emailVerifyToken: null,
    },
    select: {
      id: true,
      email: true,
      role: true,
    },
  })

  console.log('Superadmin pronto:', user.email, user.role)
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
