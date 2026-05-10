require('dotenv/config')

const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { Pool } = require('pg')
const { PrismaPg } = require('@prisma/adapter-pg')
const cors = require('cors')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const axios = require('axios')
const { randomUUID } = require('crypto')
const crypto = require('crypto')

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

function getPlanLimits(plan) {
  const plans = {
    trial: {
      maxTournaments: 1,
      maxPlayers: 16,
      maxTeams: 0
    },
    free: {
      maxTournaments: Infinity,
      maxPlayers: 128,
      maxTeams: 32
    },
    pro: {
      maxTournaments: Infinity,
      maxPlayers: 64,
      maxTeams: 16
    },
    master: {
      maxTournaments: Infinity,
      maxPlayers: 128,
      maxTeams: 32
    },
    avulso: {
      maxTournaments: 1,
      maxPlayers: 64,
      maxTeams: 16
    }
  }

  return plans[plan] || plans.trial
}

async function advanceFinishedRounds(tournamentId, startRound) {
  let round = startRound

  while (true) {
    const roundMatches = await prisma.match.findMany({
      where: { tournamentId, round },
      orderBy: { id: 'asc' },
    })

    if (roundMatches.length === 0) return null
    if (!roundMatches.every(match => match.status === 'finished')) return null

    const winners = roundMatches.map(match => match.winnerId).filter(Boolean)

    if (winners.length === 1) {
      await prisma.tournament.update({
        where: { id: tournamentId },
        data: { status: 'finished' },
      })

      return winners[0]
    }

    const nextRound = round + 1
    const existingNextRound = await prisma.match.findMany({
      where: { tournamentId, round: nextRound },
    })

    if (existingNextRound.length > 0) {
      round = nextRound
      continue
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    })

    let table = 1

    for (let i = 0; i < winners.length; i += 2) {
      const playerAId = winners[i]
      const playerBId = winners[i + 1] || null

      await prisma.match.create({
        data: {
          tournamentId,
          playerAId,
          playerBId,
          winnerId: playerBId ? null : playerAId,
          loserId: null,
          round: nextRound,
          bracketType: 'knockout',
          tableNumber: table,
          status: playerBId ? 'pending' : 'finished',
        },
      })

      table++
      if (table > tournament.tableCount) table = 1
    }

    round = nextRound
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Não autenticado' })
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    next()
  }
}

