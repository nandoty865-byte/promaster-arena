require('dotenv/config')

const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
})

const adapter = new PrismaPg(pool)

const prisma = new PrismaClient({
  adapter,
})

const app = express()
app.use(cors())
app.use(express.json())
const JWT_SECRET = process.env.JWT_SECRET || 'promaster_dev_secret'

function auth(req, res, next) {
  const header = req.headers.authorization

  if (!header) {
    return res.status(401).json({ error: 'Token não enviado' })
  }

  const token = header.replace('Bearer ', '')

  try {
    req.user = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: 'Token inválido' })
  }
}

app.get('/', (req, res) => {
  res.send('ProMaster Arena API online 🚀')
})

// listar templates
app.get('/templates', async (req, res) => {
  const templates = await prisma.tournamentTemplate.findMany({
    orderBy: { id: 'asc' },
  })

  res.json(templates)
})

// criar torneio usando template
app.post('/tournaments/create-from-template', async (req, res) => {
  try {
    const { name, templateId, tableCount } = req.body

    const template = await prisma.tournamentTemplate.findUnique({
      where: { id: Number(templateId) },
    })

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' })
    }

    const tournament = await prisma.tournament.create({
      data: {
        name,
        sportId: template.sportId,
        playerCount: template.playerCount,
        format: template.format,
        tableCount: Number(tableCount),
        status: 'draft',
      },
    })

    const players = []

    for (let i = 1; i <= template.playerCount; i++) {
      const player = await prisma.player.create({
        data: {
          name: `Jogador ${i}`,
          tournamentId: tournament.id,
        },
      })

      players.push(player)
    }

    players.sort(() => Math.random() - 0.5)

    let table = 1
    const matches = []

    for (let i = 0; i < players.length; i += 2) {
      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          playerAId: players[i].id,
          playerBId: players[i + 1].id,
          round: 1,
          bracketType: template.eliminationType === 'double' ? 'winners' : 'knockout',
          tableNumber: table,
          status: 'pending',
        },
      })

      matches.push(match)

      table++
      if (table > Number(tableCount)) table = 1
    }

    res.json({
      ok: true,
      message: 'Torneio criado pelo template',
      tournament,
      playersCreated: players.length,
      matchesCreated: matches.length,
      matches,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar torneio' })
  }
})

// listar torneios
app.get('/tournaments', async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { id: 'desc' },
  })

  res.json(tournaments)
})

// listar partidas de um torneio
app.get('/tournaments/:id/bracket', async (req, res) => {
  const tournamentId = Number(req.params.id)

  const matches = await prisma.match.findMany({
    where: { tournamentId },
    orderBy: { round: 'asc' }
  })

  const players = await prisma.player.findMany({
    where: { tournamentId }
  })

  const playerMap = {}
  players.forEach(p => {
    playerMap[p.id] = p.name
  })

  const rounds = {}

  matches.forEach(m => {
    if (!rounds[m.round]) {
      rounds[m.round] = []
    }

    rounds[m.round].push({
  id: m.id,
  playerAId: m.playerAId,
  playerBId: m.playerBId,
  playerA: playerMap[m.playerAId],
  playerB: playerMap[m.playerBId],
  winner: playerMap[m.winnerId],
  table: m.tableNumber,
  status: m.status
})
  })

  res.json({
    rounds: Object.keys(rounds).map(r => ({
      round: Number(r),
      matches: rounds[r]
    }))
  })
})

// registrar resultado e gerar próxima rodada
app.post('/matches/:id/result', async (req, res) => {
  try {
    const matchId = Number(req.params.id)
    const { winnerId } = req.body

    const match = await prisma.match.findUnique({
      where: { id: matchId },
    })

    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada' })
    }

    const winner = Number(winnerId)

    if (winner !== match.playerAId && winner !== match.playerBId) {
      return res.status(400).json({ error: 'Vencedor inválido para esta partida' })
    }

    const loserId = winner === match.playerAId ? match.playerBId : match.playerAId

    const updatedMatch = await prisma.match.update({
      where: { id: matchId },
      data: {
        winnerId: winner,
        loserId,
        status: 'finished',
      },
    })

    const roundMatches = await prisma.match.findMany({
      where: {
        tournamentId: match.tournamentId,
        round: match.round,
      },
      orderBy: { id: 'asc' },
    })

    const allFinished = roundMatches.every(m => m.status === 'finished')

    if (allFinished) {
      const winners = roundMatches.map(m => m.winnerId).filter(Boolean)

      if (winners.length === 1) {
        await prisma.tournament.update({
          where: { id: match.tournamentId },
          data: { status: 'finished' },
        })

        return res.json({
          ok: true,
          message: 'Resultado salvo. Torneio finalizado.',
          championId: winners[0],
          match: updatedMatch,
        })
      }

      const nextRound = match.round + 1

      const existingNextRound = await prisma.match.findMany({
        where: {
          tournamentId: match.tournamentId,
          round: nextRound,
        },
      })

      if (existingNextRound.length === 0) {
        const tournament = await prisma.tournament.findUnique({
          where: { id: match.tournamentId },
        })

        let table = 1

        for (let i = 0; i < winners.length; i += 2) {
          await prisma.match.create({
            data: {
              tournamentId: match.tournamentId,
              playerAId: winners[i],
              playerBId: winners[i + 1],
              round: nextRound,
              bracketType: 'knockout',
              tableNumber: table,
              status: 'pending',
            },
          })

          table++
          if (table > tournament.tableCount) table = 1
        }
      }
    }

    res.json({
      ok: true,
      message: 'Resultado salvo',
      match: updatedMatch,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao salvar resultado' })
  }
})

app.post('/matches/:id/start', async (req, res) => {
  try {
    const matchId = Number(req.params.id)

    const match = await prisma.match.update({
      where: { id: matchId },
      data: { status: 'playing' },
    })

    res.json({
      ok: true,
      message: 'Jogo iniciado',
      match,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao iniciar jogo' })
  }
})



app.get('/tournaments/:id/ranking', async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)

    const players = await prisma.player.findMany({
      where: { tournamentId }
    })

    const matches = await prisma.match.findMany({
      where: {
        tournamentId,
        status: 'finished'
      }
    })

    const ranking = players.map(player => {
      const wins = matches.filter(m => m.winnerId === player.id).length
      const losses = matches.filter(m => m.loserId === player.id).length
      const played = wins + losses
      const winRate = played > 0 ? Math.round((wins / played) * 100) : 0

      return {
        playerId: player.id,
        name: player.name,
        wins,
        losses,
        played,
        winRate
      }
    }).sort((a, b) => b.wins - a.wins || a.losses - b.losses)

    res.json(ranking)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao gerar ranking' })
  }
})

