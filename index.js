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
const JWT_SECRET = process.env.JWT_SECRET || 'playfinal_dev_secret'
const APP_URL = process.env.APP_URL || 'https://www.playfinal.com.br'
const RESEND_API_KEY = process.env.RESEND_API_KEY || ''
const EMAIL_PROVIDER = process.env.EMAIL_PROVIDER || 'resend'
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'suporte@playfinal.com.br'
const EMAIL_FROM = process.env.EMAIL_FROM || 'PlayFinal <avisos@email.playfinal.com.br>'
const EMAIL_REPLY_TO = process.env.EMAIL_REPLY_TO || SUPPORT_EMAIL
const EVOLUTION_API_URL = (process.env.EVOLUTION_API_URL || '').replace(/\/$/, '')
const EVOLUTION_API_KEY = process.env.EVOLUTION_API_KEY || ''
const EVOLUTION_INSTANCE = process.env.EVOLUTION_INSTANCE || ''
const PAYMENT_CONFIRM_SECRET = process.env.PAYMENT_CONFIRM_SECRET || ''
const INTEGRATION_DEFINITIONS = [
  { provider: 'evolution', label: 'Evolution API / WhatsApp' },
  { provider: 'resend', label: 'Resend / E-mail transacional' },
  { provider: 'gmail', label: 'Gmail / Google Workspace' },
  { provider: 'instagram', label: 'Instagram' },
  { provider: 'facebook', label: 'Facebook' },
  { provider: 'tiktok', label: 'TikTok' },
  { provider: 'youtube', label: 'YouTube' },
  { provider: 'mercado_pago', label: 'Mercado Pago' },
  { provider: 'outros', label: 'Outras integrações' },
]
const INTEGRATION_LABELS = INTEGRATION_DEFINITIONS.reduce((acc, item) => {
  acc[item.provider] = item.label
  return acc
}, {})

function sanitizeIntegrationConfig(config = {}) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(config)
      .filter(([key]) => /^[a-zA-Z0-9_]+$/.test(key))
      .map(([key, value]) => [key, String(value || '').slice(0, 2000)])
  )
}

function normalizePublicUrl(value) {
  const url = String(value || '').trim()
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  return `https://${url.replace(/^\/+/, '')}`
}

async function sendEmail({ to, subject, html, text }) {
  if (EMAIL_PROVIDER !== 'resend') {
    console.warn(`E-mail não enviado para ${to}: provedor ${EMAIL_PROVIDER} não suportado`)
    return { skipped: true, reason: 'Provedor de e-mail não suportado' }
  }

  if (!RESEND_API_KEY) {
    console.warn(`E-mail não enviado para ${to}: RESEND_API_KEY não configurada`)
    return { skipped: true }
  }

  try {
    const payload = {
      from: EMAIL_FROM,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text,
    }

    if (EMAIL_REPLY_TO) {
      payload.reply_to = EMAIL_REPLY_TO
    }

    const response = await axios.post(
      'https://api.resend.com/emails',
      payload,
      {
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    )

    return { ok: true, id: response.data?.id }
  } catch (error) {
    console.error('Erro ao enviar e-mail:', error.response?.data || error.message)
    return { ok: false, error: error.response?.data || error.message }
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeWhatsAppNumber(value) {
  const digits = String(value || '').replace(/\D/g, '')

  if (!digits) return ''
  if (digits.startsWith('55')) return digits
  if (digits.length === 10 || digits.length === 11) return `55${digits}`

  return digits
}

function isValidBrazilCellphone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  return /^[1-9]{2}9\d{8}$/.test(local)
}

function normalizeCpf(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 11)
}

function isValidCpf(value) {
  const digits = normalizeCpf(value)
  return digits.length === 11
}

function maskPhone(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length <= 4) return digits ? '***' : ''
  return `${digits.slice(0, 4)}*****${digits.slice(-4)}`
}

async function sendWhatsApp({ to, text }) {
  const number = normalizeWhatsAppNumber(to)

  if (!number || !text) {
    return { skipped: true, reason: 'Número ou mensagem ausente' }
  }

  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    console.warn(`WhatsApp não enviado para ${number}: Evolution API não configurada`)
    return { skipped: true, reason: 'Evolution API não configurada' }
  }

  try {
    const response = await axios.post(
      `${EVOLUTION_API_URL}/message/sendText/${EVOLUTION_INSTANCE}`,
      {
        number,
        text,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: true,
        },
      },
      {
        headers: {
          apikey: EVOLUTION_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    )

    const result = {
      ok: true,
      id: response.data?.key?.id || response.data?.message?.key?.id || null,
      status: response.data?.status || null,
      number,
    }
    console.log(`WhatsApp enviado para ${maskPhone(number)}: ${result.id || result.status || 'sem id'}`)
    return result
  } catch (error) {
    const errorData = error.response?.data || error.message
    console.error(`Erro ao enviar WhatsApp para ${maskPhone(number)}:`, errorData)
    return { ok: false, number, error: errorData }
  }
}

function deliveryLabel(result) {
  if (result?.ok) return 'sent'
  if (result?.skipped) return 'skipped'
  return 'failed'
}

function buildDeliveryResponse(emailResult, whatsAppResult) {
  const email = deliveryLabel(emailResult)
  const whatsapp = deliveryLabel(whatsAppResult)
  const delivered = [email, whatsapp].some(status => status === 'sent')

  return {
    delivered,
    delivery: {
      email,
      whatsapp,
    },
    message: delivered
      ? 'Cadastro criado. Enviamos o link de confirmação pelos canais disponíveis.'
      : 'Cadastro criado, mas não conseguimos enviar o link de confirmação. Entre em contato com o suporte.',
  }
}