app.post('/billing/webhook', async (req, res) => {
  try {
    const { type, data } = req.body

    if (type === 'payment') {
      const paymentId = data.id

      const response = await axios.get(
        `https://api.mercadopago.com/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
          }
        }
      )

      const payment = response.data

      if (payment.status === 'approved') {
        const orgId = payment.metadata.organizationId
        const plan = payment.metadata.plan

        if (plan === 'avulso') {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              tournamentCredits: { increment: 1 },
            },
          })
        } else {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan,
              trialEndsAt: null,
              planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
        }

        console.log(`Plano atualizado para ${plan} (org ${orgId})`)
      }
    }

await prisma.payment.updateMany({
  where: { mercadoPagoId: String(payment.id) },
  data: {
    status: 'approved',
    paidAt: new Date()
  }
})

    res.sendStatus(200)
  } catch (error) {
    console.error(error)
    res.sendStatus(500)
 }
})

app.get('/tournaments/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        organization: true,
        players: {
          orderBy: { id: 'asc' }
        }
      }
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    res.json(tournament)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar torneio' })
  }
})

app.put('/tournaments/:id/settings', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, location, eventDate, eventTime, prize, rules, youtubeUrl, players } = req.body

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    if (Array.isArray(players)) {
      const playerNames = players.map(player => String(player).trim()).filter(Boolean)
      const existingPlayers = await prisma.player.findMany({
        where: { tournamentId: id },
        orderBy: { id: 'asc' },
      })

      if (playerNames.length !== existingPlayers.length) {
        return res.status(400).json({
          error: `Mantenha exatamente ${existingPlayers.length} jogadores neste torneio.`,
        })
      }

      await Promise.all(existingPlayers.map((player, index) => (
        prisma.player.update({
          where: { id: player.id },
          data: { name: playerNames[index] },
        })
      )))
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data: {
        name: name || tournament.name,
        location: location || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventTime: eventTime || null,
        prize: prize || null,
        rules: rules || null,
        youtubeUrl: youtubeUrl || null,
      },
    })

    res.json({ ok: true, tournament: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar configurações do torneio' })
  }
})

app.get('/admin/organizations',
  auth,
  requireRole('superadmin'),
  async (req, res) => {

    const orgs = await prisma.organization.findMany({
      include: {
        users: true,
        tournaments: true
      }
    })

    res.json(orgs)
})

app.post('/admin/organization/:id/plan', auth, requireRole('superadmin'), async (req, res) => {
  const { plan } = req.body

  const allowedPlans = ['trial', 'free', 'pro', 'master']

  if (!allowedPlans.includes(plan)) {
    return res.status(400).json({ error: 'Plano inválido' })
  }

  const org = await prisma.organization.update({
    where: { id: Number(req.params.id) },
   data: {
  plan,
  trialEndsAt: plan === 'trial'
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    : null,

  planExpiresAt: (plan === 'pro' || plan === 'master')
    ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    : null
}
})

  res.json({ ok: true, org })
})

app.put('/admin/organization/:id/profile', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const organizationId = Number(req.params.id)
    const {
      name,
      email,
      phone,
      organizationName,
      street,
      number,
      complement,
      country,
      state,
      city,
    } = req.body

    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: { users: true },
    })

    if (!organization) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }

    const adminUser = organization.users.find(user => user.role === 'admin') || organization.users[0]

    if (adminUser && email && email !== adminUser.email) {
      const emailOwner = await prisma.user.findUnique({ where: { email } })

      if (emailOwner && emailOwner.id !== adminUser.id) {
        return res.status(400).json({ error: 'Este e-mail já está em uso' })
      }
    }

    if (adminUser) {
      await prisma.user.update({
        where: { id: adminUser.id },
        data: {
          name: name || adminUser.name,
          email: email || adminUser.email,
          phone: phone || null,
        },
      })
    }

    const address = [street, number, complement, city, state, country]
      .filter(Boolean)
      .join(', ')

    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        name: organizationName || organization.name,
        address: address || null,
        street: street || null,
        number: number || null,
        complement: complement || null,
        country: country || null,
        state: state || null,
        city: city || null,
      },
    })

    const updatedOrganization = await prisma.organization.findUnique({
      where: { id: organizationId },
      include: {
        users: true,
        tournaments: true,
      },
    })

    res.json({ ok: true, organization: updatedOrganization })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar cliente' })
  }
})

const uploadsDir = path.join(__dirname, 'uploads')
const logosDir = path.join(uploadsDir, 'logos')

fs.mkdirSync(logosDir, { recursive: true })

app.use('/uploads', express.static(uploadsDir))

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    cb(null, `logo-${Date.now()}${ext}`)
  }
})

const uploadLogo = multer({
  storage: logoStorage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Arquivo inválido. Envie uma imagem.'))
    }

    cb(null, true)
  },
  limits: {
    fileSize: 3 * 1024 * 1024,
  },
})

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
    const { name, templateId, tableCount, location, eventDate, eventTime, prize, rules } = req.body

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
        location,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventTime,
        prize,
        rules,
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
app.get('/tournaments', auth, requireRole('superadmin'), async (req, res) => {
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
    orderBy: [{ round: 'asc' }, { id: 'asc' }]
  })

  const players = await prisma.player.findMany({
    where: { tournamentId }
  })

  const playerMap = {}
  players.forEach(p => {
    playerMap[p.id] = p.name
  })

  const rounds = {}

  matches.forEach((m, index) => {
    if (!rounds[m.round]) {
      rounds[m.round] = []
    }

    rounds[m.round].push({
  id: m.id,
  matchNumber: index + 1,
  playerAId: m.playerAId,
  playerBId: m.playerBId,
  playerA: playerMap[m.playerAId] || 'BYE',
  playerB: playerMap[m.playerBId] || 'BYE',
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
app.post('/matches/:id/result', auth, requireRole('admin', 'operator'), async (req, res) => {
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

    const championId = await advanceFinishedRounds(match.tournamentId, match.round)

    if (championId) {
      return res.json({
        ok: true,
        message: 'Resultado salvo. Torneio finalizado.',
        championId,
        match: updatedMatch,
      })
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

app.post('/matches/:id/start', auth, requireRole('admin', 'operator'), async (req, res) => {
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

async function buildSeasonRanking(seasonId, organizationId) {
  const tournaments = await prisma.tournament.findMany({
    where: {
      seasonId,
      organizationId,
    },
    include: {
      players: true,
      matches: {
        where: { status: 'finished' },
      },
    },
    orderBy: { eventDate: 'asc' },
  })

  const rankingMap = new Map()

  function playerKey(name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }

  for (const tournament of tournaments) {
    const playerMap = {}

    tournament.players.forEach(player => {
      playerMap[player.id] = player

      const key = playerKey(player.name)
      if (!key) return

      if (!rankingMap.has(key)) {
        rankingMap.set(key, {
          name: player.name,
          tournaments: new Set(),
          wins: 0,
          losses: 0,
          played: 0,
          points: 0,
        })
      }

      rankingMap.get(key).tournaments.add(tournament.id)
    })

    tournament.matches.forEach(match => {
      const winner = playerMap[match.winnerId]
      const loser = playerMap[match.loserId]

      if (winner) {
        const key = playerKey(winner.name)
        const item = rankingMap.get(key)
        item.wins += 1
        item.played += 1
        item.points += 3
      }

      if (loser) {
        const key = playerKey(loser.name)
        const item = rankingMap.get(key)
        item.losses += 1
        item.played += 1
      }
    })
  }

  const ranking = Array.from(rankingMap.values())
    .map(item => ({
      ...item,
      tournaments: item.tournaments.size,
      winRate: item.played > 0 ? Math.round((item.wins / item.played) * 100) : 0,
    }))
    .sort((a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      a.name.localeCompare(b.name)
    )

  return {
    tournaments,
    ranking,
    champion: ranking[0] || null,
  }
}

app.get('/seasons', auth, requireRole('admin', 'operator', 'viewer'), async (req, res) => {
  try {
    const seasons = await prisma.season.findMany({
      where: { organizationId: req.user.organizationId },
      include: {
        tournaments: {
          orderBy: { eventDate: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(seasons)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar campeonatos' })
  }
})

app.post('/seasons', auth, requireRole('admin'), async (req, res) => {
  try {
    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
    })

    if (!org) {
      return res.status(404).json({ error: 'Organização não encontrada' })
    }

    if (org.plan !== 'master' && org.plan !== 'free') {
      return res.status(403).json({ error: 'Modo campeonato disponível apenas no plano Master' })
    }

    const { name, tournamentCount, playerCount, startDate, endDate, locations, rules, prize } = req.body

    if (!name || !tournamentCount || !playerCount) {
      return res.status(400).json({ error: 'Informe nome, número de torneios e número de jogadores' })
    }

    const season = await prisma.season.create({
      data: {
        organizationId: req.user.organizationId,
        name,
        tournamentCount: Number(tournamentCount),
        playerCount: Number(playerCount),
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        locations: locations || null,
        rules: rules || null,
        prize: prize || null,
        status: 'draft',
      },
    })

    res.json({ ok: true, season })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar campeonato' })
  }
})

app.get('/seasons/:id', auth, requireRole('admin', 'operator', 'viewer'), async (req, res) => {
  try {
    const seasonId = Number(req.params.id)
    const season = await prisma.season.findFirst({
      where: {
        id: seasonId,
        organizationId: req.user.organizationId,
      },
    })

    if (!season) {
      return res.status(404).json({ error: 'Campeonato não encontrado' })
    }

    const data = await buildSeasonRanking(seasonId, req.user.organizationId)

    res.json({
      season,
      tournaments: data.tournaments,
      ranking: data.ranking,
      champion: season.championName
        ? { name: season.championName, points: season.championPoints }
        : data.champion,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar campeonato' })
  }
})

app.post('/seasons/:id/finish', auth, requireRole('admin'), async (req, res) => {
  try {
    const seasonId = Number(req.params.id)
    const season = await prisma.season.findFirst({
      where: {
        id: seasonId,
        organizationId: req.user.organizationId,
      },
    })

    if (!season) {
      return res.status(404).json({ error: 'Campeonato não encontrado' })
    }

    const data = await buildSeasonRanking(seasonId, req.user.organizationId)

    if (!data.champion) {
      return res.status(400).json({ error: 'Ainda não há ranking suficiente para declarar campeão' })
    }

    const updated = await prisma.season.update({
      where: { id: seasonId },
      data: {
        status: 'finished',
        championName: data.champion.name,
        championPoints: data.champion.points,
      },
    })

    res.json({ ok: true, season: updated, champion: data.champion })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao finalizar campeonato' })
  }
})

app.post('/organizations/:organizationId/tournaments/create',
  auth,
  requireRole('admin', 'operator'),
  async (req, res) => {
  try {
    const organizationId = Number(req.params.organizationId)
    const { name, templateId, tableCount, location, eventDate, eventTime, prize, rules, youtubeUrl, seasonId } = req.body

    const template = await prisma.tournamentTemplate.findUnique({
      where: { id: Number(templateId) },
    })

    if (req.user.organizationId !== organizationId) {
  return res.status(403).json({ error: 'Acesso negado' })
}

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' })
    }

const org = await prisma.organization.findUnique({
  where: { id: organizationId }
})

if (!org) {
  return res.status(404).json({ error: 'Organização não encontrada' })
}

const currentPlan = org.plan
const limits = getPlanLimits(currentPlan)
const trialExpired = org.plan === 'trial' && org.trialEndsAt && org.trialEndsAt < new Date()
const hasTournamentCredit = (org.tournamentCredits || 0) > 0

if (trialExpired && !hasTournamentCredit) {
  return res.status(403).json({
    error: 'Seu período trial terminou. Você pode visualizar e editar torneios existentes, mas precisa fazer upgrade para criar novos torneios.'
  })
}

const tournamentsCount = await prisma.tournament.count({
  where: { organizationId }
})

const useTournamentCredit = hasTournamentCredit && (
  trialExpired || tournamentsCount >= limits.maxTournaments
)
const effectiveLimits = useTournamentCredit ? getPlanLimits('avulso') : limits

if (tournamentsCount >= limits.maxTournaments && !useTournamentCredit) {
  return res.status(403).json({
    error: `Seu plano ${currentPlan} permite apenas ${limits.maxTournaments} torneio(s).`
  })
}

if (template.playerCount > effectiveLimits.maxPlayers) {
  return res.status(403).json({
    error: `Seu plano ${useTournamentCredit ? 'avulso' : currentPlan} permite torneios até ${effectiveLimits.maxPlayers} jogadores.`
  })
}

let season = null

if (seasonId) {
  season = await prisma.season.findFirst({
    where: {
      id: Number(seasonId),
      organizationId,
    },
  })

  if (!season) {
    return res.status(404).json({ error: 'Campeonato não encontrado' })
  }

  if (org.plan !== 'master' && org.plan !== 'free') {
    return res.status(403).json({ error: 'Modo campeonato disponível apenas no plano Master' })
  }

  const seasonTournamentsCount = await prisma.tournament.count({
    where: { seasonId: season.id },
  })

  if (seasonTournamentsCount >= season.tournamentCount) {
    return res.status(403).json({ error: 'Este campeonato já atingiu o número configurado de torneios' })
  }

  if (template.playerCount > season.playerCount) {
    return res.status(403).json({ error: `A temporada foi configurada para até ${season.playerCount} jogadores.` })
  }
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
        seasonId: season ? season.id : null,
        publicSlug,
        location: location || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventTime: eventTime || null,
        prize: prize || null,
        rules: rules || null,
        youtubeUrl: youtubeUrl || null,
      },
    })

    const players = []
    const playerNames = Array.isArray(req.body.players)
      ? req.body.players.map(player => String(player).trim()).filter(Boolean)
      : []

for (const playerName of playerNames.slice(0, template.playerCount)) {

  const player = await prisma.player.create({
    data: {
      name: playerName,
      tournamentId: tournament.id,
    },
  })

  players.push(player)
}

    players.sort(() => Math.random() - 0.5)

    const playerIds = players.map(player => player.id)
    const matchCount = Math.ceil(template.playerCount / 2)

    let table = 1
    const matches = []

    for (let i = 0; i < matchCount; i++) {
      const playerAId = playerIds[i] || null
      const playerBId = playerIds[i + matchCount] || null

      if (!playerAId && !playerBId) continue

      const byeWinnerId = playerAId && !playerBId
        ? playerAId
        : !playerAId && playerBId
          ? playerBId
          : null

      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          playerAId,
          playerBId,
          winnerId: byeWinnerId,
          loserId: null,
          round: 1,
          bracketType: template.eliminationType === 'double' ? 'winners' : 'knockout',
          tableNumber: table,
          status: byeWinnerId ? 'finished' : 'pending',
        },
      })

      matches.push(match)

      table++
      if (table > Number(tableCount)) table = 1
    }

    await advanceFinishedRounds(tournament.id, 1)

    if (useTournamentCredit) {
      await prisma.organization.update({
        where: { id: organizationId },
        data: {
          tournamentCredits: { decrement: 1 },
        },
      })
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
      orderBy: [{ round: 'asc' }, { id: 'asc' }],
    })

    const playerMap = {}
    players.forEach(p => {
      playerMap[p.id] = p.name
    })

    const rounds = {}

    matches.forEach((m, index) => {
      if (!rounds[m.round]) rounds[m.round] = []

      rounds[m.round].push({
        id: m.id,
        matchNumber: index + 1,
        playerA: playerMap[m.playerAId] || 'BYE',
        playerB: playerMap[m.playerBId] || 'BYE',
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
        status: tournament.status,
        location: tournament.location,
        eventDate: tournament.eventDate,
        eventTime: tournament.eventTime,
        prize: tournament.prize,
        rules: tournament.rules,
        youtubeUrl: tournament.youtubeUrl,
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
    const { name, email, phone, address, password, organizationName } = req.body

    if (!organizationName || !email || !phone || !password) {
      return res.status(400).json({
        error: 'Nome da organização, e-mail, telefone e senha são obrigatórios'
      })
    }

    const exists = await prisma.user.findUnique({ where: { email } })

    if (exists) {
      return res.status(400).json({ error: 'E-mail já cadastrado' })
    }

    // 🔹 gerar slug
    const slug = organizationName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')

    // 🔹 criar organização
    const organization = await prisma.organization.create({
      data: {
        name: organizationName,
        slug: `${slug}-${Date.now()}`,
        address: address || null,
        plan: 'trial',
        trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxUsers: 1
      }
    })

    // 🔹 senha
    const hashedPassword = await bcrypt.hash(password, 10)

    // 🔹 criar usuário
    const user = await prisma.user.create({
      data: {
        name: name || organizationName,
        email,
        phone,
        password: hashedPassword,
        role: 'admin',
        organizationId: organization.id,
        emailVerified: true,
        emailVerifyToken: null
      }
    })

    res.json({
      ok: true,
      message: 'Conta criada. Você já pode fazer login.'
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao registrar' })
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

app.put('/me/profile', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const {
      name,
      email,
      phone,
      organizationName,
      street,
      number,
      complement,
      country,
      state,
      city,
    } = req.body

    if (email && email !== req.user.email) {
      const emailOwner = await prisma.user.findUnique({ where: { email } })

      if (emailOwner && emailOwner.id !== req.user.id) {
        return res.status(400).json({ error: 'Este e-mail já está em uso' })
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.user.id },
      data: {
        name: name || null,
        email: email || req.user.email,
        phone: phone || null,
      },
      include: { organization: true },
    })

    if (req.user.organizationId) {
      const address = [street, number, complement, city, state, country]
        .filter(Boolean)
        .join(', ')

      await prisma.organization.update({
        where: { id: req.user.organizationId },
        data: {
          name: organizationName || updatedUser.organization?.name,
          address: address || null,
          street: street || null,
          number: number || null,
          complement: complement || null,
          country: country || null,
          state: state || null,
          city: city || null,
        },
      })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { organization: true },
    })

    const { password, ...safeUser } = user

    res.json({ ok: true, user: safeUser })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar perfil' })
  }
})

app.put('/me/password', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Informe a senha atual e a nova senha' })
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres' })
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    })

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    const validPassword = await bcrypt.compare(currentPassword, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: 'Senha atual inválida' })
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.user.update({
      where: { id: req.user.id },
      data: { password: hashedPassword },
    })

    res.json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao alterar senha' })
  }
})

app.get('/me/tournaments', auth, requireRole('admin', 'operator', 'viewer'), async (req, res) => {
  const tournaments = await prisma.tournament.findMany({
    where: {
      organizationId: req.user.organizationId
    },
    include: {
      season: true,
    },
    orderBy: { id: 'desc' }
  })

  res.json(tournaments)
})

app.post('/me/logo', auth, requireRole('admin'), uploadLogo.single('logo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo não enviado' })
    }

    const logoUrl = `/api/uploads/logos/${req.file.filename}`

    const organization = await prisma.organization.update({
      where: { id: req.user.organizationId },
      data: { logoUrl }
    })

    res.json({
      ok: true,
      logoUrl,
      organization
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao enviar logo' })
  }
})

app.post('/billing/create-pix', auth, requireRole('admin'), async (req, res) => {
  try {
    const { plan } = req.body

    const plans = {
      pro: {
        title: 'Plano PRO - ProMaster Arena',
        price: 59.90
      },
      master: {
        title: 'Plano MASTER - ProMaster Arena',
        price: 89.90
      },
      avulso: {
        title: 'Torneio Avulso - ProMaster Arena',
        price: 21.90
      }
    }

    const selectedPlan = plans[plan]

    if (!selectedPlan) {
      return res.status(400).json({ error: 'Plano inválido' })
    }

    const payment = await axios.post(
      'https://api.mercadopago.com/v1/payments',
      {
        transaction_amount: selectedPlan.price,
        description: selectedPlan.title,
        payment_method_id: 'pix',
        payer: {
          email: req.user.email
        },
        metadata: {
          organizationId: req.user.organizationId,
          plan
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
          'X-Idempotency-Key': randomUUID()
        }
      }
    )

await prisma.payment.create({
  data: {
    mercadoPagoId: String(payment.data.id),
    organizationId: req.user.organizationId,
    plan,
    amount: selectedPlan.price,
    status: payment.data.status
  }
})

    res.json({
      ok: true,
      paymentId: payment.data.id,
      status: payment.data.status,
      plan,
      amount: selectedPlan.price,
      qrCode: payment.data.point_of_interaction?.transaction_data?.qr_code,
      qrCodeBase64: payment.data.point_of_interaction?.transaction_data?.qr_code_base64,
      ticketUrl: payment.data.point_of_interaction?.transaction_data?.ticket_url
    })
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao gerar Pix' })
  }
})

app.get('/billing/payment/:id/status', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const paymentId = req.params.id

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${paymentId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`
        }
      }
    )

    const payment = response.data

    if (payment.status === 'approved') {
      const orgId = payment.metadata.organization_id || payment.metadata.organizationId
      const plan = payment.metadata.plan

      if (orgId && plan) {
        if (plan === 'avulso') {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              tournamentCredits: { increment: 1 },
            },
          })
        } else {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              plan,
              trialEndsAt: null,
              planExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
            },
          })
        }
      }
    }

