const express = require('express')
const { PrismaClient } = require('@prisma/client')

const app = express()
const prisma = new PrismaClient()

app.use(express.json())

app.get('/', (req, res) => {
  res.send('ProMaster Arena API online 🚀')
})

// Criar torneio automático de sinuca
app.post('/tournament/create', async (req, res) => {
  const { name, playerCount, tableCount } = req.body

  // criar torneio
  const tournament = await prisma.tournament.create({
    data: {
      name,
      sportId: 1,
      playerCount,
      format: 'knockout',
      tableCount
    }
  })

  // criar jogadores fake (teste)
  const players = []
  for (let i = 1; i <= playerCount; i++) {
    const p = await prisma.player.create({
      data: {
        name: `Jogador ${i}`
      }
    })
    players.push(p)
  }

  // embaralhar jogadores
  players.sort(() => Math.random() - 0.5)

  // gerar partidas (primeira rodada)
  let matches = []
  let table = 1

  for (let i = 0; i < players.length; i += 2) {
    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        playerAId: players[i].id,
        playerBId: players[i + 1].id,
        round: 1,
        bracketType: 'knockout',
        tableNumber: table
      }
    })

    matches.push(match)

    table++
    if (table > tableCount) table = 1
  }

  res.json({
    tournament,
    matches
  })
})

// Listar torneios
app.get('/tournaments', async (req, res) => {
  try {
    const tournaments = await prisma.tournament.findMany({
      orderBy: { id: 'desc' }
    })
    res.json(tournaments)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar torneios' })
  }
})

// Listar partidas de um torneio
app.get('/tournaments/:id/matches', async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)

    const matches = await prisma.match.findMany({
      where: { tournamentId },
      orderBy: { round: 'asc' }
    })

    res.json(matches)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar partidas' })
  }
})

// Health check
app.get('/', (req, res) => {
  res.send('ProMaster Arena API online 🚀')
})

app.listen(3000, () => {
  console.log('API rodando na porta 3000')
})
