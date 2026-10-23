
require('dotenv').config()

async function createPrismaClient() {
  const { PrismaPg } = await import('@prisma/adapter-pg')
  const { PrismaClient } = await import('./generated/prisma/client.ts')

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  })

  return new PrismaClient({ adapter })
}

module.exports = { createPrismaClient }