function renderVerificationPage({ title, description, buttonText }) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: Arial, sans-serif; background: #0f1115; color: #f7f7f7; }
    main { width: min(420px, calc(100% - 32px)); padding: 28px; border: 1px solid #2a2f3a; border-radius: 8px; background: #171b22; }
    h1 { margin: 0 0 12px; font-size: 24px; }
    p { color: #c8ced8; line-height: 1.5; }
    button { margin-top: 12px; border: 0; border-radius: 6px; padding: 12px 16px; background: #b7ff00; color: #101010; font-weight: 700; cursor: pointer; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
    <form method="post">
      <button type="submit">${escapeHtml(buttonText)}</button>
    </form>
  </main>
</body>
</html>`
}

async function createRegistrationPixPayment(tournament, registration) {
  const amount = Number(tournament.registrationFee || 0)

  if (!amount || amount <= 0) {
    return null
  }

  if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
    throw new Error('Mercado Pago não configurado para pagamento automático')
  }

  const payment = await axios.post(
    'https://api.mercadopago.com/v1/payments',
    {
      transaction_amount: amount,
      description: `Inscrição - ${tournament.name}`,
      payment_method_id: 'pix',
      payer: {
        email: registration.email,
        first_name: registration.name,
      },
      metadata: {
        type: 'registration',
        registrationId: registration.id,
        tournamentId: tournament.id,
        organizationId: tournament.organizationId,
      },
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        'Content-Type': 'application/json',
        'X-Idempotency-Key': randomUUID(),
      },
    }
  )

  const transactionData = payment.data.point_of_interaction?.transaction_data || {}

  await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      automaticPayment: true,
      mercadoPagoId: String(payment.data.id),
      paymentStatus: payment.data.status === 'approved' ? 'paid' : 'pending',
      paymentMethod: 'pix',
      paymentTicketUrl: transactionData.ticket_url || null,
      paymentQrCode: transactionData.qr_code || null,
      paymentQrCodeBase64: transactionData.qr_code_base64 || null,
    },
  })

  return {
    paymentId: payment.data.id,
    status: payment.data.status,
    amount,
    qrCode: transactionData.qr_code,
    qrCodeBase64: transactionData.qr_code_base64,
    ticketUrl: transactionData.ticket_url,
  }
}

function parsePlayerEntry(entry) {
  const raw = String(entry || '').trim()
  if (!raw) return null
  const cleanRaw = raw.replace(/^\s*\d+[\).:-]?\s+/, '').trim()

  const angleMatch = cleanRaw.match(/^(.*?)\s*<([^>\s]+@[^>\s]+)>$/)
  if (angleMatch) {
    return {
      name: angleMatch[1].trim(),
      email: angleMatch[2].trim().toLowerCase(),
      phone: null,
    }
  }

  const parts = cleanRaw.split(/[;,]/).map(part => part.trim()).filter(Boolean)
  const emailPart = parts.find(part => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(part))
  const phonePart = parts.find(part => {
    const digits = part.replace(/\D/g, '')
    return digits.length >= 10 && digits.length <= 13
  })
  const name = parts
    .filter(part => part !== emailPart && part !== phonePart)
    .join(' ')
    .trim()

  return {
    name: name || cleanRaw,
    email: emailPart ? emailPart.toLowerCase() : null,
    phone: phonePart ? normalizeWhatsAppNumber(phonePart) : null,
  }
}

async function sendRegistrationConfirmation(tournament, registration) {
  const publicUrl = `${APP_URL}/public/${tournament.publicSlug}`
  const confirmUrl = `${APP_URL}/api/public/registrations/confirm/${registration.confirmationToken}`
  const automaticPayment = ['platform', 'both'].includes(tournament.paymentCollectionMode) &&
    Number(tournament.registrationFee || 0) > 0
  const paymentText = automaticPayment
    ? `Pagamento automático via Pix disponível na página do torneio. Valor: R$ ${Number(tournament.registrationFee).toFixed(2).replace('.', ',')}.`
    : tournament.paymentLink
      ? `Forma de pagamento da inscrição: ${tournament.paymentLink}. Após pagar, encaminhe o comprovante ao organizador do torneio para liberação do check-in.`
      : 'O organizador informará a forma de pagamento. Após pagar, encaminhe o comprovante ao organizador do torneio para liberação do check-in.'

  const emailResult = await sendEmail({
    to: registration.email,
    subject: `Confirme sua inscrição - ${tournament.name}`,
    text: `Recebemos sua inscrição no torneio ${tournament.name}. Confirme sua participação em: ${confirmUrl}. ${paymentText}`,
    html: `
      <h2>Confirme sua inscrição</h2>
      <p>Olá <strong>${escapeHtml(registration.name)}</strong>, recebemos sua inscrição no torneio <strong>${escapeHtml(tournament.name)}</strong>.</p>
      <p>Para aparecer na lista de inscritos, confirme sua participação pelo botão abaixo.</p>
      <p><a href="${confirmUrl}">Confirmar inscrição</a></p>
      <p>${escapeHtml(paymentText)}</p>
      <p><a href="${publicUrl}">Acompanhar torneio</a></p>
    `,
  })

  const whatsAppResult = await sendWhatsApp({
    to: registration.phone,
    text: `PlayFinal Arena: recebemos sua inscrição no torneio ${tournament.name}. Confirme sua participação aqui: ${confirmUrl}. ${paymentText}`,
  })

  return { emailResult, whatsAppResult }
}

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

async function optionalAuthUser(req) {
  const header = req.headers.authorization

  if (!header) return null

  const token = header.replace('Bearer ', '')

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return prisma.user.findUnique({
      where: { id: payload.id },
      include: { playerProfile: true, organization: true, roles: true },
    })
  } catch {
    return null
  }
}

function normalizeAppRole(role) {
  const normalized = String(role || '').trim().toUpperCase()
  const aliases = {
    PLAYER: 'PLAYER',
    ORGANIZER: 'ORGANIZER',
    ARENA_OWNER: 'ARENA_OWNER',
    REFEREE: 'REFEREE',
    ADMIN: 'ADMIN',
    SUPERADMIN: 'SUPERADMIN',
    OPERATOR: 'ORGANIZER',
    VIEWER: 'ORGANIZER',
  }

  return aliases[normalized] || null
}

function serializeUserRoles(user) {
  const roles = new Set()

  if (user?.role === 'superadmin') roles.add('SUPERADMIN')
  if (user?.role === 'player' || user?.playerProfile) roles.add('PLAYER')
  if (user?.organizationId && ['admin', 'operator', 'viewer'].includes(user.role)) roles.add('ORGANIZER')
  if (user?.organizationId && user.role === 'admin') roles.add('ARENA_OWNER')
  if (user?.role === 'admin') roles.add('ADMIN')

  for (const item of user?.roles || []) {
    const normalized = normalizeAppRole(item.role)
    if (normalized) roles.add(normalized)
  }

  return Array.from(roles)
}

async function ensureUserRole(userId, role) {
  const normalized = normalizeAppRole(role)
  if (!userId || !normalized) return null

  return prisma.userRole.upsert({
    where: {
      userId_role: {
        userId,
        role: normalized,
      },
    },
    update: {},
    create: {
      userId,
      role: normalized,
    },
  })
}

async function ensureUserRoles(userId, roles) {
  await Promise.all((roles || []).map(role => ensureUserRole(userId, role)))
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

function normalizeTournamentFormat(format) {
  const value = String(format || '').toLowerCase()

  if (value === 'bingo') {
    return 'bingo'
  }

  if (['double_elimination', 'double', 'dupla', 'dupla_eliminatoria', 'dupla eliminatória'].includes(value)) {
    return 'double_elimination'
  }

  if (['round_robin', 'todos_contra_todos', 'todos contra todos', 'league', 'liga'].includes(value)) {
    return 'round_robin'
  }

  if (['swiss', 'suico', 'suíço', 'modo_suico', 'modo suíço'].includes(value)) {
    return 'swiss'
  }

  return 'knockout'
}

function nextPowerOfTwo(value) {
  let slots = 1
  const target = Math.max(2, Number(value) || 2)

  while (slots < target) slots *= 2

  return slots
}

function balancedByeIndexes(matchCount, byeCount) {
  const indexes = new Set()

  if (byeCount <= 0) return indexes

  for (let i = 0; i < byeCount; i++) {
    let index = Math.round(((i + 0.5) * matchCount / byeCount) - 0.5)
    index = Math.max(0, Math.min(matchCount - 1, index))

    while (indexes.has(index) && index < matchCount - 1) index++
    while (indexes.has(index) && index > 0) index--

    indexes.add(index)
  }

  return indexes
}

function tableForIndex(index, tableCount) {
  return (index % Math.max(1, Number(tableCount) || 1)) + 1
}

const BINGO_MODES = ['virtual', 'physical', 'mixed']
const BINGO_DRAW_MODES = ['virtual', 'physical']
const BINGO_CARD_MODES = ['virtual', 'physical', 'mixed']

function normalizeBingoConfig(body = {}) {
  const bingoMode = BINGO_MODES.includes(body.bingoMode) ? body.bingoMode : 'physical'
  const requestedDrawMode = BINGO_DRAW_MODES.includes(body.bingoDrawMode) ? body.bingoDrawMode : 'virtual'
  const bingoMaxNumber = Number(body.bingoMaxNumber) === 90 ? 90 : 75
  const bingoCardMode = bingoMode === 'virtual'
    ? 'virtual'
    : bingoMode === 'mixed'
      ? 'mixed'
      : 'physical'
  const bingoDrawMode = bingoMode === 'mixed'
    ? requestedDrawMode
    : bingoMode === 'virtual'
      ? 'virtual'
      : 'physical'

  return {
    bingoMode,
    bingoDrawMode,
    bingoCardMode,
    bingoMaxNumber,
    bingoCardPrice: body.bingoCardPrice === '' || body.bingoCardPrice == null
      ? null
      : Number(body.bingoCardPrice),
    bingoCardsPerParticipant: Math.min(Math.max(Number(body.bingoCardsPerParticipant || 1), 1), 20),
  }
}

function generateBingoCardNumbers(maxNumber = 75) {
  const normalizedMax = Number(maxNumber) === 90 ? 90 : 75

  if (normalizedMax === 90) {
    const pool = Array.from({ length: 90 }, (_, index) => index + 1)
    const rows = Array.from({ length: 3 }, () => {
      const row = []

      while (row.length < 5 && pool.length > 0) {
        const index = Math.floor(Math.random() * pool.length)
        row.push(pool.splice(index, 1)[0])
      }

      return row.sort((a, b) => a - b)
    })

    return {
      type: '90-ball',
      layout: '3x5',
      rows,
    }
  }

  const columns = [
    { letter: 'B', from: 1, to: 15 },
    { letter: 'I', from: 16, to: 30 },
    { letter: 'N', from: 31, to: 45 },
    { letter: 'G', from: 46, to: 60 },
    { letter: 'O', from: 61, to: 75 },
  ]

  const cardColumns = columns.map(column => {
    const pool = Array.from({ length: column.to - column.from + 1 }, (_, index) => column.from + index)
    const values = []

    while (values.length < 5) {
      const index = Math.floor(Math.random() * pool.length)
      values.push(pool.splice(index, 1)[0])
    }

    return { letter: column.letter, values: values.sort((a, b) => a - b) }
  })

  cardColumns[2].values[2] = 'FREE'

  return {
    type: '75-ball',
    layout: '5x5',
    columns: cardColumns,
  }
}

async function requireOwnedTournament(tournamentId, organizationId) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: { sport: true },
  })

  if (!tournament) {
    const error = new Error('Torneio não encontrado')
    error.status = 404
    throw error
  }

  if (tournament.organizationId !== organizationId) {
    const error = new Error('Acesso negado')
    error.status = 403
    throw error
  }

  return tournament
}

async function advanceFinishedRounds(tournamentId, startRound) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  })

  if (!tournament) return null

  const format = normalizeTournamentFormat(tournament?.format)

  if (!['knockout', 'double_elimination'].includes(format)) return null

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
          bracketType: format === 'double_elimination' ? 'winners' : 'knockout',
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

async function createKnockoutMatches(tournament, players) {
  const matches = []
  const bracketType = normalizeTournamentFormat(tournament.format) === 'double_elimination' ? 'winners' : 'knockout'

  if (players.length === 3) {
    const firstRoundPairs = [
      [players[0], null],
      [players[1], players[2]],
    ]

    for (const [index, [playerA, playerB]] of firstRoundPairs.entries()) {
      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          playerAId: playerA?.id || null,
          playerBId: playerB?.id || null,
          winnerId: playerB ? null : playerA.id,
          loserId: null,
          round: 1,
          bracketType,
          tableNumber: tableForIndex(index, tournament.tableCount),
          status: playerB ? 'pending' : 'finished',
        },
      })

      matches.push(match)
    }

    await advanceFinishedRounds(tournament.id, 1)
    return matches
  }

  const slots = nextPowerOfTwo(players.length)
  const matchCount = slots / 2
  const byeIndexes = balancedByeIndexes(matchCount, slots - players.length)
  const queue = [...players]

  for (let i = 0; i < matchCount; i++) {
    const playerA = queue.shift() || null
    const playerB = byeIndexes.has(i) ? null : queue.shift() || null

    if (!playerA && !playerB) continue

    const byeWinnerId = playerA && !playerB
      ? playerA.id
      : !playerA && playerB
        ? playerB.id
        : null

    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        playerAId: playerA?.id || null,
        playerBId: playerB?.id || null,
        winnerId: byeWinnerId,
        loserId: null,
        round: 1,
        bracketType,
        tableNumber: tableForIndex(i, tournament.tableCount),
        status: byeWinnerId ? 'finished' : 'pending',
      },
    })

    matches.push(match)
  }

  await advanceFinishedRounds(tournament.id, 1)
  return matches
}

async function createRoundRobinMatches(tournament, players) {
  const matches = []
  const pool = players.length % 2 === 0 ? [...players] : [...players, null]
  const roundCount = pool.length - 1
  const half = pool.length / 2

  for (let round = 1; round <= roundCount; round++) {
    for (let i = 0; i < half; i++) {
      const playerA = pool[i]
      const playerB = pool[pool.length - 1 - i]

      if (!playerA || !playerB) continue

      const match = await prisma.match.create({
        data: {
          tournamentId: tournament.id,
          playerAId: playerA.id,
          playerBId: playerB.id,
          winnerId: null,
          loserId: null,
          round,
          bracketType: 'round_robin',
          tableNumber: tableForIndex(matches.length, tournament.tableCount),
          status: 'pending',
        },
      })

      matches.push(match)
    }

    const fixed = pool[0]
    const rotated = [fixed, pool[pool.length - 1], ...pool.slice(1, pool.length - 1)]
    pool.splice(0, pool.length, ...rotated)
  }

  return matches
}

async function createSwissInitialRound(tournament, players) {
  const matches = []

  for (let i = 0; i < players.length; i += 2) {
    const playerA = players[i]
    const playerB = players[i + 1] || null

    const match = await prisma.match.create({
      data: {
        tournamentId: tournament.id,
        playerAId: playerA?.id || null,
        playerBId: playerB?.id || null,
        winnerId: playerB ? null : playerA.id,
        loserId: null,
        round: 1,
        bracketType: 'swiss',
        tableNumber: tableForIndex(matches.length, tournament.tableCount),
        status: playerB ? 'pending' : 'finished',
      },
    })

    matches.push(match)
  }

  return matches
}

async function generateTournamentBracket(tournamentId, { shuffle = true } = {}) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      players: {
        orderBy: { id: 'asc' },
      },
    },
  })

  if (!tournament) {
    throw new Error('Torneio não encontrado')
  }

  const players = [...tournament.players]

  if (players.length < 2) {
    throw new Error('Adicione pelo menos 2 jogadores antes de gerar a chave')
  }

  if (players.length > tournament.playerCount) {
    throw new Error(`Este torneio permite até ${tournament.playerCount} jogadores`)
  }

  const existingMatches = await prisma.match.count({
    where: { tournamentId },
  })

  if (existingMatches > 0 && tournament.status !== 'draft') {
    throw new Error('A chave só pode ser gerada novamente antes do torneio iniciar')
  }

  if (existingMatches > 0) {
    await prisma.match.deleteMany({ where: { tournamentId } })
  }

  if (shuffle) {
    players.sort(() => Math.random() - 0.5)
  }

  const format = normalizeTournamentFormat(tournament.format)

  if (format === 'round_robin') {
    return createRoundRobinMatches(tournament, players)
  }

  if (format === 'swiss') {
    return createSwissInitialRound(tournament, players)
  }

  return createKnockoutMatches(tournament, players)
}

async function deletePlayerForRegistration(registration) {
  const filters = []

  if (registration.email) {
    filters.push({ email: registration.email })
  }

  if (registration.phone) {
    filters.push({ phone: registration.phone })
  }

  filters.push({ name: registration.name })

  await prisma.player.deleteMany({
    where: {
      tournamentId: registration.tournamentId,
      OR: filters,
    },
  })
}

async function ensurePlayerForRegistration(registration) {
  const existing = await prisma.player.findFirst({
    where: {
      tournamentId: registration.tournamentId,
      OR: [
        registration.email ? { email: registration.email } : undefined,
        registration.phone ? { phone: registration.phone } : undefined,
        { name: registration.name },
      ].filter(Boolean),
    },
  })

  if (existing) return existing

  return prisma.player.create({
    data: {
      tournamentId: registration.tournamentId,
      name: registration.name,
      email: registration.email || null,
      phone: registration.phone || null,
    },
  })
}

async function compactConfirmedRegistrationOrder(tournamentId) {
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'confirmed',
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  for (const [index, registration] of registrations.entries()) {
    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: { sortOrder: index + 1 },
    })
  }

  return prisma.tournamentRegistration.findMany({
    where: { tournamentId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

async function confirmPaidRegistration(registration) {
  const confirmedCount = await prisma.tournamentRegistration.count({
    where: {
      tournamentId: registration.tournamentId,
      status: 'confirmed',
      id: { not: registration.id },
    },
  })

  const sortOrder = registration.sortOrder || confirmedCount + 1

  const updated = await prisma.tournamentRegistration.update({
    where: { id: registration.id },
    data: {
      status: 'confirmed',
      paymentStatus: 'paid',
      checkedIn: true,
      confirmedAt: registration.confirmedAt || new Date(),
      sortOrder,
    },
  })

  await ensurePlayerForRegistration(updated)
  await compactConfirmedRegistrationOrder(registration.tournamentId)

  return prisma.tournamentRegistration.findUnique({ where: { id: registration.id } })
}

async function randomizeConfirmedRegistrationOrder(tournamentId) {
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'confirmed',
    },
  })

  const shuffled = registrations.sort(() => Math.random() - 0.5)

  for (const [index, registration] of shuffled.entries()) {
    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: { sortOrder: index + 1 },
    })
  }

  return prisma.tournamentRegistration.findMany({
    where: { tournamentId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

async function syncPlayersFromConfirmedRegistrations(tournamentId, limit) {
  const registrations = await prisma.tournamentRegistration.findMany({
    where: {
      tournamentId,
      status: 'confirmed',
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })

  await prisma.player.deleteMany({ where: { tournamentId } })

  for (const registration of registrations.slice(0, limit || undefined)) {
    await prisma.player.create({
      data: {
        tournamentId,
        name: registration.name,
        email: registration.email || null,
        phone: registration.phone || null,
      },
    })
  }
}

function manualRegistrationEmail(tournamentId, playerData, index) {
  if (playerData.email) return playerData.email

  const hash = crypto
    .createHash('sha1')
    .update(`${tournamentId}:${index}:${playerData.name}`.toLowerCase())
    .digest('hex')
    .slice(0, 12)

  return `manual-${tournamentId}-${hash}@playfinal.local`
}

async function ensureRegistrationForManualPlayer(tournamentId, playerData, index) {
  const filters = []

  if (playerData.email) filters.push({ email: playerData.email })
  if (playerData.phone) filters.push({ phone: playerData.phone })
  filters.push({ name: playerData.name })

  const existing = await prisma.tournamentRegistration.findFirst({
    where: {
      tournamentId,
      OR: filters,
    },
  })

  const data = {
    name: playerData.name,
    cpf: existing?.cpf || 'manual',
    email: existing?.email || manualRegistrationEmail(tournamentId, playerData, index),
    phone: playerData.phone || existing?.phone || 'manual',
    status: 'confirmed',
    paymentStatus: 'paid',
    checkedIn: true,
    confirmedAt: existing?.confirmedAt || new Date(),
    sortOrder: index + 1,
  }

  if (existing) {
    return prisma.tournamentRegistration.update({
      where: { id: existing.id },
      data,
    })
  }

  return prisma.tournamentRegistration.create({
    data: {
      tournamentId,
      ...data,
    },
  })
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
        const registrationId = payment.metadata?.registration_id || payment.metadata?.registrationId

        if (registrationId) {
          const registration = await prisma.tournamentRegistration.findUnique({
            where: { id: Number(registrationId) },
          })

          if (registration) {
            const prepared = await prisma.tournamentRegistration.update({
              where: { id: registration.id },
              data: {
                paymentStatus: 'paid',
                paymentMethod: 'pix',
                checkedIn: true,
              },
            })

            await confirmPaidRegistration(prepared)
          }
        }

        const orgId = payment.metadata?.organizationId
        const plan = payment.metadata?.plan

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
        await prisma.payment.updateMany({
          where: { mercadoPagoId: String(payment.id) },
          data: {
            status: 'approved',
            paidAt: new Date(),
          },
        })
      }
    }

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
        sport: true,
        organization: true,
        players: {
          orderBy: { id: 'asc' }
        },
        registrations: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }]
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
    const {
      name,
      location,
      venueAddress,
      eventDate,
      eventTime,
      prize,
      rules,
      templateId,
      playerCount,
      format,
      tableCount,
      broadcastType,
      youtubeUrl,
      obsStreamUrl,
      liveStarted,
      registrationOpen,
      registrationFee,
      paymentCollectionMode,
      paymentLink,
      matchQuantity,
      matchQuantityMode,
      scheduleMode,
      phaseSchedule,
      phaseMatchRules,
      players,
      bingoMode,
      bingoDrawMode,
      bingoCardMode,
      bingoMaxNumber,
      bingoCardPrice,
      bingoCardsPerParticipant,
    } = req.body

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: id },
    })
    let selectedTemplate = null

    if (templateId) {
      selectedTemplate = await prisma.tournamentTemplate.findUnique({
        where: { id: Number(templateId) },
      })

      if (!selectedTemplate) {
        return res.status(404).json({ error: 'Modelo não encontrado' })
      }

    }

    const nextPlayerCount = Math.max(2, Number(playerCount || selectedTemplate?.playerCount || tournament.playerCount))
    const nextFormat = normalizeTournamentFormat(format || selectedTemplate?.format || tournament.format)
    const structureChanged = (
      Number(nextPlayerCount) !== Number(tournament.playerCount) ||
      nextFormat !== normalizeTournamentFormat(tournament.format) ||
      (selectedTemplate && Number(selectedTemplate.sportId) !== Number(tournament.sportId))
    )

    if (structureChanged && existingMatches > 0) {
      return res.status(400).json({
        error: 'Não é possível alterar quantidade de inscritos ou modelo depois que a chave foi gerada.'
      })
    }

    if (tournament.organizationId) {
      const organization = await prisma.organization.findUnique({
        where: { id: tournament.organizationId },
      })
      const limits = getPlanLimits(organization?.plan)

      if (nextPlayerCount > limits.maxPlayers) {
        return res.status(403).json({
          error: `Seu plano ${organization?.plan || 'trial'} permite torneios até ${limits.maxPlayers} jogadores.`
        })
      }

      if (nextFormat === 'round_robin' && organization?.plan === 'pro' && nextPlayerCount > 64) {
        return res.status(403).json({
          error: 'No plano Pro, torneios todos contra todos são permitidos até 64 jogadores. Para acima de 64 ou Circuito PlayFinal em etapas, use o plano Master.'
        })
      }
    }

    if (Array.isArray(players)) {
      const parsedPlayers = players.map(parsePlayerEntry).filter(player => player?.name)
      const existingPlayers = await prisma.player.findMany({
        where: { tournamentId: id },
        orderBy: { id: 'asc' },
      })

      if (existingMatches > 0 && parsedPlayers.length !== existingPlayers.length) {
        return res.status(400).json({
          error: `Mantenha exatamente ${existingPlayers.length} jogadores neste torneio.`,
        })
      }

      if (existingMatches === 0) {
        await prisma.player.deleteMany({ where: { tournamentId: id } })

        for (const [index, playerData] of parsedPlayers.slice(0, nextPlayerCount).entries()) {
          await prisma.player.create({
            data: {
              tournamentId: id,
              name: playerData.name,
              email: playerData.email || null,
              phone: playerData.phone || null,
            },
          })

          await ensureRegistrationForManualPlayer(id, playerData, index)
        }
      } else {
        await Promise.all(existingPlayers.map(async (player, index) => {
          const playerData = parsedPlayers[index]

          await prisma.player.update({
            where: { id: player.id },
            data: {
              name: playerData.name,
              email: playerData.email || null,
              phone: playerData.phone || null,
            },
          })

          await ensureRegistrationForManualPlayer(id, playerData, index)
        }))
      }

      const activeKeys = parsedPlayers.slice(0, nextPlayerCount).map((playerData, index) => ({
        index,
        name: playerData.name.toLowerCase(),
        email: playerData.email || null,
        phone: playerData.phone || null,
      }))

      const existingRegistrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId: id },
      })

      await Promise.all(existingRegistrations.map(registration => {
        const orderMatch = activeKeys.find(player => (
          (player.email && registration.email === player.email) ||
          (player.phone && registration.phone === player.phone) ||
          registration.name.toLowerCase() === player.name
        ))

        return prisma.tournamentRegistration.update({
          where: { id: registration.id },
          data: {
            sortOrder: orderMatch ? orderMatch.index + 1 : null,
          },
        })
      }))
    }

    const cleanBroadcastType = ['none', 'youtube', 'obs'].includes(broadcastType)
      ? broadcastType
      : (youtubeUrl ? 'youtube' : tournament.broadcastType || 'none')
    const cleanYoutubeUrl = cleanBroadcastType === 'youtube'
      ? (youtubeUrl !== undefined ? youtubeUrl || null : tournament.youtubeUrl)
      : null
    const cleanObsStreamUrl = cleanBroadcastType === 'obs'
      ? (obsStreamUrl !== undefined ? obsStreamUrl || null : tournament.obsStreamUrl)
      : null

    const bingoData = tournament.format === 'bingo'
      ? normalizeBingoConfig({
          bingoMode,
          bingoDrawMode,
          bingoCardMode,
          bingoMaxNumber,
          bingoCardPrice,
          bingoCardsPerParticipant,
        })
      : {}

    const updated = await prisma.tournament.update({
      where: { id },
      data: {
        name: name || tournament.name,
        sportId: selectedTemplate?.sportId || tournament.sportId,
        playerCount: nextPlayerCount,
        format: nextFormat,
        tableCount: tableCount ? Math.max(1, Number(tableCount)) : tournament.tableCount,
        location: location || null,
        venueAddress: venueAddress || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventTime: eventTime || null,
        prize: prize || null,
        rules: rules || null,
        broadcastType: cleanBroadcastType,
        youtubeUrl: cleanYoutubeUrl,
        obsStreamUrl: cleanObsStreamUrl,
        liveStarted: typeof liveStarted === 'boolean' ? liveStarted : undefined,
        registrationOpen: typeof registrationOpen === 'boolean' ? registrationOpen : undefined,
        registrationFee: registrationFee === '' || registrationFee === null || registrationFee === undefined ? null : Number(registrationFee),
        paymentCollectionMode: ['manual', 'platform', 'both'].includes(paymentCollectionMode)
          ? paymentCollectionMode
          : tournament.paymentCollectionMode || 'manual',
        paymentLink: paymentLink || null,
        matchQuantity: matchQuantity === '' || matchQuantity === null || matchQuantity === undefined ? null : Number(matchQuantity),
        matchQuantityMode: matchQuantityMode || 'all',
        scheduleMode: scheduleMode || 'single_day',
        phaseSchedule: phaseSchedule || null,
        phaseMatchRules: phaseMatchRules || null,
        ...bingoData,
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
      },
      orderBy: { createdAt: 'desc' },
    })

    res.json(orgs)
})

async function buildAdminOrganizationDetails(organizationId) {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: { orderBy: { id: 'asc' } },
      tournaments: {
        include: {
          players: true,
          registrations: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!organization) {
    return null
  }

  const payments = await prisma.payment.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  })

  const tournamentCount = organization.tournaments.length
  const participantsCount = organization.tournaments.reduce((sum, tournament) => (
    sum + Math.max(tournament.players?.length || 0, tournament.registrations?.length || 0)
  ), 0)
  const registrationRevenue = organization.tournaments.reduce((sum, tournament) => {
    const fee = Number(tournament.registrationFee || 0)
    if (!fee) return sum

    const paidRegistrations = (tournament.registrations || []).filter(registration => (
      ['paid', 'approved'].includes(registration.paymentStatus)
    ))

    return sum + (paidRegistrations.length * fee)
  }, 0)
  const planRevenue = payments
    .filter(payment => payment.status === 'approved')
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0)

  return {
    organization,
    payments,
    summary: {
      tournamentCount,
      participantsCount,
      usersCount: organization.users.length,
      revenue: registrationRevenue + planRevenue,
      pendingPayments: payments.filter(payment => payment.status === 'pending').length,
      approvedPayments: payments.filter(payment => payment.status === 'approved').length,
    },
  }
}

app.get('/admin/organization/:id', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const data = await buildAdminOrganizationDetails(Number(req.params.id))

    if (!data) {
      return res.status(404).json({ error: 'Cliente não encontrado' })
    }

    res.json(data)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar cliente' })
  }
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

app.patch('/admin/organization/:id/status', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const { status } = req.body
    const allowedStatuses = ['active', 'blocked']

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' })
    }

    const org = await prisma.organization.update({
      where: { id: Number(req.params.id) },
      data: { status },
    })

    res.json({ ok: true, org })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar status do cliente' })
  }
})

app.put('/admin/organization/:id/profile', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const organizationId = Number(req.params.id)
    const {
      name,
      email,
      phone,
      password,
      organizationName,
      street,
      number,
      complement,
      country,
      state,
      city,
      documentType,
      documentNumber,
      supportedSports,
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
      const userData = {
        name: name || adminUser.name,
        email: email || adminUser.email,
        phone: phone || null,
      }

      if (password) {
        userData.password = await bcrypt.hash(password, 10)
      }

      await prisma.user.update({
        where: { id: adminUser.id },
        data: userData,
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
        documentType: documentType || null,
        documentNumber: documentNumber || null,
        supportedSports: supportedSports || null,
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
const kycDir = path.join(uploadsDir, 'kyc')

fs.mkdirSync(logosDir, { recursive: true })
fs.mkdirSync(kycDir, { recursive: true })

app.use('/uploads', express.static(uploadsDir))

const logoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logosDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `logo-${safeId}${ext}`)
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

const kycStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, kycDir)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const safeId = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `kyc-${safeId}${ext}`)
  },
})

const uploadKyc = multer({
  storage: kycStorage,
  fileFilter: (req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf'
    if (!allowed) {
      return cb(new Error('Arquivo inválido. Envie imagem ou PDF.'))
    }

    cb(null, true)
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
})

app.get('/', (req, res) => {
  res.send('PlayFinal Arena API online 🚀')
})

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

async function ensureDefaultTemplates() {
  const sinuca = await prisma.sport.upsert({
    where: { slug: 'sinuca' },
    update: { name: 'Sinuca' },
    create: { name: 'Sinuca', slug: 'sinuca' },
  })

  const bingo = await prisma.sport.upsert({
    where: { slug: 'bingo' },
    update: { name: 'Bingo' },
    create: { name: 'Bingo', slug: 'bingo' },
  })

  for (const players of [16, 32, 64, 128]) {
    await ensureTemplate(sinuca.id, {
      name: `Sinuca ${players} jogadores — Mata-mata`,
      playerCount: players,
      format: 'knockout',
      eliminationType: 'single',
    })

    await ensureTemplate(sinuca.id, {
      name: `Sinuca ${players} jogadores — Dupla eliminação`,
      playerCount: players,
      format: 'double',
      eliminationType: 'double',
    })
  }

  await ensureTemplate(sinuca.id, {
    name: 'Sinuca — Modo livre',
    playerCount: 0,
    format: 'custom',
    eliminationType: 'custom',
  })

  await ensureTemplate(bingo.id, {
    name: 'Bingo — Evento livre',
    playerCount: 0,
    format: 'bingo',
    eliminationType: 'bingo',
  })
}

// listar templates
app.get('/templates', async (req, res) => {
  await ensureDefaultTemplates()

  const templates = await prisma.tournamentTemplate.findMany({
    include: { sport: true },
    orderBy: { id: 'asc' },
  })

  res.json(templates)
})

// criar torneio usando template
app.post('/tournaments/create-from-template', async (req, res) => {
  try {
    const {
      name,
      templateId,
      playerCount,
      format,
      tableCount,
      location,
      venueAddress,
      eventDate,
      eventTime,
      prize,
      rules,
      broadcastType,
      youtubeUrl,
      obsStreamUrl,
    } = req.body

    const template = await prisma.tournamentTemplate.findUnique({
      where: { id: Number(templateId) },
    })

    if (!template) {
      return res.status(404).json({ error: 'Template não encontrado' })
    }

    const cleanBroadcastType = ['none', 'youtube', 'obs'].includes(broadcastType)
      ? broadcastType
      : (youtubeUrl ? 'youtube' : obsStreamUrl ? 'obs' : 'none')

    const tournament = await prisma.tournament.create({
      data: {
        name,
        sportId: template.sportId,
        playerCount: template.playerCount,
        format: template.format,
        tableCount: Number(tableCount),
        status: 'running',
        location,
        venueAddress: venueAddress || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventTime,
        prize,
        rules,
        broadcastType: cleanBroadcastType,
        youtubeUrl: cleanBroadcastType === 'youtube' ? youtubeUrl || null : null,
        obsStreamUrl: cleanBroadcastType === 'obs' ? obsStreamUrl || null : null,
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
  status: m.status,
  scoreA: m.scoreA,
  scoreB: m.scoreB,
  resultType: m.resultType,
  calledAt: m.calledAt,
  startedAt: m.startedAt,
  callCount: m.callCount
})
  })

  res.json({
    rounds: Object.keys(rounds).map(r => ({
      round: Number(r),
      matches: rounds[r]
    }))
  })
})

app.get('/tournaments/:id/referee', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        players: true,
        matches: {
          orderBy: [{ status: 'asc' }, { tableNumber: 'asc' }, { round: 'asc' }, { id: 'asc' }],
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const playerMap = {}
    tournament.players.forEach(player => {
      playerMap[player.id] = player
    })

    res.json({
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        publicSlug: tournament.publicSlug,
        liveStarted: tournament.liveStarted,
        tableCount: tournament.tableCount,
        matchQuantity: tournament.matchQuantity,
        matchQuantityMode: tournament.matchQuantityMode,
        phaseMatchRules: tournament.phaseMatchRules,
      },
      matches: tournament.matches.map((match, index) => ({
        id: match.id,
        matchNumber: index + 1,
        round: match.round,
        table: match.tableNumber,
        status: match.status,
        scoreA: match.scoreA,
        scoreB: match.scoreB,
        resultType: match.resultType,
        calledAt: match.calledAt,
        startedAt: match.startedAt,
        callCount: match.callCount,
        winnerId: match.winnerId,
        playerAId: match.playerAId,
        playerBId: match.playerBId,
        playerA: playerMap[match.playerAId] || null,
        playerB: playerMap[match.playerBId] || null,
      })),
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar modo árbitro' })
  }
})

// registrar resultado e gerar próxima rodada
app.post('/matches/:id/result', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const matchId = Number(req.params.id)
    const { winnerId, scoreA, scoreB, resultType = 'normal' } = req.body

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
        scoreA: Number(scoreA || 0),
        scoreB: Number(scoreB || 0),
        resultType,
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

app.patch('/matches/:id/score', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const matchId = Number(req.params.id)
    const { scoreA = 0, scoreB = 0 } = req.body

    const currentMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    })

    if (!currentMatch) {
      return res.status(404).json({ error: 'Partida não encontrada' })
    }

    if (currentMatch.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const nextScoreA = Math.max(0, Number(scoreA) || 0)
    const nextScoreB = Math.max(0, Number(scoreB) || 0)
    let matchQuantity = Number(currentMatch.tournament.matchQuantity || 0)
    if (currentMatch.tournament.matchQuantityMode === 'by_phase' && currentMatch.tournament.phaseMatchRules) {
      try {
        const rules = JSON.parse(currentMatch.tournament.phaseMatchRules)
        const phaseRule = Array.isArray(rules)
          ? rules.find(rule => Number(rule.phase) === currentMatch.round) ||
            rules
              .filter(rule => rule.appliesTo === 'until_final' && Number(rule.phase) <= currentMatch.round)
              .sort((a, b) => Number(b.phase) - Number(a.phase))[0]
          : null
        if (phaseRule?.matchQuantity) {
          matchQuantity = Number(phaseRule.matchQuantity)
        }
      } catch {
        matchQuantity = Number(currentMatch.tournament.matchQuantity || 0)
      }
    }
    const targetWins = matchQuantity > 0 ? Math.floor(matchQuantity / 2) + 1 : 0
    const reachedTargetA = targetWins > 0 && nextScoreA >= targetWins && nextScoreA > nextScoreB
    const reachedTargetB = targetWins > 0 && nextScoreB >= targetWins && nextScoreB > nextScoreA

    if (currentMatch.status !== 'finished' && (reachedTargetA || reachedTargetB)) {
      const winnerId = reachedTargetA ? currentMatch.playerAId : currentMatch.playerBId
      const loserId = reachedTargetA ? currentMatch.playerBId : currentMatch.playerAId

      const updatedMatch = await prisma.match.update({
        where: { id: matchId },
        data: {
          scoreA: nextScoreA,
          scoreB: nextScoreB,
          winnerId,
          loserId,
          status: 'finished',
          resultType: 'normal',
        },
      })

      const championId = await advanceFinishedRounds(currentMatch.tournamentId, currentMatch.round)

      return res.json({
        ok: true,
        autoFinished: true,
        championId,
        match: updatedMatch,
      })
    }

    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        scoreA: nextScoreA,
        scoreB: nextScoreB,
      },
    })

    res.json({ ok: true, autoFinished: false, match })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar placar' })
  }
})

app.post('/matches/:id/call', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const matchId = Number(req.params.id)

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    })

    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada' })
    }

    if (match.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const players = await prisma.player.findMany({
      where: {
        id: { in: [match.playerAId, match.playerBId].filter(Boolean) },
      },
    })

    const message = `PlayFinal Arena: sua partida no torneio ${match.tournament.name} foi chamada. Jogo #${match.id}, mesa ${match.tableNumber || '-'}. Compareça à mesa.`
    const results = []

    for (const player of players) {
      if (player.email) {
        results.push(await sendEmail({
          to: player.email,
          subject: `Partida chamada - ${match.tournament.name}`,
          text: message,
          html: `<p>${escapeHtml(message)}</p>`,
        }))
      }

      if (player.phone) {
        results.push(await sendWhatsApp({ to: player.phone, text: message }))
      }
    }

    const updated = await prisma.match.update({
      where: { id: matchId },
      data: {
        calledAt: new Date(),
        callCount: { increment: 1 },
      },
    })

    res.json({ ok: true, match: updated, notified: results.filter(result => result?.ok).length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao chamar partida' })
  }
})

app.post('/matches/:id/wo', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const matchId = Number(req.params.id)
    const { winnerId } = req.body

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    })

    if (!match) {
      return res.status(404).json({ error: 'Partida não encontrada' })
    }

    if (match.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
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
        resultType: 'wo',
        scoreA: winner === match.playerAId ? 1 : 0,
        scoreB: winner === match.playerBId ? 1 : 0,
      },
    })

    const championId = await advanceFinishedRounds(match.tournamentId, match.round)

    res.json({
      ok: true,
      message: championId ? 'WO salvo. Torneio finalizado.' : 'WO salvo',
      championId,
      match: updatedMatch,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao salvar WO' })
  }
})