await prisma.payment.updateMany({
  where: { mercadoPagoId: String(payment.id) },
  data: {
    status: 'approved',
    paidAt: new Date()
  }
})

    res.json({
      ok: true,
      status: payment.status,
      statusDetail: payment.status_detail,
      plan: payment.metadata.plan
    })
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao consultar pagamento' })
  }
})

app.get('/me/payments', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: { createdAt: 'desc' },
      take: 30,
    })

    res.json(payments)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar pagamentos' })
  }
})

app.get('/admin/finance/summary', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      orderBy: { id: 'desc' }
    })

    const approved = payments.filter(p => p.status === 'approved')
    const pending = payments.filter(p => p.status === 'pending')

    const totalRevenue = approved.reduce((sum, p) => sum + p.amount, 0)
    const pendingRevenue = pending.reduce((sum, p) => sum + p.amount, 0)

    res.json({
      totalRevenue,
      pendingRevenue,
      approvedCount: approved.length,
      pendingCount: pending.length,
      payments
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar financeiro' })
  }
})

app.get('/admin/finance/monthly', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        status: 'approved',
      },
      orderBy: { paidAt: 'asc' },
    })

    const monthly = {}

    payments.forEach(payment => {
      const date = payment.paidAt || payment.createdAt
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

      if (!monthly[key]) {
        monthly[key] = 0
      }

      monthly[key] += payment.amount
    })

    res.json(
      Object.entries(monthly).map(([month, total]) => ({
        month,
        total,
      }))
    )
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar faturamento mensal' })
  }
})