app.post('/organizations/create', async (req, res) => {
  try {
    const { name, slug } = req.body

    const organization = await prisma.organization.create({
      data: { name, slug }
    })

    res.json({
      ok: true,
      organization
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar organização' })
  }
})

app.post('/organizations/:organizationId/tournaments/create', async (req, res) => {
  try {
    const organizationId = Number(req.params.organizationId)
    const { name, templateId, tableCount } = req.body

    const template = await prisma.tournamentTemplate.findUnique({
      where: { id: Number(templateId) },
    })

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' })
    }

    const publicSlug = `${name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    const tournament = await prisma.tournament.create({
      data: {
        name,
        sportId: template.sportId,
        playerCount: template.playerCount,
        format: template.format,
        tableCount: Number(tableCount),
        status: 'draft',
        organizationId,
        publicSlug,
      },
    })

    const players = []

    for (let i = 1; i <= template.playerCount; i++) {
      const player = await prisma.player.create({
        data: {
          name: `Jogador ${i}`,
          tournamentId: tournament.id,
        },
      })

      players.push(player)
    }

    players.sort(() => Math.random() - 0.5)

    let table = 1
    const matches = []

    for (let i = 0; i < players.length; i += 2) {
      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          playerAId: players[i].id,
          playerBId: players[i + 1].id,
          round: 1,
          bracketType: template.eliminationType === 'double' ? 'winners' : 'knockout',
          tableNumber: table,
          status: 'pending',
        },
      })

      matches.push(match)

      table++
      if (table > Number(tableCount)) table = 1
    }

    res.json({
      ok: true,
      tournament,
      publicUrl: `https://www.promasterarena.com.br/telao/${tournament.id}`,
      publicSlug,
      playersCreated: players.length,
      matchesCreated: matches.length,
      matches,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar torneio da organização' })
  }
})

app.get('/public/:slug', async (req, res) => {
  try {
    const { slug } = req.params

    const tournament = await prisma.tournament.findUnique({
      where: { publicSlug: slug },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    const players = await prisma.player.findMany({
      where: { tournamentId: tournament.id },
    })

    const matches = await prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ round: 'asc' }, { tableNumber: 'asc' }],
    })

    const playerMap = {}
    players.forEach(p => {
      playerMap[p.id] = p.name
    })

    const rounds = {}

    matches.forEach(m => {
      if (!rounds[m.round]) rounds[m.round] = []

      rounds[m.round].push({
        id: m.id,
        playerA: playerMap[m.playerAId],
        playerB: playerMap[m.playerBId],
        playerAId: m.playerAId,
        playerBId: m.playerBId,
        winner: playerMap[m.winnerId],
        table: m.tableNumber,
        status: m.status,
      })
    })

    const formattedRounds = Object.keys(rounds).map(r => ({
      round: Number(r),
      matches: rounds[r],
    }))

    res.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.publicSlug,
      },
      rounds: formattedRounds,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar torneio público' })
  }
})

app.post('/auth/register', async (req, res) => {
  try {
    const { name, email, password, organizationName } = req.body

    const exists = await prisma.user.findUnique({ where: { email } })

    if (exists) {
      return res.status(400).json({ error: 'E-mail já cadastrado' })
    }

    const slug = organizationName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: `${slug}-${Date.now()}`
      }
    })

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: 'admin',
        organizationId: organization.id
      }
    })

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: organization.id
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: organization.id
      },
      organization
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao cadastrar usuário' })
  }
})

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({
      where: { email },
      include: { organization: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    )

    res.json({
      ok: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        organizationId: user.organizationId,
        organization: user.organization
      }
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao fazer login' })
  }
})

app.get('/me', auth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { organization: true }
  })

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' })
  }

  const { password, ...safeUser } = user

  res.json({ user: safeUser })
})

app.get('/me/tournaments', auth, async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    where: {
      organizationId: req.user.organizationId
    },
    orderBy: { id: 'desc' }
  })

  res.json(tournaments)
})

app.listen(3000, () => {
  console.log('ProMaster Arena API rodando na porta 3000 🚀')
})