app.post('/matches/:id/start', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const matchId = Number(req.params.id)

    const currentMatch = await prisma.match.findUnique({
      where: { id: matchId },
      include: { tournament: true },
    })

    if (!currentMatch) {
      return res.status(404).json({ error: 'Partida não encontrada' })
    }

    if (currentMatch.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const match = await prisma.match.update({
      where: { id: matchId },
      data: {
        status: 'playing',
        startedAt: currentMatch.startedAt || new Date(),
      },
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

app.get('/tournaments/:id/bingo', async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { sport: true },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Evento não encontrado' })
    }

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const [cards, draws, winners] = await Promise.all([
      prisma.bingoCard.findMany({
        where: { tournamentId },
        orderBy: { id: 'asc' },
      }),
      prisma.bingoDraw.findMany({
        where: { tournamentId },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.bingoWinner.findMany({
        where: { tournamentId },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    const currentRoundNumber = Number(tournament.bingoCurrentRound || 1)
    const currentRoundName = `Rodada ${currentRoundNumber}`
    const currentDraws = draws.filter(draw => (draw.roundName || 'Rodada 1') === currentRoundName)

    res.json({
      tournament,
      cards,
      draws,
      currentRound: {
        number: currentRoundNumber,
        name: currentRoundName,
        prize: tournament.bingoRoundPrize || currentDraws[currentDraws.length - 1]?.prize || null,
        rule: tournament.bingoRoundRule || currentDraws[currentDraws.length - 1]?.rule || null,
        status: tournament.bingoRoundStatus || 'open',
      },
      currentDraws,
      drawnNumbers: currentDraws.map(draw => draw.number),
      allDrawnNumbers: draws.map(draw => draw.number),
      winners,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar Bingo' })
  }
})

app.post('/tournaments/:id/bingo/draw', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const tournament = await requireOwnedTournament(tournamentId, req.user.organizationId)

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const maxNumber = tournament.bingoMaxNumber || 75
    if ((tournament.bingoRoundStatus || 'open') === 'closed') {
      return res.status(400).json({ error: 'A rodada atual está encerrada. Abra uma nova rodada para continuar.' })
    }

    const currentRoundNumber = Number(tournament.bingoCurrentRound || 1)
    const currentRoundName = req.body.roundName || `Rodada ${currentRoundNumber}`
    const currentRoundPrize = req.body.prize || tournament.bingoRoundPrize || null
    const currentRoundRule = req.body.rule || tournament.bingoRoundRule || null
    const source = tournament.bingoDrawMode === 'physical' && req.body.source === 'physical'
      ? 'physical'
      : 'virtual'
    const existingDraws = await prisma.bingoDraw.findMany({
      where: {
        tournamentId,
        roundName: currentRoundName,
      },
    })
    const drawnSet = new Set(existingDraws.map(draw => draw.number))

    let number = req.body.number ? Number(req.body.number) : null

    if (number) {
      if (number < 1 || number > maxNumber) {
        return res.status(400).json({ error: `Número deve estar entre 1 e ${maxNumber}` })
      }

      if (drawnSet.has(number)) {
        return res.status(400).json({ error: 'Número já sorteado' })
      }
    } else {
      const availableNumbers = Array.from({ length: maxNumber }, (_, index) => index + 1)
        .filter(item => !drawnSet.has(item))

      if (availableNumbers.length === 0) {
        return res.status(400).json({ error: 'Todos os números já foram sorteados' })
      }

      number = availableNumbers[Math.floor(Math.random() * availableNumbers.length)]
    }

    const draw = await prisma.bingoDraw.create({
      data: {
        tournamentId,
        number,
        source,
        roundName: currentRoundName,
        prize: currentRoundPrize,
        rule: currentRoundRule,
      },
    })

    res.json({ ok: true, draw })
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).json({ error: error.message || 'Erro ao sortear número' })
  }
})

app.post('/tournaments/:id/bingo/rounds', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const tournament = await requireOwnedTournament(tournamentId, req.user.organizationId)

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const roundNumber = Math.max(1, Number(req.body.roundNumber || Number(tournament.bingoCurrentRound || 1) + 1))
    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        bingoCurrentRound: roundNumber,
        bingoRoundPrize: req.body.prize || null,
        bingoRoundRule: req.body.rule || null,
        bingoRoundStatus: 'open',
      },
    })

    res.json({
      ok: true,
      currentRound: {
        number: updated.bingoCurrentRound,
        name: `Rodada ${updated.bingoCurrentRound}`,
        prize: updated.bingoRoundPrize,
        rule: updated.bingoRoundRule,
        status: updated.bingoRoundStatus,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).json({ error: error.message || 'Erro ao abrir nova rodada' })
  }
})

app.post('/tournaments/:id/bingo/rounds/prize', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const tournament = await requireOwnedTournament(tournamentId, req.user.organizationId)

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        bingoRoundPrize: req.body.prize || null,
        bingoRoundRule: req.body.rule || null,
        bingoRoundStatus: 'open',
      },
    })

    res.json({
      ok: true,
      currentRound: {
        number: updated.bingoCurrentRound || 1,
        name: `Rodada ${updated.bingoCurrentRound || 1}`,
        prize: updated.bingoRoundPrize,
        rule: updated.bingoRoundRule,
        status: updated.bingoRoundStatus,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).json({ error: error.message || 'Erro ao atualizar premio da rodada' })
  }
})