app.post('/me/users/create', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, password, role = 'operator' } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios' })
    }

    const org = await prisma.organization.findUnique({
      where: { id: req.user.organizationId },
      include: { users: true }
    })

    if (!org) {
      return res.status(404).json({ error: 'Organização não encontrada' })
    }

    const allowedUsers = org.plan === 'master' || org.plan === 'free' ? 4 : 1

    if (org.users.length >= allowedUsers) {
      return res.status(403).json({
        error: `Seu plano permite até ${allowedUsers} usuário(s). Faça upgrade para adicionar mais.`
      })
    }

    const exists = await prisma.user.findUnique({
      where: { email }
    })

    if (exists) {
      return res.status(400).json({ error: 'E-mail já cadastrado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role,
        organizationId: req.user.organizationId
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true
      }
    })

    res.json({ ok: true, user })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar usuário' })
  }
})

app.get('/auth/verify-email/:token', async (req, res) => {
  try {
    const { token } = req.params

    const user = await prisma.user.findFirst({
      where: { emailVerifyToken: token }
    })

    if (!user) {
      return res.status(400).send('Token inválido')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerifyToken: null
      }
    })

    res.redirect('/login?verified=1')
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao validar e-mail')
  }
})

app.listen(3000, () => {
  console.log('ProMaster Arena API rodando na porta 3000 🚀')
})