app.post('/tournaments/:id/bingo/rounds/close', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const tournament = await requireOwnedTournament(tournamentId, req.user.organizationId)

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { bingoRoundStatus: 'closed' },
    })

    res.json({
      ok: true,
      currentRound: {
        number: updated.bingoCurrentRound,
        name: `Rodada ${updated.bingoCurrentRound || 1}`,
        prize: updated.bingoRoundPrize,
        rule: updated.bingoRoundRule,
        status: updated.bingoRoundStatus,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).json({ error: error.message || 'Erro ao encerrar rodada' })
  }
})

app.post('/tournaments/:id/bingo/claim', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const tournament = await requireOwnedTournament(tournamentId, req.user.organizationId)

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const updated = await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        bingoLastClaimAt: new Date(),
        bingoLastClaimName: String(req.body.winnerName || req.body.name || 'BINGO').trim() || 'BINGO',
      },
    })

    res.json({ ok: true, tournament: updated })
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).json({ error: error.message || 'Erro ao registrar BINGO' })
  }
})

app.post('/tournaments/:id/bingo/winners', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const tournamentId = Number(req.params.id)
    const tournament = await requireOwnedTournament(tournamentId, req.user.organizationId)

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    const winnerName = String(req.body.winnerName || '').trim()

    if (!winnerName) {
      return res.status(400).json({ error: 'Informe o nome do ganhador' })
    }

    const winner = await prisma.bingoWinner.create({
      data: {
        tournamentId,
        cardId: req.body.cardId ? Number(req.body.cardId) : null,
        roundName: req.body.roundName || 'Rodada principal',
        winnerName,
        prize: req.body.prize || null,
        rule: req.body.rule || tournament.bingoRoundRule || null,
      },
    })

    res.json({ ok: true, winner })
  } catch (error) {
    console.error(error)
    res.status(error.status || 500).json({ error: error.message || 'Erro ao registrar ganhador' })
  }
})

app.post('/public/:slug/bingo/cards', async (req, res) => {
  try {
    const { slug } = req.params
    const tournament = await prisma.tournament.findUnique({
      where: { publicSlug: slug },
      include: { sport: true },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Evento não encontrado' })
    }

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    if (!['virtual', 'mixed'].includes(tournament.bingoCardMode || 'physical')) {
      return res.status(400).json({ error: 'Este Bingo não aceita cartelas online' })
    }

    const buyerName = String(req.body.name || '').trim()
    const buyerEmail = String(req.body.email || '').trim() || null
    const buyerWhatsapp = String(req.body.whatsapp || '').replace(/\D/g, '') || null
    const limitPerParticipant = Math.max(Number(tournament.bingoCardsPerParticipant || 1), 1)
    const requestedQuantity = Math.max(Number(req.body.quantity || 1), 1)

    if (!buyerName) {
      return res.status(400).json({ error: 'Informe o nome do participante' })
    }

    if (requestedQuantity > limitPerParticipant) {
      return res.status(400).json({
        error: `Este Bingo permite no máximo ${limitPerParticipant} cartela(s) por participante.`,
      })
    }

    const participantFilters = []

    if (buyerEmail) participantFilters.push({ buyerEmail })
    if (buyerWhatsapp) participantFilters.push({ buyerWhatsapp })
    if (participantFilters.length === 0) participantFilters.push({ buyerName })

    const existingCards = await prisma.bingoCard.count({
      where: {
        tournamentId: tournament.id,
        OR: participantFilters,
      },
    })

    if (existingCards + requestedQuantity > limitPerParticipant) {
      return res.status(400).json({
        error: `Este participante já atingiu o limite de ${limitPerParticipant} cartela(s).`,
      })
    }

    const cards = []

    for (let i = 0; i < requestedQuantity; i++) {
      cards.push(await prisma.bingoCard.create({
        data: {
          tournamentId: tournament.id,
          buyerName,
          buyerEmail,
          buyerWhatsapp,
          numbers: JSON.stringify(generateBingoCardNumbers(tournament.bingoMaxNumber || 75)),
          status: 'pending',
          source: 'online',
        },
      }))
    }

    res.json({
      ok: true,
      message: 'Cartela reservada. A confirmação do pagamento será vinculada na próxima etapa.',
      cards,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao reservar cartela' })
  }
})

app.post('/public/:slug/bingo/claim', async (req, res) => {
  try {
    const { slug } = req.params
    const tournament = await prisma.tournament.findUnique({
      where: { publicSlug: slug },
      include: { sport: true },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Evento não encontrado' })
    }

    if (tournament.format !== 'bingo' && tournament.sport?.slug !== 'bingo') {
      return res.status(400).json({ error: 'Este evento não é Bingo' })
    }

    if (!['virtual', 'mixed'].includes(tournament.bingoCardMode || 'physical')) {
      return res.status(400).json({ error: 'Este Bingo não aceita BINGO virtual' })
    }

    const updated = await prisma.tournament.update({
      where: { id: tournament.id },
      data: {
        bingoLastClaimAt: new Date(),
        bingoLastClaimName: String(req.body.name || 'Participante online').trim() || 'Participante online',
      },
    })

    res.json({ ok: true, tournament: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao registrar BINGO virtual' })
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
    const tournamentScoreMap = new Map()

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
      tournamentScoreMap.set(key, {
        key,
        name: player.name,
        wins: 0,
        losses: 0,
      })
    })

    tournament.matches.forEach(match => {
      const winner = playerMap[match.winnerId]
      const loser = playerMap[match.loserId]

      if (winner) {
        const key = playerKey(winner.name)
        const item = rankingMap.get(key)
        item.wins += 1
        item.played += 1
        const tournamentScore = tournamentScoreMap.get(key)
        if (tournamentScore) tournamentScore.wins += 1
      }

      if (loser) {
        const key = playerKey(loser.name)
        const item = rankingMap.get(key)
        item.losses += 1
        item.played += 1
        const tournamentScore = tournamentScoreMap.get(key)
        if (tournamentScore) tournamentScore.losses += 1
      }
    })

    const stagePoints = [100, 80, 60]
    Array.from(tournamentScoreMap.values())
      .filter(item => item.wins > 0 || item.losses > 0)
      .sort((a, b) => b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name))
      .forEach((item, index) => {
        const rankingItem = rankingMap.get(item.key)
        if (!rankingItem) return

        const points = stagePoints[index] || (index < 8 ? 40 : index < 16 ? 20 : 5)
        rankingItem.points += points
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

function parseCurrencyAmount(value) {
  const normalized = String(value || '')
    .replace(/[^\d,.-]/g, '')
    .replace(/\.(?=\d{3})/g, '')
    .replace(',', '.')
  const amount = Number(normalized)
  return Number.isFinite(amount) ? amount : 0
}

function formatCurrencyAmount(value) {
  return Number(value || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  })
}

function aggregateRankings(rankings) {
  const map = new Map()

  rankings.flat().forEach(item => {
    const key = String(item.name || '').trim().toLowerCase()
    if (!key) return

    if (!map.has(key)) {
      map.set(key, {
        name: item.name,
        points: 0,
        wins: 0,
        losses: 0,
        played: 0,
        tournaments: 0,
      })
    }

    const current = map.get(key)
    current.points += Number(item.points || 0)
    current.wins += Number(item.wins || 0)
    current.losses += Number(item.losses || 0)
    current.played += Number(item.played || 0)
    current.tournaments += Number(item.tournaments || 0)
  })

  return Array.from(map.values())
    .map(item => ({
      ...item,
      winRate: item.played > 0 ? Math.round((item.wins / item.played) * 100) : 0,
    }))
    .sort((a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.winRate - a.winRate ||
      a.name.localeCompare(b.name)
    )
}

async function buildSeasonExecutiveDashboard(organizationId) {
  const seasons = await prisma.season.findMany({
    where: { organizationId },
    include: {
      tournaments: {
        include: {
          players: true,
          matches: true,
          registrations: true,
        },
        orderBy: { eventDate: 'asc' },
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  const rankings = []
  for (const season of seasons) {
    const seasonRanking = await buildSeasonRanking(season.id, organizationId)
    rankings.push(seasonRanking.ranking)
  }

  const allTournaments = seasons.flatMap(season => season.tournaments)
  const playerNames = new Set()
  const arenas = new Map()
  let prizeTotal = 0
  let revenue = 0
  let paidRevenue = 0
  let pendingRevenue = 0
  let confirmedPayments = 0
  let pendingPayments = 0
  let approvedRegistrations = 0
  let waitingRegistrations = 0

  seasons.forEach(season => {
    prizeTotal += parseCurrencyAmount(season.prize)
  })

  allTournaments.forEach(tournament => {
    prizeTotal += parseCurrencyAmount(tournament.prize)

    tournament.players.forEach(player => {
      if (player.name) playerNames.add(player.name.trim().toLowerCase())
    })

    tournament.registrations.forEach(registration => {
      if (registration.name) playerNames.add(registration.name.trim().toLowerCase())
      const amount = Number(tournament.registrationFee || 0)
      revenue += amount

      if (['paid', 'pago', 'confirmed'].includes(String(registration.paymentStatus || '').toLowerCase())) {
        paidRevenue += amount
        confirmedPayments += 1
      } else {
        pendingRevenue += amount
        pendingPayments += 1
      }

      if (['confirmed', 'confirmado'].includes(String(registration.status || '').toLowerCase())) {
        approvedRegistrations += 1
      } else {
        waitingRegistrations += 1
      }
    })

    const arenaName = tournament.location || 'Arena a definir'
    if (!arenas.has(arenaName)) {
      arenas.set(arenaName, {
        arena: arenaName,
        events: 0,
        players: new Set(),
      })
    }

    const arena = arenas.get(arenaName)
    arena.events += 1
    tournament.players.forEach(player => {
      if (player.name) arena.players.add(player.name.trim().toLowerCase())
    })
    tournament.registrations.forEach(registration => {
      if (registration.name) arena.players.add(registration.name.trim().toLowerCase())
    })
  })

  const stagesDone = allTournaments.filter(tournament =>
    ['finished', 'closed', 'ended'].includes(String(tournament.status || '').toLowerCase())
  ).length
  const stagesOpen = allTournaments.filter(tournament => tournament.registrationOpen).length
  const stagesRunning = allTournaments.filter(tournament =>
    ['running', 'in_progress', 'playing'].includes(String(tournament.status || '').toLowerCase())
  ).length
  const stagesClosed = allTournaments.filter(tournament =>
    ['finished', 'closed', 'ended'].includes(String(tournament.status || '').toLowerCase())
  ).length
  const stagesTotal = seasons.reduce((sum, season) => sum + Number(season.tournamentCount || 0), 0) || allTournaments.length
  const allMatches = allTournaments.flatMap(tournament => tournament.matches)
  const ranking = aggregateRankings(rankings)

  const calendar = allTournaments
    .slice()
    .sort((a, b) => new Date(a.eventDate || a.createdAt).getTime() - new Date(b.eventDate || b.createdAt).getTime())
    .slice(0, 12)
    .map(tournament => ({
      id: tournament.id,
      name: tournament.name,
      location: tournament.location,
      eventDate: tournament.eventDate,
      status: tournament.status,
      registrationOpen: tournament.registrationOpen,
      liveStarted: tournament.liveStarted,
    }))

  const circuits = seasons.map(season => {
    const tournaments = season.tournaments || []
    const finished = tournaments.filter(tournament =>
      ['finished', 'closed', 'ended'].includes(String(tournament.status || '').toLowerCase())
    ).length
    const hasLive = tournaments.some(tournament =>
      ['running', 'in_progress', 'playing'].includes(String(tournament.status || '').toLowerCase()) || tournament.liveStarted
    )

    return {
      id: season.id,
      name: season.name,
      status: season.status,
      stagesDone: finished,
      stagesTotal: season.tournamentCount,
      nextStage: tournaments.find(tournament =>
        !['finished', 'closed', 'ended', 'canceled', 'cancelled'].includes(String(tournament.status || '').toLowerCase())
      )?.name || null,
      visualStatus: hasLive ? 'running' : finished >= Number(season.tournamentCount || 0) ? 'finished' : 'next',
    }
  })

  return {
    kpis: {
      players: playerNames.size,
      circuits: seasons.length,
      stagesDone,
      stagesTotal,
      prizeTotal: formatCurrencyAmount(prizeTotal),
      matches: allMatches.length,
      arenas: arenas.size,
    },
    ranking: ranking.slice(0, 20),
    raceToMasters: {
      classified: ranking.slice(0, 16),
      bubble: ranking.slice(16, 25),
      outsideCount: Math.max(0, ranking.length - 25),
    },
    calendar,
    circuits,
    finance: {
      revenue: formatCurrencyAmount(revenue),
      paidRevenue: formatCurrencyAmount(paidRevenue),
      pendingRevenue: formatCurrencyAmount(pendingRevenue),
      prizeTotal: formatCurrencyAmount(prizeTotal),
      estimatedResult: formatCurrencyAmount(revenue - prizeTotal),
    },
    operational: {
      stagesOpen,
      stagesRunning,
      stagesClosed,
      paymentsConfirmed: confirmedPayments,
      paymentsPending: pendingPayments,
      registrationsApproved: approvedRegistrations,
      registrationsWaiting: waitingRegistrations,
      transmissions: allTournaments.filter(tournament => tournament.liveStarted).length,
    },
    arenas: Array.from(arenas.values())
      .map(item => ({
        arena: item.arena,
        events: item.events,
        players: item.players.size,
      }))
      .sort((a, b) => b.events - a.events || b.players - a.players)
      .slice(0, 8),
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
    res.status(500).json({ error: 'Erro ao carregar circuitos' })
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
      return res.status(403).json({ error: 'Circuito PlayFinal disponível apenas no plano Master' })
    }

    const { name, tournamentCount, playerCount, startDate, endDate, locations, rules, prize } = req.body

    if (!name || !tournamentCount || !playerCount) {
      return res.status(400).json({ error: 'Informe nome, número de etapas e número de jogadores' })
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
    res.status(500).json({ error: 'Erro ao criar circuito' })
  }
})

app.get('/seasons/overview', auth, requireRole('admin', 'operator', 'viewer'), async (req, res) => {
  try {
    const dashboard = await buildSeasonExecutiveDashboard(req.user.organizationId)
    res.json(dashboard)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar dashboard da temporada' })
  }
})

app.get('/arenas', auth, requireRole('admin', 'operator', 'viewer'), async (req, res) => {
  try {
    const arenas = await prisma.arena.findMany({
      where: { organizationId: req.user.organizationId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    })

    res.json(arenas)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar arenas' })
  }
})

app.post('/arenas', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const {
      name,
      website,
      phone,
      email,
      country,
      zipCode,
      street,
      number,
      complement,
      neighborhood,
      city,
      state,
      responsibleName,
      responsibleCpf,
      responsiblePhone,
    } = req.body

    if (!name) {
      return res.status(400).json({ error: 'Informe o nome do local' })
    }

    const arena = await prisma.arena.create({
      data: {
        organizationId: req.user.organizationId,
        name,
        website: website || null,
        phone: phone || null,
        email: email || null,
        country: country || null,
        zipCode: zipCode || null,
        street: street || null,
        number: number || null,
        complement: complement || null,
        neighborhood: neighborhood || null,
        city: city || null,
        state: state || null,
        responsibleName: responsibleName || null,
        responsibleCpf: responsibleCpf || null,
        responsiblePhone: responsiblePhone || null,
      },
    })

    res.json({ ok: true, arena })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao cadastrar arena' })
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
      return res.status(404).json({ error: 'Circuito não encontrado' })
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
    res.status(500).json({ error: 'Erro ao carregar circuito' })
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
      return res.status(404).json({ error: 'Circuito não encontrado' })
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
    res.status(500).json({ error: 'Erro ao finalizar circuito' })
  }
})

app.post('/organizations/:organizationId/tournaments/create',
  auth,
  requireRole('admin', 'operator'),
  async (req, res) => {
  try {
    const organizationId = Number(req.params.organizationId)
    const {
      name,
      templateId,
      playerCount,
      format,
      tableCount,
      location,
      venueAddress,
      eventDate,
      eventTime,
      prize,
      rules,
      broadcastType,
      youtubeUrl,
      obsStreamUrl,
      seasonId,
      registrationOpen,
      registrationFee,
      paymentCollectionMode,
      paymentLink,
      matchQuantity,
      matchQuantityMode,
      scheduleMode,
      phaseSchedule,
      phaseMatchRules,
      bingoMode,
      bingoDrawMode,
      bingoCardMode,
      bingoMaxNumber,
      bingoCardPrice,
      bingoCardsPerParticipant,
    } = req.body

    if (req.user.organizationId !== organizationId) {
  return res.status(403).json({ error: 'Acesso negado' })
}

    let template = null

    if (templateId) {
      template = await prisma.tournamentTemplate.findUnique({
        where: { id: Number(templateId) },
        include: { sport: true },
      })

      if (!template) {
        return res.status(404).json({ error: 'Template não encontrado' })
      }
    }

    if (!template) {
      template = await prisma.tournamentTemplate.findFirst({
        orderBy: { id: 'asc' },
      })
    }

    let sportId = template?.sportId

    if (!sportId) {
      const sport = await prisma.sport.findFirst({ orderBy: { id: 'asc' } })
      sportId = sport?.id
    }

    if (!sportId) {
      return res.status(400).json({ error: 'Cadastre um esporte antes de criar torneios' })
    }

    const requestedPlayerCount = Math.max(2, Number(playerCount || template?.playerCount || 16))
    const requestedFormat = normalizeTournamentFormat(format || template?.format || 'knockout')

    if (requestedFormat === 'bingo') {
      const bingoSport = await prisma.sport.findUnique({ where: { slug: 'bingo' } })
      if (bingoSport) sportId = bingoSport.id
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

if (requestedPlayerCount > effectiveLimits.maxPlayers) {
  return res.status(403).json({
    error: `Seu plano ${useTournamentCredit ? 'avulso' : currentPlan} permite torneios até ${effectiveLimits.maxPlayers} jogadores.`
  })
}

if (requestedFormat === 'round_robin' && currentPlan === 'pro' && requestedPlayerCount > 64) {
  return res.status(403).json({
    error: 'No plano Pro, torneios todos contra todos são permitidos até 64 jogadores. Para acima de 64 ou Circuito PlayFinal em etapas, use o plano Master.'
  })
}

const isBingo = requestedFormat === 'bingo' || template?.format === 'bingo' || template?.sport?.slug === 'bingo'
const bingoData = isBingo
  ? normalizeBingoConfig({
      bingoMode,
      bingoDrawMode,
      bingoCardMode,
      bingoMaxNumber,
      bingoCardPrice,
      bingoCardsPerParticipant,
    })
  : {}

let season = null

if (seasonId) {
  season = await prisma.season.findFirst({
    where: {
      id: Number(seasonId),
      organizationId,
    },
  })

  if (!season) {
    return res.status(404).json({ error: 'Circuito não encontrado' })
  }

  if (org.plan !== 'master' && org.plan !== 'free') {
    return res.status(403).json({ error: 'Circuito PlayFinal disponível apenas no plano Master' })
  }

  const seasonTournamentsCount = await prisma.tournament.count({
    where: { seasonId: season.id },
  })

  if (seasonTournamentsCount >= season.tournamentCount) {
    return res.status(403).json({ error: 'Este circuito já atingiu o número configurado de etapas' })
  }

  if (requestedPlayerCount > season.playerCount) {
    return res.status(403).json({ error: `O circuito foi configurado para até ${season.playerCount} jogadores.` })
  }
}

    const publicSlug = `${name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')}-${Date.now()}`

    const cleanBroadcastType = ['none', 'youtube', 'obs'].includes(broadcastType)
      ? broadcastType
      : (youtubeUrl ? 'youtube' : obsStreamUrl ? 'obs' : 'none')

    const tournament = await prisma.tournament.create({
      data: {
        name,
        sportId,
        playerCount: requestedPlayerCount,
        format: requestedFormat,
        tableCount: Number(tableCount),
        status: 'draft',
        organizationId,
        seasonId: season ? season.id : null,
        publicSlug,
        location: location || null,
        venueAddress: venueAddress || null,
        eventDate: eventDate ? new Date(eventDate) : null,
        eventTime: eventTime || null,
        prize: prize || null,
        rules: rules || null,
        broadcastType: cleanBroadcastType,
        youtubeUrl: cleanBroadcastType === 'youtube' ? youtubeUrl || null : null,
        obsStreamUrl: cleanBroadcastType === 'obs' ? obsStreamUrl || null : null,
        registrationOpen: registrationOpen !== undefined ? Boolean(registrationOpen) : true,
        registrationFee: registrationFee === '' || registrationFee === null || registrationFee === undefined ? null : Number(registrationFee),
        paymentCollectionMode: ['manual', 'platform', 'both'].includes(paymentCollectionMode)
          ? paymentCollectionMode
          : 'manual',
        paymentLink: paymentLink || null,
        liveStarted: false,
        matchQuantity: matchQuantity === '' || matchQuantity === null || matchQuantity === undefined ? null : Number(matchQuantity),
        matchQuantityMode: matchQuantityMode || 'all',
        scheduleMode: scheduleMode || 'single_day',
        phaseSchedule: phaseSchedule || null,
        phaseMatchRules: phaseMatchRules || null,
        ...bingoData,
      },
    })

    const players = []
    const parsedPlayers = Array.isArray(req.body.players)
      ? req.body.players.map(parsePlayerEntry).filter(player => player?.name)
      : []

for (const playerData of parsedPlayers.slice(0, requestedPlayerCount)) {

  const player = await prisma.player.create({
    data: {
      name: playerData.name,
      email: playerData.email || null,
      phone: playerData.phone || null,
      tournamentId: tournament.id,
    },
  })

  players.push(player)
}

    if (isBingo) {
      players.length = 0
    }
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
      publicUrl: `${APP_URL}/telao/${tournament.id}`,
      publicSlug,
      playersCreated: players.length,
      matchesCreated: 0,
      matches: [],
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: `Erro ao criar torneio da organização: ${error.message || 'falha interna'}`
    })
  }
})

app.get('/public/social-links', async (req, res) => {
  try {
    const providers = ['instagram', 'facebook', 'tiktok', 'youtube']
    const settings = await prisma.integrationSetting.findMany({
      where: {
        provider: { in: providers },
        enabled: true,
      },
    })

    res.json(
      settings
        .map(setting => {
          const config = setting.config || {}
          const url = normalizePublicUrl(
            config.profileUrl ||
            config.pageUrl ||
            config.channelUrl ||
            config.url
          )

          return url
            ? {
                provider: setting.provider,
                label: setting.label,
                url,
              }
            : null
        })
        .filter(Boolean)
    )
  } catch (error) {
    console.error(error)
    res.json([])
  }
})

app.get('/public/:slug', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')

    const { slug } = req.params

    const tournament = await prisma.tournament.findUnique({
      where: { publicSlug: slug },
      include: { organization: true, sport: true },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    const isBingo = tournament.format === 'bingo' || tournament.sport?.slug === 'bingo'

    const players = await prisma.player.findMany({
      where: { tournamentId: tournament.id },
    })

    const matches = await prisma.match.findMany({
      where: { tournamentId: tournament.id },
      orderBy: [{ round: 'asc' }, { id: 'asc' }],
    })

    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId: tournament.id,
        status: { in: ['confirmed', 'waiting'] },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const [bingoCards, bingoDraws, bingoWinners] = isBingo
      ? await Promise.all([
          prisma.bingoCard.findMany({
            where: { tournamentId: tournament.id },
            orderBy: { id: 'asc' },
          }),
          prisma.bingoDraw.findMany({
            where: { tournamentId: tournament.id },
            orderBy: { createdAt: 'asc' },
          }),
          prisma.bingoWinner.findMany({
            where: { tournamentId: tournament.id },
            orderBy: { createdAt: 'desc' },
          }),
        ])
      : [[], [], []]

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
        venueAddress: tournament.venueAddress,
        eventDate: tournament.eventDate,
        eventTime: tournament.eventTime,
        prize: tournament.prize,
        rules: tournament.rules,
        broadcastType: tournament.broadcastType,
        youtubeUrl: tournament.youtubeUrl,
        obsStreamUrl: tournament.obsStreamUrl,
        playerCount: tournament.playerCount,
        registrationOpen: tournament.registrationOpen,
        registrationFee: tournament.registrationFee,
        paymentLink: tournament.paymentLink,
        paymentCollectionMode: tournament.paymentCollectionMode || 'manual',
        liveStarted: tournament.liveStarted,
        matchQuantity: tournament.matchQuantity,
        matchQuantityMode: tournament.matchQuantityMode,
        scheduleMode: tournament.scheduleMode,
        phaseSchedule: tournament.phaseSchedule,
        phaseMatchRules: tournament.phaseMatchRules,
        format: tournament.format,
        sport: tournament.sport,
        bingoMode: tournament.bingoMode,
        bingoDrawMode: tournament.bingoDrawMode,
        bingoCardMode: tournament.bingoCardMode,
        bingoMaxNumber: tournament.bingoMaxNumber,
        bingoCardPrice: tournament.bingoCardPrice,
        bingoCardsPerParticipant: tournament.bingoCardsPerParticipant,
      },
      registrations: registrations.map(registration => ({
        id: registration.id,
        name: registration.name,
        status: registration.status,
        paymentStatus: registration.paymentStatus,
        automaticPayment: registration.automaticPayment,
        representsOrganization: registration.representsOrganization,
        representedOrganizationName: registration.representedOrganizationName,
        checkedIn: registration.checkedIn,
        createdAt: registration.createdAt,
      })),
      rounds: formattedRounds,
      bingo: {
        cards: bingoCards,
        draws: bingoDraws,
        drawnNumbers: bingoDraws.map(draw => draw.number),
        winners: bingoWinners,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar torneio público' })
  }
})

app.post('/public/:slug/register', async (req, res) => {
  try {
    const { slug } = req.params
    const authUser = await optionalAuthUser(req)
    const playerProfile = authUser?.playerProfile || null
    const {
      name,
      cpf,
      email,
      phone,
      category,
      modality,
      sportName,
      rulesAccepted,
      representsOrganization = false,
      representedOrganizationName,
      representedOrganizationType,
      representedOrganizationDocument,
    } = req.body

    if (authUser && !playerProfile) {
      return res.status(403).json({ error: 'Complete seu perfil de jogador antes de se inscrever neste torneio' })
    }

    if (playerProfile && rulesAccepted !== true && rulesAccepted !== 'true') {
      return res.status(400).json({ error: 'Aceite o regulamento do torneio para confirmar a inscrição' })
    }

    if (!playerProfile && (!name || !cpf || !email || !phone)) {
      return res.status(400).json({ error: 'Nome, CPF, e-mail e WhatsApp são obrigatórios' })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { publicSlug: slug },
      include: { registrations: true, organization: true, sport: true },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (!tournament.registrationOpen) {
      return res.status(403).json({ error: 'Inscrições encerradas pelo organizador' })
    }

    const registrationName = playerProfile
      ? String(sportName || playerProfile.nickname || playerProfile.name).trim()
      : String(name).trim()
    const registrationEmail = playerProfile
      ? playerProfile.email
      : email
    const registrationPhone = playerProfile
      ? (phone || playerProfile.phone || authUser.phone)
      : phone
    const registrationCpf = playerProfile
      ? (playerProfile.cpf || cpf || '')
      : cpf
    const normalizedEmail = String(registrationEmail || '').trim().toLowerCase()
    const normalizedPhone = normalizeWhatsAppNumber(registrationPhone)
    const normalizedCpf = registrationCpf ? normalizeCpf(registrationCpf) : null

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido' })
    }

    if (normalizedCpf && !isValidCpf(normalizedCpf)) {
      return res.status(400).json({ error: 'Informe um CPF válido com 11 dígitos' })
    }

    if (!isValidBrazilCellphone(normalizedPhone)) {
      return res.status(400).json({ error: 'Informe um celular válido com DDD. Exemplo: 11990098000' })
    }

    const confirmationToken = randomUUID()
    const representsOrg = representsOrganization === true || representsOrganization === 'true'
    const existingRegistration = await prisma.tournamentRegistration.findFirst({
      where: {
        tournamentId: tournament.id,
        OR: [
          playerProfile ? { playerProfileId: playerProfile.id } : null,
          authUser ? { userId: authUser.id } : null,
          { email: normalizedEmail },
        ].filter(Boolean),
      },
    })

    if (existingRegistration) {
      return res.status(400).json({ error: 'Você já está inscrito neste torneio' })
    }

    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId: tournament.id,
        userId: authUser?.id || null,
        playerProfileId: playerProfile?.id || null,
        name: registrationName,
        cpf: normalizedCpf,
        email: normalizedEmail,
        phone: normalizedPhone,
        category: String(category || '').trim() || null,
        modality: String(modality || tournament.sport?.name || '').trim() || null,
        sportName: String(sportName || '').trim() || null,
        rulesAcceptedAt: playerProfile ? new Date() : null,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: null,
        automaticPayment: false,
        representsOrganization: representsOrg,
        representedOrganizationName: representsOrg ? String(representedOrganizationName || '').trim() || null : null,
        representedOrganizationType: representsOrg ? String(representedOrganizationType || '').trim() || null : null,
        representedOrganizationDocument: representsOrg ? String(representedOrganizationDocument || '').trim() || null : null,
        checkedIn: false,
        confirmationToken,
      },
    })

    const usesAutomaticPayment = ['platform', 'both'].includes(tournament.paymentCollectionMode) &&
      Number(tournament.registrationFee || 0) > 0
    let payment = null

    if (usesAutomaticPayment) {
      payment = await createRegistrationPixPayment(tournament, registration)
    }

    await sendRegistrationConfirmation(tournament, registration)

    const currentRegistration = await prisma.tournamentRegistration.findUnique({
      where: { id: registration.id },
    })

    res.json({
      ok: true,
      registration: {
        id: currentRegistration.id,
        name: currentRegistration.name,
        status: currentRegistration.status,
        paymentStatus: currentRegistration.paymentStatus,
        checkedIn: currentRegistration.checkedIn,
        automaticPayment: currentRegistration.automaticPayment,
        category: currentRegistration.category,
        modality: currentRegistration.modality,
        sportName: currentRegistration.sportName,
      },
      paymentLink: tournament.paymentLink,
      payment,
    })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Este e-mail já está inscrito neste torneio' })
    }

    console.error(error)
    res.status(500).json({ error: 'Erro ao realizar inscrição' })
  }
})

app.post('/public/registrations/payment-confirmed', async (req, res) => {
  try {
    const secret = req.headers['x-payment-secret']

    if (!PAYMENT_CONFIRM_SECRET || secret !== PAYMENT_CONFIRM_SECRET) {
      return res.status(403).json({ error: 'Confirmação de pagamento não autorizada' })
    }

    const { registrationId, email, paymentMethod } = req.body
    const allowedMethods = ['pix', 'card', 'cash']

    if (!registrationId && !email) {
      return res.status(400).json({ error: 'Informe a inscrição ou e-mail do pagador' })
    }

    if (!allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida' })
    }

    const registration = await prisma.tournamentRegistration.findFirst({
      where: {
        OR: [
          registrationId ? { id: Number(registrationId) } : undefined,
          email ? { email: String(email).trim().toLowerCase() } : undefined,
        ].filter(Boolean),
      },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    const prepared = await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        paymentStatus: 'paid',
        paymentMethod,
        checkedIn: true,
      },
    })

    const updated = await confirmPaidRegistration(prepared)

    res.json({
      ok: true,
      registration: {
        id: updated.id,
        name: updated.name,
        status: updated.status,
        paymentStatus: updated.paymentStatus,
        paymentMethod: updated.paymentMethod,
      },
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao confirmar pagamento da inscrição' })
  }
})

app.get('/public/registrations/:id/payment-status', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (!registration.mercadoPagoId) {
      return res.json({
        ok: true,
        status: registration.paymentStatus,
        paymentStatus: registration.paymentStatus,
      })
    }

    const response = await axios.get(
      `https://api.mercadopago.com/v1/payments/${registration.mercadoPagoId}`,
      {
        headers: {
          Authorization: `Bearer ${process.env.MERCADOPAGO_ACCESS_TOKEN}`,
        },
      }
    )

    const payment = response.data

    if (payment.status === 'approved' && registration.paymentStatus !== 'paid') {
      const prepared = await prisma.tournamentRegistration.update({
        where: { id },
        data: {
          paymentStatus: 'paid',
          paymentMethod: 'pix',
          checkedIn: true,
        },
      })

      await confirmPaidRegistration(prepared)
    }

    res.json({
      ok: true,
      status: payment.status,
      paymentStatus: payment.status === 'approved' ? 'paid' : registration.paymentStatus,
    })
  } catch (error) {
    console.error(error.response?.data || error.message)
    res.status(500).json({ error: 'Erro ao consultar pagamento da inscrição' })
  }
})

app.get('/public/registrations/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { confirmationToken: token },
      include: {
        tournament: {
          include: { registrations: true },
        },
      },
    })

    if (!registration) {
      return res.status(404).send('Inscrição não encontrada ou link inválido.')
    }

    const publicUrl = `${APP_URL}/public/${registration.tournament.publicSlug}`

    if (registration.status !== 'pending') {
      return res.redirect(publicUrl)
    }

    return res.send(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Confirmar inscrição</title>
          <style>
            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              font-family: Arial, sans-serif;
              background: #020617;
              color: white;
            }
            main {
              width: min(520px, calc(100% - 32px));
              padding: 28px;
              border: 1px solid #2563eb;
              border-radius: 18px;
              background: #0f172a;
              text-align: center;
            }
            h1 { margin: 0 0 12px; }
            p { color: #cbd5e1; line-height: 1.5; }
            button {
              width: 100%;
              margin-top: 18px;
              padding: 14px 18px;
              border: 0;
              border-radius: 12px;
              background: #2563eb;
              color: white;
              font-weight: 800;
              cursor: pointer;
            }
          </style>
        </head>
        <body>
          <main>
            <h1>Confirmar inscrição</h1>
            <p>Olá <strong>${escapeHtml(registration.name)}</strong>, confirme sua participação no torneio <strong>${escapeHtml(registration.tournament.name)}</strong>.</p>
            <p>Após o pagamento, encaminhe o comprovante ao organizador do torneio para liberação do check-in.</p>
            <form method="post" action="/api/public/registrations/confirm/${escapeHtml(token)}">
              <button type="submit">Confirmar minha inscrição</button>
            </form>
          </main>
        </body>
      </html>
    `)
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao carregar confirmação.')
  }
})

app.post('/public/registrations/confirm/:token', async (req, res) => {
  try {
    const { token } = req.params

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { confirmationToken: token },
      include: {
        tournament: {
          include: { registrations: true },
        },
      },
    })

    if (!registration) {
      return res.status(404).send('Inscrição não encontrada ou link inválido.')
    }

    const publicUrl = `${APP_URL}/public/${registration.tournament.publicSlug}`

    if (registration.status !== 'pending') {
      return res.redirect(publicUrl)
    }

    await prisma.tournamentRegistration.update({
      where: { id: registration.id },
      data: {
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: null,
        checkedIn: false,
        confirmedAt: new Date(),
      },
    })

    return res.redirect(publicUrl)
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao confirmar inscrição.')
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

    const hashedPassword = await bcrypt.hash(password, 10)
    const emailVerifyToken = randomUUID()

    const user = await prisma.user.create({
      data: {
        name: name || organizationName,
        email,
        phone,
        password: hashedPassword,
        role: 'admin',
        organizationId: organization.id,
        emailVerified: false,
        emailVerifyToken
      }
    })

    await ensureUserRoles(user.id, ['ORGANIZER', 'ARENA_OWNER', 'ADMIN'])

    const verifyUrl = `${APP_URL}/api/auth/verify-email/${emailVerifyToken}`

    const emailResult = await sendEmail({
      to: email,
      subject: 'Confirme seu cadastro no PlayFinal Arena',
      text: `Bem-vindo ao PlayFinal Arena. Confirme seu e-mail acessando: ${verifyUrl}`,
      html: `
        <h2>Bem-vindo ao PlayFinal Arena</h2>
        <p>Sua arena <strong>${escapeHtml(organizationName)}</strong> foi criada com plano Trial Free.</p>
        <p>Confirme seu e-mail para manter a comunicação ativa na plataforma.</p>
        <p><a href="${verifyUrl}">Confirmar e-mail</a></p>
      `,
    })

    const whatsAppResult = await sendWhatsApp({
      to: phone,
      text: `Olá ${name || organizationName}! Sua conta no PlayFinal Arena foi criada. Confirme seu e-mail e acesse: ${APP_URL}/login`,
    })

    const delivery = buildDeliveryResponse(emailResult, whatsAppResult)

    res.json({
      ok: true,
      ...delivery,
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao registrar' })
  }
})

app.post('/auth/register-organizer', (req, res) => {
  uploadKyc.single('document')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        return res.status(400).json({ error: uploadError.message || 'Erro ao processar documento' })
      }

      const {
        name,
        email,
        phone,
        address,
        password,
        organizerType = 'organizador',
        organizationName,
        documentType,
        documentNumber,
        organizationZipCode,
        organizationStreet,
        organizationNeighborhood,
        organizationCity,
        organizationState,
        organizationCountry,
        organizationNumber,
        organizationComplement,
        responsibleCpf,
        responsibleZipCode,
        responsibleStreet,
        responsibleNeighborhood,
        responsibleCity,
        responsibleState,
        responsibleCountry,
        responsibleNumber,
        responsibleComplement,
        supportedSports = '',
        termsAccepted,
      } = req.body

      if (!organizationName || !email || !phone || !password) {
        return res.status(400).json({ error: 'Organização, e-mail, telefone e senha são obrigatórios' })
      }

      if (termsAccepted !== 'true' && termsAccepted !== true) {
        return res.status(400).json({ error: 'Aceite os termos de uso para continuar' })
      }

      if (String(organizationCountry || responsibleCountry || '').toLowerCase() === 'brasil') {
        const hasBrazilAddress = organizerType === 'organizador'
          ? responsibleZipCode && responsibleStreet && responsibleNumber && responsibleNeighborhood && responsibleCity && responsibleState
          : organizationZipCode && organizationStreet && organizationNumber && organizationNeighborhood && organizationCity && organizationState

        if (!hasBrazilAddress) {
          return res.status(400).json({ error: 'CEP, logradouro, número, bairro, cidade e estado são obrigatórios para cadastro no Brasil' })
        }
      }

      const exists = await prisma.user.findUnique({ where: { email } })

      if (exists) {
        return res.status(400).json({ error: 'E-mail já cadastrado' })
      }

      const slug = organizationName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')

      const organization = await prisma.organization.create({
        data: {
          name: organizationName,
          slug: `${slug}-${Date.now()}`,
          address: address || null,
          street: organizationStreet || responsibleStreet || null,
          number: organizationNumber || responsibleNumber || null,
          complement: organizationComplement || responsibleComplement || null,
          zipCode: organizationZipCode || responsibleZipCode || null,
          neighborhood: organizationNeighborhood || responsibleNeighborhood || null,
          country: organizationCountry || responsibleCountry || null,
          city: organizationCity || responsibleCity || null,
          state: organizationState || responsibleState || null,
          documentType: documentType || (organizerType === 'organizador' ? 'CPF' : 'CNPJ'),
          documentNumber: documentNumber || null,
          responsibleCpf: responsibleCpf || null,
          responsibleZipCode: responsibleZipCode || null,
          responsibleStreet: responsibleStreet || null,
          responsibleNumber: responsibleNumber || null,
          responsibleComplement: responsibleComplement || null,
          responsibleNeighborhood: responsibleNeighborhood || null,
          responsibleCity: responsibleCity || null,
          responsibleState: responsibleState || null,
          responsibleCountry: responsibleCountry || null,
          kycStatus: 'not_required',
          kycDocumentUrl: req.file ? `/api/uploads/kyc/${req.file.filename}` : null,
          termsAcceptedAt: new Date(),
          paymentCollectionMode: 'manual',
          supportedSports: supportedSports || null,
          plan: 'trial',
          trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          maxUsers: 1,
        },
      })

      const hashedPassword = await bcrypt.hash(password, 10)
      const emailVerifyToken = randomUUID()

      const user = await prisma.user.create({
        data: {
          name: name || organizationName,
          email,
          phone,
          password: hashedPassword,
          role: 'admin',
          organizationId: organization.id,
          emailVerified: false,
          emailVerifyToken,
        },
      })

      await ensureUserRoles(user.id, ['ORGANIZER', 'ARENA_OWNER', 'ADMIN'])

      const verifyUrl = `${APP_URL}/api/auth/verify-email/${emailVerifyToken}`

      const emailResult = await sendEmail({
        to: email,
        subject: 'Confirme seu cadastro de organizador - PlayFinal Arena',
        text: `Seu cadastro de organizador foi recebido. Confirme seu e-mail: ${verifyUrl}`,
        html: `
          <h2>Cadastro de organizador recebido</h2>
          <p>Sua conta <strong>${escapeHtml(organizationName)}</strong> foi criada.</p>
          <p><a href="${verifyUrl}">Confirmar e-mail</a></p>
        `,
      })

      const whatsAppResult = await sendWhatsApp({
        to: phone,
        text: `PlayFinal Arena: cadastro de organizador recebido para ${organizationName}. Valide seu cadastro por este link: ${verifyUrl}`,
      })

      const delivery = buildDeliveryResponse(emailResult, whatsAppResult)

      res.json({
        ok: true,
        organizationId: organization.id,
        ...delivery,
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Erro ao registrar organizador' })
    }
  })
})

app.post('/players/register', async (req, res) => {
  try {
    const {
      name,
      firstName,
      lastName,
      nickname,
      email,
      phone,
      rg,
      cpf,
      gender,
      birthDate,
      zipCode,
      street,
      addressNumber,
      complement,
      neighborhood,
      city,
      state,
      country,
      favoriteSports,
      password,
      termsAccepted,
      noticesAccepted,
    } = req.body

    const fullName = String(name || `${firstName || ''} ${lastName || ''}`).trim()

    if (!fullName || !email || !phone || !password) {
      return res.status(400).json({ error: 'Nome, e-mail, WhatsApp e senha são obrigatórios' })
    }

    if (String(country || '').toLowerCase() === 'brasil') {
      if (!cpf || !zipCode || !street || !addressNumber || !neighborhood || !city || !state) {
        return res.status(400).json({ error: 'CPF, CEP, endereço, número, bairro, cidade e estado são obrigatórios para jogadores do Brasil' })
      }
    }

    if (!termsAccepted) {
      return res.status(400).json({ error: 'Aceite os termos para criar o perfil do jogador' })
    }

    if (!noticesAccepted) {
      return res.status(400).json({ error: 'Aceite o recebimento de avisos por e-mail e WhatsApp para participar dos torneios' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const existingPlayer = await prisma.playerProfile.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    })

    if (existingPlayer) {
      return res.status(400).json({ error: 'Já existe perfil de jogador com este e-mail' })
    }

    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { playerProfile: true },
    })

    if (existingUser?.playerProfile) {
      return res.status(400).json({ error: 'Esta conta já possui perfil de jogador' })
    }

    if (existingUser) {
      const validPassword = await bcrypt.compare(password, existingUser.password)

      if (!validPassword) {
        return res.status(400).json({ error: 'Este e-mail já possui conta. Entre com a senha atual para adicionar o perfil de jogador.' })
      }
    }

    const hashedPassword = existingUser?.password || await bcrypt.hash(password, 10)
    const verifyToken = existingUser?.emailVerified ? null : randomUUID()
    const favoriteSportsValue = Array.isArray(favoriteSports) ? favoriteSports.join(', ') : favoriteSports || null
    const playerData = {
      name: fullName,
      firstName: firstName || null,
      lastName: lastName || null,
      nickname: nickname || null,
      email: normalizedEmail,
      password: hashedPassword,
      phone: phone || null,
      rg: rg || null,
      cpf: cpf || null,
      gender: gender || null,
      birthDate: birthDate ? new Date(birthDate) : null,
      zipCode: zipCode || null,
      street: street || null,
      addressNumber: addressNumber || null,
      complement: complement || null,
      neighborhood: neighborhood || null,
      city: city || null,
      state: state || null,
      country: country || null,
      favoriteSports: favoriteSportsValue,
      termsAcceptedAt: new Date(),
      noticesAcceptedAt: new Date(),
      emailVerified: Boolean(existingUser?.emailVerified),
      verifyToken,
    }

    let user = existingUser
    let player = null

    if (existingUser) {
      player = await prisma.playerProfile.create({
        data: {
          ...playerData,
          userId: existingUser.id,
        },
      })

      if (verifyToken) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: false,
            emailVerifyToken: verifyToken,
          },
        })
      }
    } else {
      const created = await prisma.$transaction(async tx => {
        const createdUser = await tx.user.create({
          data: {
            name: fullName,
            email: normalizedEmail,
            phone: phone || null,
            password: hashedPassword,
            role: 'player',
            emailVerified: false,
            emailVerifyToken: verifyToken,
          },
        })

        const createdPlayer = await tx.playerProfile.create({
          data: {
            ...playerData,
            userId: createdUser.id,
          },
        })

        return { user: createdUser, player: createdPlayer }
      })

      user = created.user
      player = created.player
    }

    await ensureUserRole(user.id, 'PLAYER')

    if (!verifyToken) {
      return res.json({
        ok: true,
        player: { id: player.id, name: player.name, email: player.email },
        user: { id: user.id, name: user.name, email: user.email, role: user.role, roles: serializeUserRoles({ ...user, playerProfile: player, roles: [{ role: 'PLAYER' }] }) },
        delivered: true,
        delivery: { email: 'skipped', whatsapp: 'skipped' },
        message: 'Perfil de jogador criado. Use sua conta existente para entrar.',
      })
    }

    const verifyUrl = `${APP_URL}/api/players/verify/${verifyToken}`

    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: 'Valide seu cadastro de jogador - PlayFinal Arena',
      text: `Seu perfil de jogador foi criado. Valide seu cadastro: ${verifyUrl}`,
      html: `
        <h2>Valide seu cadastro de jogador</h2>
        <p>Olá <strong>${escapeHtml(fullName)}</strong>, confirme seu cadastro para ativar seu perfil no PlayFinal Arena.</p>
        <p><a href="${verifyUrl}">Validar cadastro</a></p>
      `,
    })

    const whatsAppResult = await sendWhatsApp({
      to: phone,
      text: `PlayFinal Arena: valide seu cadastro de jogador por este link: ${verifyUrl}`,
    })

    const delivery = buildDeliveryResponse(emailResult, whatsAppResult)

    res.json({
      ok: true,
      player: { id: player.id, name: player.name, email: player.email },
      user: { id: user.id, name: user.name, email: user.email, role: user.role, roles: serializeUserRoles({ ...user, playerProfile: player, roles: [{ role: 'PLAYER' }] }) },
      ...delivery,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao criar perfil de jogador' })
  }
})

app.get('/players/verify/:token', async (req, res) => {
  try {
    const { token } = req.params

    const player = await prisma.playerProfile.findFirst({
      where: { verifyToken: token },
    })

    if (!player) {
      return res.status(400).send('Link de validação inválido ou expirado.')
    }

    res.send(renderVerificationPage({
      title: 'Validar cadastro de jogador',
      description: `Olá ${player.name}, confirme abaixo para ativar seu perfil no PlayFinal Arena.`,
      buttonText: 'Validar cadastro',
    }))
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao carregar validação de jogador')
  }
})

app.post('/players/verify/:token', async (req, res) => {
  try {
    const { token } = req.params

    const player = await prisma.playerProfile.findFirst({
      where: { verifyToken: token },
    })

    if (!player) {
      return res.status(400).send('Link de validação inválido ou expirado.')
    }

    await prisma.playerProfile.update({
      where: { id: player.id },
      data: {
        emailVerified: true,
        verifyToken: null,
      },
    })

    if (player.userId) {
      await prisma.user.update({
        where: { id: player.userId },
        data: {
          emailVerified: true,
          emailVerifyToken: null,
        },
      })
      await ensureUserRole(player.userId, 'PLAYER')
    } else if (player.password) {
      const existingUser = await prisma.user.findFirst({
        where: { email: { equals: player.email, mode: 'insensitive' } },
      })

      if (existingUser) {
        await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            emailVerified: true,
            emailVerifyToken: null,
          },
        })
        await prisma.playerProfile.update({
          where: { id: player.id },
          data: { userId: existingUser.id },
        })
        await ensureUserRole(existingUser.id, 'PLAYER')
      } else {
        const createdUser = await prisma.user.create({
          data: {
            name: player.name,
            email: player.email,
            phone: player.phone || null,
            password: player.password,
            role: 'player',
            emailVerified: true,
            emailVerifyToken: null,
          },
        })
        await prisma.playerProfile.update({
          where: { id: player.id },
          data: { userId: createdUser.id },
        })
        await ensureUserRole(createdUser.id, 'PLAYER')
      }
    }

    res.redirect(`/jogador/${player.id}?verified=1`)
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao validar cadastro de jogador')
  }
})

app.get('/players/:id/dashboard', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const player = await prisma.playerProfile.findUnique({
      where: { id },
    })

    if (!player) {
      return res.status(404).json({ error: 'Jogador não encontrado' })
    }

    if (!player.emailVerified) {
      return res.status(403).json({ error: 'Valide seu cadastro pelo link enviado por e-mail ou WhatsApp antes de acessar o painel.' })
    }

    const identityFilters = [
      { playerProfileId: player.id },
      player.userId ? { userId: player.userId } : null,
      { email: player.email },
      player.phone ? { phone: player.phone } : null,
    ].filter(Boolean)

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { OR: identityFilters },
      include: { tournament: true },
      orderBy: { createdAt: 'desc' },
    })

    const playerRows = await prisma.player.findMany({
      where: { OR: identityFilters },
      orderBy: { createdAt: 'asc' },
    })
    const playerIds = playerRows.map(item => item.id)

    const matches = playerIds.length > 0
      ? await prisma.match.findMany({
          where: {
            status: 'finished',
            OR: [
              { playerAId: { in: playerIds } },
              { playerBId: { in: playerIds } },
            ],
          },
          include: { tournament: true },
          orderBy: { createdAt: 'asc' },
        })
      : []

    const relatedPlayerIds = Array.from(new Set(matches.flatMap(match => [
      match.playerAId,
      match.playerBId,
    ]).filter(Boolean)))
    const relatedPlayers = relatedPlayerIds.length > 0
      ? await prisma.player.findMany({ where: { id: { in: relatedPlayerIds } } })
      : []
    const playerNameById = Object.fromEntries(relatedPlayers.map(item => [item.id, item.name]))

    let elo = 1000
    let wins = 0
    let losses = 0

    matches.forEach(match => {
      if (playerIds.includes(match.winnerId)) {
        wins += 1
        elo += 16
      } else if (playerIds.includes(match.loserId)) {
        losses += 1
        elo = Math.max(100, elo - 12)
      }
    })

    const tournamentIds = Array.from(new Set(registrations.map(item => item.tournamentId)))
    let championCount = 0

    for (const tournamentId of tournamentIds) {
      const finalMatch = await prisma.match.findFirst({
        where: { tournamentId, status: 'finished' },
        orderBy: [{ round: 'desc' }, { id: 'desc' }],
      })

      if (finalMatch && playerIds.includes(finalMatch.winnerId)) {
        championCount += 1
      }
    }

    const latestResults = matches.slice(-8).reverse().map(match => {
      const opponentId = playerIds.includes(match.playerAId) ? match.playerBId : match.playerAId
      return {
        id: match.id,
        tournament: match.tournament?.name || 'Torneio',
        opponent: playerNameById[opponentId] || 'BYE',
        result: playerIds.includes(match.winnerId) ? 'Vitória' : 'Derrota',
        score: `${match.scoreA || 0} x ${match.scoreB || 0}`,
        date: match.createdAt,
      }
    })

    const achievements = [
      championCount > 0 ? `Campeão ${championCount}x` : null,
      wins > 0 ? 'Primeira vitória registrada' : null,
      registrations.length >= 3 ? 'Participante recorrente' : null,
      elo >= 1100 ? 'Ranking em ascensão' : null,
    ].filter(Boolean)

    const notices = registrations
      .filter(item => !['finished', 'canceled', 'cancelado'].includes(String(item.tournament?.status || '').toLowerCase()))
      .slice(0, 6)
      .map(item => ({
        id: item.id,
        title: item.tournament?.name || 'Torneio',
        text: `${item.status} • ${item.paymentStatus || 'aguardando'} • ${item.tournament?.eventDate ? new Date(item.tournament.eventDate).toLocaleDateString('pt-BR') : 'data a confirmar'}`,
      }))

    res.json({
      player,
      stats: {
        tournaments: registrations.length,
        wins,
        losses,
        winRate: wins + losses > 0 ? Math.round((wins / (wins + losses)) * 100) : 0,
        elo,
        championCount,
      },
      registrations: registrations.slice(0, 10).map(item => ({
        id: item.id,
        tournament: item.tournament?.name || 'Torneio',
        status: item.status,
        paymentStatus: item.paymentStatus,
        date: item.tournament?.eventDate,
      })),
      latestResults,
      achievements,
      notices,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar painel do jogador' })
  }
})

app.post('/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()

    if (!email) {
      return res.status(400).json({ error: 'Informe o e-mail cadastrado' })
    }

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { organization: true },
    })

    if (user) {
      const token = randomUUID()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: token,
          passwordResetExpiresAt: expiresAt,
        },
      })

      const resetUrl = `${APP_URL}/reset-password?token=${token}`

      await sendEmail({
        to: user.email,
        subject: 'Recuperação de senha - PlayFinal Arena',
        text: `Para redefinir sua senha, acesse: ${resetUrl}`,
        html: `
          <h2>Recuperação de senha</h2>
          <p>Recebemos uma solicitação para redefinir a senha da sua conta no PlayFinal Arena.</p>
          <p><a href="${resetUrl}">Redefinir senha</a></p>
          <p>Este link expira em 1 hora.</p>
        `,
      })

      if (user.phone) {
        await sendWhatsApp({
          to: user.phone,
          text: `PlayFinal Arena: recebemos uma solicitação de recuperação de senha. Redefina por este link: ${resetUrl}`,
        })
      }
    }

    res.json({
      ok: true,
      message: 'Se o e-mail estiver cadastrado, enviaremos as instruções de recuperação.',
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao solicitar recuperação de senha' })
  }
})

app.post('/auth/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ error: 'Token e nova senha são obrigatórios' })
    }

    if (String(password).length < 6) {
      return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres' })
    }

    const user = await prisma.user.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpiresAt: {
          gt: new Date(),
        },
      },
    })

    if (!user) {
      return res.status(400).json({ error: 'Link inválido ou expirado' })
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    })

    await prisma.playerProfile.updateMany({
      where: { userId: user.id },
      data: { password: hashedPassword },
    })

    res.json({ ok: true, message: 'Senha alterada com sucesso' })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao redefinir senha' })
  }
})

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body
    const normalizedEmail = String(email || '').trim().toLowerCase()

    const user = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
      include: { organization: true, playerProfile: true, roles: true }
    })

    if (!user) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

    const validPassword = await bcrypt.compare(password, user.password)

    if (!validPassword) {
      return res.status(401).json({ error: 'Usuário ou senha inválidos' })
    }

    if (user.role !== 'superadmin' && !user.emailVerified) {
      return res.status(403).json({ error: 'Confirme seu cadastro pelo link enviado por e-mail ou WhatsApp antes de entrar.' })
    }

    if (user.role !== 'superadmin' && ['blocked', 'deleted'].includes(user.organization?.status)) {
      return res.status(403).json({ error: 'Acesso bloqueado. Entre em contato com o suporte PlayFinal Arena.' })
    }

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        roles: serializeUserRoles(user),
        organizationId: user.organizationId,
        playerProfileId: user.playerProfile?.id || null
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
        roles: serializeUserRoles(user),
        organizationId: user.organizationId,
        organization: user.organization,
        playerProfile: user.playerProfile ? {
          id: user.playerProfile.id,
          name: user.playerProfile.name,
          nickname: user.playerProfile.nickname,
          email: user.playerProfile.email,
        } : null,
        playerAccount: user.playerProfile ? {
          id: user.playerProfile.id,
          name: user.playerProfile.name,
          nickname: user.playerProfile.nickname,
          email: user.playerProfile.email,
        } : null,
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
    include: { organization: true, playerProfile: true, roles: true }
  })

  if (!user) {
    return res.status(404).json({ error: 'Usuário não encontrado' })
  }

  const { password, ...safeUser } = user
  safeUser.roles = serializeUserRoles(user)
  if (safeUser.playerProfile) {
    const { password: playerPassword, verifyToken, ...safePlayerProfile } = safeUser.playerProfile
    safeUser.playerProfile = safePlayerProfile
    safeUser.playerAccount = safePlayerProfile
  }

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
          documentType: documentType || null,
          documentNumber: documentNumber || null,
          supportedSports: supportedSports || null,
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

app.post('/tournaments/:id/notify-players', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { noticeType = 'confirmation' } = req.body
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        organization: true,
        players: true,
        registrations: {
          where: {
            status: { in: ['confirmed', 'waiting', 'pending'] },
          },
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const recipientsByKey = new Map()

    for (const player of tournament.players) {
      if (!player.email && !player.phone) continue
      const key = String(player.email || player.phone || player.name).toLowerCase()
      recipientsByKey.set(key, {
        name: player.name,
        email: player.email,
        phone: player.phone,
      })
    }

    for (const registration of tournament.registrations) {
      if (!registration.email && !registration.phone) continue
      const key = String(registration.email || registration.phone || registration.name).toLowerCase()
      if (recipientsByKey.has(key)) continue
      recipientsByKey.set(key, {
        name: registration.name,
        email: registration.email,
        phone: registration.phone,
      })
    }

    const recipients = Array.from(recipientsByKey.values())

    if (recipients.length === 0) {
      return res.status(400).json({ error: 'Nenhum jogador com e-mail ou WhatsApp cadastrado neste torneio' })
    }

    const publicUrl = tournament.publicSlug
      ? `${APP_URL}/public/${tournament.publicSlug}`
      : `${APP_URL}/telao/${tournament.id}`

    const eventInfo = [
      tournament.location ? `Local: ${tournament.location}` : null,
      tournament.eventDate ? `Data: ${new Date(tournament.eventDate).toLocaleDateString('pt-BR')}` : null,
      tournament.eventTime ? `Horário: ${tournament.eventTime}` : null,
    ].filter(Boolean).join(' | ')

    const noticeTemplates = {
      confirmation: {
        subject: `Confirmação do torneio ${tournament.name}`,
        intro: `Confirmamos o torneio ${tournament.name}${eventInfo ? ` para ${eventInfo}` : ''}.`,
        action: 'Compareça com antecedência e acompanhe a página pública para atualizações.',
      },
      cancellation: {
        subject: `Cancelamento do torneio ${tournament.name}`,
        intro: `O torneio ${tournament.name} foi cancelado pelo organizador.`,
        action: 'Acompanhe a página pública ou aguarde novas orientações da organização.',
      },
      reschedule: {
        subject: `Nova data do torneio ${tournament.name}`,
        intro: `O torneio ${tournament.name} foi marcado para nova data${eventInfo ? `: ${eventInfo}` : '.'}`,
        action: 'Confira os dados atualizados e confirme sua disponibilidade com a organização.',
      },
      refund: {
        subject: `Reembolso do torneio ${tournament.name}`,
        intro: `A organização iniciou a orientação de reembolso dos valores pagos para o torneio ${tournament.name}.`,
        action: 'Entre em contato com o organizador e envie os dados solicitados para receber o reembolso.',
      },
    }
    const template = noticeTemplates[noticeType] || noticeTemplates.confirmation
    const results = []

    for (const recipient of recipients) {
      const messageText = `Olá ${recipient.name}! ${template.intro} ${template.action} Acompanhe em: ${publicUrl}`
      let emailResult = { skipped: true }
      let whatsAppResult = { skipped: true }

      if (recipient.email) {
        emailResult = await sendEmail({
          to: recipient.email,
          subject: template.subject,
          text: messageText,
          html: `
            <h2>${escapeHtml(tournament.name)}</h2>
            <p>Olá <strong>${escapeHtml(recipient.name)}</strong>.</p>
            <p>${escapeHtml(template.intro)}</p>
            <p>${escapeHtml(template.action)}</p>
            ${eventInfo ? `<p>${escapeHtml(eventInfo)}</p>` : ''}
            ${tournament.rules ? `<p><strong>Regras:</strong> ${escapeHtml(tournament.rules)}</p>` : ''}
            <p><a href="${publicUrl}">Acompanhar torneio</a></p>
          `,
        })
      }

      if (recipient.phone) {
        whatsAppResult = await sendWhatsApp({
          to: recipient.phone,
          text: messageText,
        })
      }

      results.push({
        email: recipient.email,
        phone: recipient.phone,
        emailResult,
        whatsAppResult,
      })
    }

    const attemptedEmail = results.filter(result => result.email).length
    const attemptedWhatsApp = results.filter(result => result.phone).length
    const sentEmail = results.filter(result => result.emailResult?.ok).length
    const sentWhatsApp = results.filter(result => result.whatsAppResult?.ok).length
    const failedEmail = results.filter(result => result.email && result.emailResult?.ok === false).length
    const failedWhatsApp = results.filter(result => result.phone && result.whatsAppResult?.ok === false).length

    res.json({
      ok: true,
      sent: sentEmail + sentWhatsApp,
      attemptedEmail,
      attemptedWhatsApp,
      sentEmail,
      sentWhatsApp,
      failedEmail,
      failedWhatsApp,
      total: recipients.length,
      results,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao enviar aviso aos jogadores' })
  }
})

app.patch('/tournaments/:id/registrations/open', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { registrationOpen } = req.body

    const tournament = await prisma.tournament.findUnique({ where: { id } })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data: { registrationOpen: Boolean(registrationOpen) },
    })

    res.json({ ok: true, tournament: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar inscrições' })
  }
})

app.patch('/tournaments/:id/status', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { action, eventDate, eventTime } = req.body

    const tournament = await prisma.tournament.findUnique({ where: { id } })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const data = {}
    let message = 'Status atualizado.'

    if (action === 'close_registrations') {
      data.registrationOpen = false
      message = 'Inscrições encerradas.'
    } else if (action === 'cancel') {
      data.status = 'canceled'
      data.registrationOpen = false
      message = 'Torneio cancelado.'
    } else if (action === 'reschedule') {
      if (!eventDate) {
        return res.status(400).json({ error: 'Informe a nova data do torneio' })
      }

      data.status = tournament.status === 'finished' ? tournament.status : 'rescheduled'
      data.eventDate = new Date(eventDate)
      data.eventTime = eventTime || null
      message = 'Nova data do torneio salva.'
    } else {
      return res.status(400).json({ error: 'Ação inválida' })
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data,
    })

    res.json({ ok: true, message, tournament: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar status do torneio' })
  }
})

app.patch('/tournaments/:id/live', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { liveStarted = true } = req.body

    const tournament = await prisma.tournament.findUnique({ where: { id } })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const updated = await prisma.tournament.update({
      where: { id },
      data: { liveStarted: Boolean(liveStarted) },
    })

    res.json({ ok: true, tournament: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar transmissão' })
  }
})

app.patch('/registrations/:id/checkin', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { checkedIn = true } = req.body

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const nextCheckedIn = Boolean(checkedIn)

    const updated = await prisma.tournamentRegistration.update({
      where: { id },
      data: {
        checkedIn: nextCheckedIn,
        paymentStatus: nextCheckedIn ? 'paid' : 'pending',
        paymentMethod: nextCheckedIn ? registration.paymentMethod : null,
        status: nextCheckedIn ? 'confirmed' : registration.status,
        sortOrder: nextCheckedIn ? registration.sortOrder : null,
      },
    })

    if (nextCheckedIn) {
      await ensurePlayerForRegistration(updated)
    } else {
      await deletePlayerForRegistration(updated)
    }

    res.json({ ok: true, registration: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao realizar check-in' })
  }
})

app.patch('/registrations/:id/payment', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { paymentStatus = 'pending', paymentMethod } = req.body
    const allowedStatus = ['paid', 'pending', 'canceled', 'refunded']
    const allowedMethods = ['pix', 'card', 'cash']
    const nextPaymentStatus = paymentStatus === 'canceled' ? 'refunded' : paymentStatus

    if (!allowedStatus.includes(paymentStatus)) {
      return res.status(400).json({ error: 'Status de pagamento inválido' })
    }

    if (paymentMethod && !allowedMethods.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Forma de pagamento inválida' })
    }

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const nextPaymentMethod = nextPaymentStatus === 'paid'
      ? (paymentMethod === undefined ? registration.paymentMethod : paymentMethod)
      : null

    let updated = await prisma.tournamentRegistration.update({
      where: { id },
      data: {
        paymentStatus: nextPaymentStatus,
        paymentMethod: nextPaymentMethod || null,
        checkedIn: nextPaymentStatus === 'paid',
      },
    })

    if (nextPaymentStatus === 'paid') {
      updated = await confirmPaidRegistration(updated)
    }

    res.json({ ok: true, registration: updated })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar pagamento da inscrição' })
  }
})

app.post('/tournaments/:id/registrations', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, cpf, email, phone } = req.body

    if (!name || !cpf || !email || !phone) {
      return res.status(400).json({ error: 'Nome, CPF, e-mail e WhatsApp são obrigatórios' })
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: id },
    })

    if (existingMatches > 0) {
      return res.status(400).json({ error: 'Adicione jogadores antes de gerar a chave' })
    }

    const normalizedEmail = String(email).trim().toLowerCase()
    const normalizedPhone = normalizeWhatsAppNumber(phone)
    const normalizedCpf = normalizeCpf(cpf)

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ error: 'Informe um e-mail válido' })
    }

    if (!isValidCpf(normalizedCpf)) {
      return res.status(400).json({ error: 'Informe um CPF válido com 11 dígitos' })
    }

    if (!isValidBrazilCellphone(normalizedPhone)) {
      return res.status(400).json({ error: 'Informe um celular válido com DDD. Exemplo: 11990098000' })
    }

    const registration = await prisma.tournamentRegistration.create({
      data: {
        tournamentId: id,
        name: String(name).trim(),
        cpf: normalizedCpf,
        email: normalizedEmail,
        phone: normalizedPhone,
        status: 'pending',
        paymentStatus: 'pending',
        paymentMethod: null,
        checkedIn: false,
        confirmationToken: randomUUID(),
      },
    })

    const delivery = await sendRegistrationConfirmation(tournament, registration)

    res.json({ ok: true, registration, delivery })
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Este e-mail já está inscrito neste torneio' })
    }

    console.error(error)
    res.status(500).json({ error: 'Erro ao adicionar jogador' })
  }
})

app.post('/registrations/:id/message', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const message = String(req.body.message || '').trim()

    if (!message) {
      return res.status(400).json({ error: 'Informe a mensagem para o inscrito' })
    }

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    if (!registration.email && !registration.phone) {
      return res.status(400).json({ error: 'Este inscrito não possui e-mail nem WhatsApp cadastrado' })
    }

    const publicUrl = registration.tournament.publicSlug
      ? `${APP_URL}/public/${registration.tournament.publicSlug}`
      : `${APP_URL}/telao/${registration.tournamentId}`
    const fullMessage = `${message} Acompanhe o torneio em: ${publicUrl}`
    let emailResult = { skipped: true }
    let whatsAppResult = { skipped: true }

    if (registration.email) {
      emailResult = await sendEmail({
        to: registration.email,
        subject: `Mensagem do torneio ${registration.tournament.name}`,
        text: fullMessage,
        html: `
          <h2>${escapeHtml(registration.tournament.name)}</h2>
          <p>Olá <strong>${escapeHtml(registration.name)}</strong>.</p>
          <p>${escapeHtml(message)}</p>
          <p><a href="${publicUrl}">Acompanhar torneio</a></p>
        `,
      })
    }

    if (registration.phone) {
      whatsAppResult = await sendWhatsApp({
        to: registration.phone,
        text: fullMessage,
      })
    }

    res.json({ ok: true, emailResult, whatsAppResult })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao enviar mensagem ao inscrito' })
  }
})

app.patch('/registrations/:id/status', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status } = req.body
    const allowedStatus = ['confirmed', 'waiting', 'pending', 'removed']

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' })
    }

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: registration.tournamentId },
    })

    if (existingMatches > 0) {
      return res.status(400).json({ error: 'Altere inscritos antes de gerar a chave' })
    }

    const nextSortOrder = status === 'confirmed'
      ? registration.sortOrder || (await prisma.tournamentRegistration.count({
          where: {
            tournamentId: registration.tournamentId,
            status: 'confirmed',
          },
        })) + 1
      : null

    const updated = await prisma.tournamentRegistration.update({
      where: { id },
      data: {
        status,
        checkedIn: registration.checkedIn,
        paymentStatus: registration.paymentStatus,
        sortOrder: nextSortOrder,
      },
    })

    if (status === 'confirmed') {
      await ensurePlayerForRegistration(updated)
    } else {
      await deletePlayerForRegistration(updated)
    }

    await compactConfirmedRegistrationOrder(registration.tournamentId)
    const refreshed = await prisma.tournamentRegistration.findUnique({ where: { id } })
    res.json({ ok: true, registration: refreshed })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar inscrição' })
  }
})

app.patch('/registrations/:id/move', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { status, targetId } = req.body
    const allowedStatus = ['confirmed', 'waiting', 'pending', 'removed']

    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ error: 'Status inválido' })
    }

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: registration.tournamentId },
    })

    if (existingMatches > 0) {
      return res.status(400).json({ error: 'Movimente inscritos antes de gerar a chave' })
    }

    if (status !== 'confirmed') {
      const updated = await prisma.tournamentRegistration.update({
        where: { id },
        data: {
          status,
          sortOrder: null,
        },
      })

      await deletePlayerForRegistration(updated)
      const registrations = await compactConfirmedRegistrationOrder(registration.tournamentId)
      return res.json({ ok: true, registrations })
    }

    await prisma.tournamentRegistration.update({
      where: { id },
      data: {
        status: 'confirmed',
        sortOrder: 999999,
      },
    })

    let ordered = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId: registration.tournamentId,
        status: 'confirmed',
        id: { not: id },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    const target = targetId
      ? ordered.find(item => item.id === Number(targetId))
      : null

    if (target) {
      const targetIndex = ordered.findIndex(item => item.id === target.id)
      ordered.splice(targetIndex, 0, { ...registration, id, status: 'confirmed' })
    } else {
      ordered.push({ ...registration, id, status: 'confirmed' })
    }

    for (const [index, item] of ordered.entries()) {
      await prisma.tournamentRegistration.update({
        where: { id: item.id },
        data: { sortOrder: index + 1 },
      })
    }

    const updated = await prisma.tournamentRegistration.findUnique({ where: { id } })
    await ensurePlayerForRegistration(updated)

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: registration.tournamentId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    res.json({ ok: true, registrations })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao mover inscrição' })
  }
})

app.patch('/registrations/:id/order', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { direction } = req.body

    if (!['up', 'down'].includes(direction)) {
      return res.status(400).json({ error: 'Direção inválida' })
    }

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    if (registration.status !== 'confirmed') {
      return res.status(400).json({ error: 'Apenas a lista principal pode ser ordenada' })
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: registration.tournamentId },
    })

    if (existingMatches > 0) {
      return res.status(400).json({ error: 'Altere a ordem antes de gerar a chave' })
    }

    const ordered = await compactConfirmedRegistrationOrder(registration.tournamentId)
    const currentIndex = ordered.findIndex(item => item.id === id)
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= ordered.length) {
      return res.json({ ok: true, registrations: ordered })
    }

    const current = ordered[currentIndex]
    const target = ordered[targetIndex]

    await prisma.tournamentRegistration.update({
      where: { id: current.id },
      data: { sortOrder: target.sortOrder },
    })
    await prisma.tournamentRegistration.update({
      where: { id: target.id },
      data: { sortOrder: current.sortOrder },
    })

    const registrations = await prisma.tournamentRegistration.findMany({
      where: { tournamentId: registration.tournamentId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })

    res.json({ ok: true, registrations })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao atualizar ordem' })
  }
})

app.delete('/registrations/:id', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id },
      include: { tournament: true },
    })

    if (!registration) {
      return res.status(404).json({ error: 'Inscrição não encontrada' })
    }

    if (registration.tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    const existingMatches = await prisma.match.count({
      where: { tournamentId: registration.tournamentId },
    })

    if (existingMatches > 0) {
      return res.status(400).json({ error: 'Retire inscritos antes de gerar a chave' })
    }

    await deletePlayerForRegistration(registration)
    await prisma.tournamentRegistration.delete({ where: { id } })

    res.json({ ok: true })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao retirar inscrição' })
  }
})

app.post('/tournaments/:id/registrations/import', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        registrations: {
          where: { checkedIn: true },
          orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        },
      },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    if (tournament.status !== 'draft') {
      return res.status(400).json({ error: 'Importação permitida apenas antes do torneio iniciar' })
    }

    const registrations = tournament.registrations.slice(0, tournament.playerCount)

    await prisma.player.deleteMany({ where: { tournamentId: id } })

    for (const registration of registrations) {
      await prisma.player.create({
        data: {
          tournamentId: id,
          name: registration.name,
          email: registration.email,
          phone: registration.phone,
        },
      })
    }

    res.json({ ok: true, imported: registrations.length })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao importar inscritos' })
  }
})

app.post('/tournaments/:id/generate-bracket', auth, requireRole('admin', 'operator'), async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { mode = 'automatic', closeRegistrations = false } = req.body

    const tournament = await prisma.tournament.findUnique({
      where: { id },
    })

    if (!tournament) {
      return res.status(404).json({ error: 'Torneio não encontrado' })
    }

    if (tournament.organizationId !== req.user.organizationId) {
      return res.status(403).json({ error: 'Acesso negado' })
    }

    if (mode === 'automatic') {
      await randomizeConfirmedRegistrationOrder(id)
    } else {
      await compactConfirmedRegistrationOrder(id)
    }
    await syncPlayersFromConfirmedRegistrations(id, tournament.playerCount)

    const matches = await generateTournamentBracket(id, {
      shuffle: false,
    })

    if (closeRegistrations) {
      await prisma.tournament.update({
        where: { id },
        data: { registrationOpen: false },
      })
    }

    res.json({
      ok: true,
      mode,
      matchesCreated: matches.length,
    })
  } catch (error) {
    console.error(error)
    res.status(400).json({ error: error.message || 'Erro ao gerar chave' })
  }
})

app.post('/me/logo', auth, requireRole('admin', 'operator'), (req, res) => {
  uploadLogo.single('logo')(req, res, async (uploadError) => {
    try {
      if (uploadError) {
        console.error('Erro no upload da logo:', uploadError)
        return res.status(400).json({ error: uploadError.message || 'Erro ao processar logo' })
      }

      if (!req.user.organizationId) {
        return res.status(400).json({ error: 'Usuário sem organização' })
      }

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
        filename: req.file.filename,
        organization
      })
    } catch (error) {
      console.error(error)
      res.status(500).json({ error: 'Erro ao enviar logo' })
    }
  })
})

app.post('/billing/create-pix', auth, requireRole('admin'), async (req, res) => {
  try {
    const { plan } = req.body

    const plans = {
      pro: {
        title: 'Plano PRO - PlayFinal Arena',
        price: 59.90
      },
      master: {
        title: 'Plano MASTER - PlayFinal Arena',
        price: 89.90
      },
      avulso: {
        title: 'Torneio Avulso - PlayFinal Arena',
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
      await prisma.payment.updateMany({
        where: { mercadoPagoId: String(payment.id) },
        data: {
          status: 'approved',
          paidAt: new Date(),
        },
      })
    }

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

app.get('/admin/integrations', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const savedSettings = await prisma.integrationSetting.findMany({
      orderBy: { provider: 'asc' },
    })
    const savedByProvider = savedSettings.reduce((acc, item) => {
      acc[item.provider] = item
      return acc
    }, {})

    res.json(
      INTEGRATION_DEFINITIONS.map(definition => {
        const saved = savedByProvider[definition.provider]

        return {
          provider: definition.provider,
          label: saved?.label || definition.label,
          enabled: saved?.enabled || false,
          config: saved?.config || {},
          notes: saved?.notes || '',
          updatedAt: saved?.updatedAt || null,
        }
      })
    )
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar integrações' })
  }
})

app.put('/admin/integrations/:provider', auth, requireRole('superadmin'), async (req, res) => {
  try {
    const provider = String(req.params.provider || '').trim()

    if (!INTEGRATION_LABELS[provider]) {
      return res.status(400).json({ error: 'Integração inválida' })
    }

    const config = sanitizeIntegrationConfig(req.body?.config || {})
    const notes = String(req.body?.notes || '').slice(0, 4000)
    const enabled = Boolean(req.body?.enabled)

    const setting = await prisma.integrationSetting.upsert({
      where: { provider },
      create: {
        provider,
        label: INTEGRATION_LABELS[provider],
        enabled,
        config,
        notes,
      },
      update: {
        label: INTEGRATION_LABELS[provider],
        enabled,
        config,
        notes,
      },
    })

    res.json({ ok: true, integration: setting })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao salvar integração' })
  }
})

app.get('/me/users', auth, requireRole('admin', 'operator', 'viewer'), async (req, res) => {
  try {
    if (!req.user.organizationId) {
      return res.status(400).json({ error: 'Usuário sem organização' })
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: true,
      },
    })

    if (!currentUser) {
      return res.status(404).json({ error: 'Usuário não encontrado' })
    }

    const users = await prisma.user.findMany({
      where: { organizationId: req.user.organizationId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    res.json({ user: currentUser, users })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Erro ao carregar usuários' })
  }
})

app.post('/me/users/create', auth, requireRole('admin'), async (req, res) => {
  try {
    const { name, email, phone, password, role = 'operator' } = req.body

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
        phone: phone || null,
        password: hashedPassword,
        role,
        organizationId: req.user.organizationId
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        organizationId: true
      }
    })

    await ensureUserRoles(user.id, role === 'admin' ? ['ORGANIZER', 'ARENA_OWNER', 'ADMIN'] : ['ORGANIZER'])

    await sendEmail({
      to: email,
      subject: 'Seu acesso ao PlayFinal Arena',
      text: `Olá ${name}. Seu acesso ao PlayFinal Arena foi criado. Login: ${email}. Senha inicial: ${password}. Acesse: ${APP_URL}/login`,
      html: `
        <h2>Seu acesso foi criado</h2>
        <p>Olá <strong>${escapeHtml(name)}</strong>, você recebeu acesso ao PlayFinal Arena.</p>
        <p><strong>Login:</strong> ${escapeHtml(email)}</p>
        <p><strong>Senha inicial:</strong> ${escapeHtml(password)}</p>
        <p><a href="${APP_URL}/login">Entrar no PlayFinal Arena</a></p>
      `,
    })

    if (phone) {
      await sendWhatsApp({
        to: phone,
        text: `Olá ${name}! Seu acesso ao PlayFinal Arena foi criado. Login: ${email}. Senha inicial: ${password}. Acesse: ${APP_URL}/login`,
      })
    }

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

    res.send(renderVerificationPage({
      title: 'Confirmar cadastro',
      description: `Olá ${user.name}, confirme abaixo para liberar seu acesso ao PlayFinal Arena.`,
      buttonText: 'Confirmar cadastro',
    }))
  } catch (error) {
    console.error(error)
    res.status(500).send('Erro ao carregar validação de e-mail')
  }
})

app.post('/auth/verify-email/:token', async (req, res) => {
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

const PORT = Number(process.env.PORT || 3000)

app.listen(PORT, () => {
  console.log(`PlayFinal Arena API rodando na porta ${PORT} 🚀`)
})
