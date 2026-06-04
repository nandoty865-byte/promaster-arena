import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts'
import './App.css'

const API = '/api'
const TOURNAMENT_FORMAT_OPTIONS = [
  { value: 'knockout', label: 'Mata-mata' },
  { value: 'double_elimination', label: 'Dupla eliminatória' },
  { value: 'round_robin', label: 'Todos contra todos' },
  { value: 'swiss', label: 'Modo suíço' },
]
const SPORT_OPTIONS = ['Sinuca', 'Futebol', 'Vôlei de praia', 'Futebol society', 'Tênis de mesa']

function youtubeEmbedUrl(url?: string) {
  if (!url) return ''

  const patterns = [
    /youtube\.com\/watch\?v=([^&]+)/,
    /youtu\.be\/([^?]+)/,
    /youtube\.com\/live\/([^?]+)/,
    /youtube\.com\/embed\/([^?]+)/,
  ]

  for (const pattern of patterns) {
    const match = url.match(pattern)
    if (match?.[1]) return `https://www.youtube.com/embed/${match[1]}`
  }

  return url
}

function authHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: 'Bearer ' + localStorage.getItem('token'),
  }
}

function getToken() {
  return localStorage.getItem('token')
}

function isLoggedIn() {
  return !!getToken()
}

function goHome() {
  window.location.href = '/'
}

function publicTournamentUrl(slug?: string) {
  if (!slug) return ''
  return `${window.location.origin}/public/${slug}`
}

function tournamentStatusLabel(status?: string) {
  const normalized = String(status || '').toLowerCase()
  const labels: Record<string, string> = {
    draft: 'Rascunho',
    rascunho: 'Rascunho',
    rescheduled: 'Reagendado',
    reagendado: 'Reagendado',
    running: 'Em andamento',
    playing: 'Em andamento',
    started: 'Em andamento',
    in_progress: 'Em andamento',
    finished: 'Encerrado',
    ended: 'Encerrado',
    closed: 'Encerrado',
    encerrado: 'Encerrado',
    canceled: 'Cancelado',
    cancelled: 'Cancelado',
    cancelado: 'Cancelado',
  }

  return labels[normalized] || status || '-'
}

function appUrlWithFreshVersion(path: string) {
  const url = new URL(path, window.location.origin)
  url.searchParams.set('v', Date.now().toString())
  return `${url.pathname}${url.search}${url.hash}`
}

function isPublicPath(path: string) {
  return (
    path === '/' ||
    path === '/login' ||
    path === '/register' ||
    path === '/forgot-password' ||
    path === '/reset-password' ||
    path === '/inscreva-se' ||
    path === '/cadastro-organizador' ||
    path === '/cadastro-jogador' ||
    path.startsWith('/jogador/') ||
    path.startsWith('/telao/') ||
    path.startsWith('/public/')
  )
}

function safeJsonArray(value: string) {
  try {
    const parsed = JSON.parse(value || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function onlyDigits(value: string) {
  return String(value || '').replace(/\D/g, '')
}

function normalizeBrazilPhone(value: string) {
  const digits = onlyDigits(value)
  if (digits.startsWith('55') && digits.length === 13) return digits
  if (digits.length === 11) return `55${digits}`
  return digits
}

function isValidBrazilCellphone(value: string) {
  const digits = onlyDigits(value)
  const local = digits.startsWith('55') ? digits.slice(2) : digits
  return /^[1-9]{2}9\d{8}$/.test(local)
}

function formatBrazilCellphone(value: string) {
  const digits = onlyDigits(value).replace(/^55/, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function formatRg(value: string) {
  return String(value || '').replace(/[^0-9A-Za-z.-]/g, '').toUpperCase().slice(0, 14)
}

function isValidRg(value: string) {
  const clean = String(value || '').replace(/[^0-9A-Za-z]/g, '')
  return clean.length >= 5 && clean.length <= 12
}

function buildTournamentPhases(playerCount: number) {
  const rounds = Math.max(1, Math.ceil(Math.log2(Math.max(2, Number(playerCount) || 2))))
  return Array.from({ length: rounds }, (_, index) => {
    const phase = index + 1
    const remaining = rounds - index
    const label = remaining === 1
      ? 'Final'
      : remaining === 2
        ? 'Semifinal'
        : remaining === 3
          ? 'Quartas'
          : `Fase ${phase}`
    return { phase, label }
  })
}

function tournamentFormatLabel(format: string) {
  const normalized = String(format || '').toLowerCase()
  const option = TOURNAMENT_FORMAT_OPTIONS.find(item => item.value === normalized)
  if (option) return option.label
  if (normalized.includes('double') || normalized.includes('dupla')) return 'Dupla eliminatória'
  if (normalized.includes('group') || normalized.includes('grupo')) return 'Grupos'
  if (normalized.includes('round') || normalized.includes('todos')) return 'Todos contra todos'
  if (normalized.includes('swiss') || normalized.includes('sui')) return 'Suíço'
  if (normalized.includes('mata') || normalized.includes('single') || normalized.includes('knockout')) return 'Mata-mata'
  return format || 'Formato não informado'
}

function buildBracketSkeletonRounds(playerCount: number) {
  const slots = Math.pow(2, Math.ceil(Math.log2(Math.max(2, Number(playerCount) || 2))))
  const rounds = []
  let matchCount = Math.max(1, slots / 2)
  let round = 1

  while (matchCount >= 1) {
    rounds.push({
      round,
      matches: Array.from({ length: matchCount }, (_, index) => ({
        id: `skeleton-${round}-${index + 1}`,
        matchNumber: index + 1,
        table: '-',
        status: 'skeleton',
        skeleton: true,
      })),
    })
    matchCount = matchCount / 2
    round += 1
  }

  return rounds
}

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const path = window.location.pathname

    if (!token) {
      setLoadingUser(false)

      if (!isPublicPath(path)) {
        window.location.href = `/login?redirect=${encodeURIComponent(path)}`
      }

  return
}

    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => {
        if (!res.ok) {
          localStorage.removeItem('token')
          window.location.href = `/login?redirect=${encodeURIComponent(path)}`
          return null
        }
        return res.json()
      })
      .then(data => {
        if (data?.user) setUser(data.user)
      })
      .catch(() => {
        localStorage.removeItem('token')
        window.location.href = '/login'
      })
      .finally(() => setLoadingUser(false))
  }, [])

  if (loadingUser && !isPublicPath(window.location.pathname)) {
    return <div className="app">Carregando sistema...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/inscreva-se" element={<SignupChoice />} />
      <Route path="/cadastro-organizador" element={<OrganizerSignup />} />
      <Route path="/cadastro-jogador" element={<PlayerSignup />} />
      <Route path="/jogador/:id" element={<PlayerDashboard />} />
      <Route path="/" element={<Landing />} />
      <Route path="/planos" element={<PlansComparison />} />
      <Route path="/app" element={<Dashboard user={user} />} />
      <Route path="/app/perfil" element={<ProfilePage />} />
      <Route path="/app/usuarios" element={<UsersPage />} />
      <Route path="/upgrade" element={<Upgrade />} />
      <Route path="/campeonatos" element={<SeasonsPage user={user} />} />
      <Route path="/criar-torneio" element={<CreateTournament user={user} />} />
      <Route path="/tournament/:id/painel" element={<TournamentOverview />} />
      <Route path="/tournament/:id" element={<TournamentOverview />} />
      <Route path="/tournament/:id/inscritos" element={<TournamentOverview defaultPanel="inscritos" />} />
      <Route path="/tournament/:id/financeiro" element={<TournamentOverview defaultPanel="financeiro" />} />
      <Route path="/tournament/:id/patrocinadores" element={<TournamentOverview defaultPanel="patrocinadores" />} />
      <Route path="/tournament/:id/publico" element={<TournamentOverview defaultPanel="publico" />} />
      <Route path="/tournament/:id/chaveamento" element={<TournamentBracket />} />
      <Route path="/tournament/:id/settings" element={<TournamentSettings />} />
      <Route path="/public/:slug" element={<PublicTournament />} />
      <Route path="/arbitro/:id" element={<RefereeMode />} />
      <Route path="/telao/:id" element={<TelaoTV />} />
      <Route path="/register" element={<Register />} />
      <Route path="/admin/financeiro" element={<Financeiro />} />
      <Route path="/admin/clientes" element={<AdminClientes />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" />} />

    </Routes>
  )
}

function Register() {
  return <OrganizerSignup />
}

function SignupChoice() {
  return (
    <div className="onboardingPage signupChoicePage">
      <section className="onboardingHero">
        <span>Inscreva-se</span>
        <h1>Escolha como você quer entrar no ProMaster Arena.</h1>
        <p>Organizadores criam e operam torneios. Jogadores acompanham histórico, ranking, estatísticas e avisos dos eventos.</p>
      </section>

      <section className="signupChoiceGrid">
        <a className="signupChoiceCard" href="/cadastro-organizador">
          <span>🏆</span>
          <h2>Sou organizador</h2>
          <p>Cadastre sua arena, clube, bar ou associação para criar torneios, abrir inscrições e controlar pagamentos por evento.</p>
          <strong>Cadastrar organizador</strong>
        </a>

        <a className="signupChoiceCard" href="/cadastro-jogador">
          <span>🎱</span>
          <h2>Sou jogador</h2>
          <p>Crie seu perfil para acompanhar inscrições, ranking, histórico de torneios, resultados e conquistas.</p>
          <strong>Cadastrar jogador</strong>
        </a>
      </section>
    </div>
  )
}

function OrganizerSignup() {
  const [form, setForm] = useState<any>({
    organizationName: '',
    name: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: '',
    documentType: 'CNPJ',
    documentNumber: '',
    termsAccepted: false,
  })
  const [sports, setSports] = useState<string[]>(['Sinuca'])
  const [documentFile, setDocumentFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)

  function updateField(field: string, value: string | boolean) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function toggleSport(sport: string) {
    setSports(current => (
      current.includes(sport)
        ? current.filter(item => item !== sport)
        : [...current, sport]
    ))
  }

  async function register() {
    if (!form.organizationName || !form.email || !form.phone || !form.password) {
      alert('Preencha organização, e-mail, telefone e senha.')
      return
    }

    if (!form.documentNumber) {
      alert('Informe o documento do organizador.')
      return
    }

    if (!form.termsAccepted) {
      alert('Aceite os termos de uso para continuar.')
      return
    }

    if (form.password !== form.confirmPassword) {
      alert('As senhas não conferem.')
      return
    }

    const payload = new FormData()
    Object.entries(form).forEach(([key, value]) => payload.append(key, String(value)))
    payload.append('supportedSports', sports.join(', '))
    if (documentFile) payload.append('document', documentFile)

    setLoading(true)

    try {
      const response = await fetch(`${API}/auth/register-organizer`, {
        method: 'POST',
        body: payload,
      })
      const data = await response.json()

      if (data.error) {
        alert(data.error)
        return
      }

      alert(data.message || 'Cadastro criado. Enviamos confirmação por e-mail e WhatsApp.')
      window.location.href = '/login'
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="onboardingPage">
      <section className="onboardingHero">
        <span>Cadastro de organizador</span>
        <h1>Crie sua arena com validação e controle profissional.</h1>
        <p>Organizadores podem operar torneios de vários esportes, aceitar inscrições públicas e definir a cobrança individualmente em cada torneio.</p>
        <div className="onboardingSwitch">
          <a className="active" href="/cadastro-organizador">Sou organizador</a>
          <a href="/cadastro-jogador">Sou jogador</a>
        </div>
      </section>

      <section className="onboardingCard">
        <h2>Dados da organização</h2>
        <div className="onboardingGrid">
          <div>
            <label>Nome da organização *</label>
            <input value={form.organizationName} onChange={e => updateField('organizationName', e.target.value)} />
          </div>
          <div>
            <label>Responsável</label>
            <input value={form.name} onChange={e => updateField('name', e.target.value)} />
          </div>
          <div>
            <label>E-mail *</label>
            <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
          </div>
          <div>
            <label>WhatsApp *</label>
            <input value={form.phone} onChange={e => updateField('phone', formatBrazilCellphone(e.target.value))} />
          </div>
          <div className="fullSpan">
            <label>Endereço</label>
            <input value={form.address} onChange={e => updateField('address', e.target.value)} />
          </div>
        </div>

        <h2>Validação do organizador</h2>
        <div className="onboardingGrid">
          <div>
            <label>Tipo de documento</label>
            <select value={form.documentType} onChange={e => updateField('documentType', e.target.value)}>
              <option value="CNPJ">CNPJ</option>
              <option value="CPF">CPF</option>
              <option value="RG">RG</option>
            </select>
          </div>
          <div>
            <label>Número do documento *</label>
            <input value={form.documentNumber} onChange={e => updateField('documentNumber', e.target.value)} />
          </div>
          <div className="fullSpan">
            <label>Documento para análise</label>
            <input type="file" accept="image/*,.pdf" onChange={e => setDocumentFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <h2>Operação e cobrança</h2>
        <div className="sportsPicker">
          {SPORT_OPTIONS.map(sport => (
            <label key={sport}>
              <input type="checkbox" checked={sports.includes(sport)} onChange={() => toggleSport(sport)} />
              {sport}
            </label>
          ))}
        </div>

        <div className="onboardingGrid">
          <div>
            <label>Senha *</label>
            <input type="password" value={form.password} onChange={e => updateField('password', e.target.value)} />
          </div>
          <div>
            <label>Confirmar senha *</label>
            <input type="password" value={form.confirmPassword} onChange={e => updateField('confirmPassword', e.target.value)} />
          </div>
        </div>

        <label className="termsLine">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={e => updateField('termsAccepted', e.target.checked)}
          />
          Aceito os termos de uso, política de comunicação e validação do organizador.
        </label>

        <button className="primaryButton" onClick={register} disabled={loading}>
          {loading ? 'Enviando...' : 'Criar conta de organizador'}
        </button>
        <a href="/login">Já tenho conta</a>
      </section>
    </div>
  )
}

function PlayerSignup() {
  const navigate = useNavigate()
  const [form, setForm] = useState<any>({
    name: '',
    nickname: '',
    email: '',
    phone: '',
    rg: '',
    city: '',
    state: '',
    country: 'Brasil',
    termsAccepted: false,
  })
  const [sports, setSports] = useState<string[]>(['Sinuca'])
  const [loading, setLoading] = useState(false)

  function updateField(field: string, value: string | boolean) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function toggleSport(sport: string) {
    setSports(current => (
      current.includes(sport)
        ? current.filter(item => item !== sport)
        : [...current, sport]
    ))
  }

  function registerPlayerAccount() {
    if (!form.name || !form.email || !form.phone) {
      alert('Preencha nome, e-mail e WhatsApp.')
      return
    }

    if (!form.termsAccepted) {
      alert('Aceite os termos para criar o perfil.')
      return
    }

    setLoading(true)
    fetch(`${API}/players/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        favoriteSports: sports,
        phone: normalizeBrazilPhone(form.phone),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        navigate(`/jogador/${data.player.id}`)
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="onboardingPage">
      <section className="onboardingHero playerHero">
        <span>Cadastro de jogador</span>
        <h1>Seu histórico competitivo em um só lugar.</h1>
        <p>Acompanhe torneios, ranking Elo, últimas partidas, conquistas e avisos dos organizadores.</p>
        <div className="onboardingSwitch">
          <a href="/cadastro-organizador">Sou organizador</a>
          <a className="active" href="/cadastro-jogador">Sou jogador</a>
        </div>
      </section>

      <section className="onboardingCard">
        <h2>Dados do jogador</h2>
        <div className="onboardingGrid">
          <div>
            <label>Nome completo *</label>
            <input value={form.name} onChange={e => updateField('name', e.target.value)} />
          </div>
          <div>
            <label>Apelido</label>
            <input value={form.nickname} onChange={e => updateField('nickname', e.target.value)} />
          </div>
          <div>
            <label>E-mail *</label>
            <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />
          </div>
          <div>
            <label>WhatsApp *</label>
            <input value={form.phone} onChange={e => updateField('phone', formatBrazilCellphone(e.target.value))} />
          </div>
          <div>
            <label>RG</label>
            <input value={form.rg} onChange={e => updateField('rg', formatRg(e.target.value))} />
          </div>
          <div>
            <label>Cidade</label>
            <input value={form.city} onChange={e => updateField('city', e.target.value)} />
          </div>
          <div>
            <label>Estado</label>
            <input value={form.state} onChange={e => updateField('state', e.target.value)} />
          </div>
          <div>
            <label>País</label>
            <input value={form.country} onChange={e => updateField('country', e.target.value)} />
          </div>
        </div>

        <h2>Esportes</h2>
        <div className="sportsPicker">
          {SPORT_OPTIONS.map(sport => (
            <label key={sport}>
              <input type="checkbox" checked={sports.includes(sport)} onChange={() => toggleSport(sport)} />
              {sport}
            </label>
          ))}
        </div>

        <label className="termsLine">
          <input
            type="checkbox"
            checked={form.termsAccepted}
            onChange={e => updateField('termsAccepted', e.target.checked)}
          />
          Aceito receber avisos de torneios, chamadas de partidas e atualizações do meu ranking.
        </label>

        <button className="primaryButton" onClick={registerPlayerAccount} disabled={loading}>
          {loading ? 'Criando...' : 'Criar perfil de jogador'}
        </button>
      </section>
    </div>
  )
}

function PlayerDashboard() {
  const { id } = useParams()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/players/${id}/dashboard`, { cache: 'no-store' })
      .then(res => res.json())
      .then(setData)
  }, [id])

  if (!data?.player) {
    return <div className="publicPage">Carregando jogador...</div>
  }

  const { player, stats, latestResults = [], achievements = [], notices = [], registrations = [] } = data

  return (
    <div className="playerPortalPage">
      <header className="playerPortalHero">
        <span>Perfil do jogador</span>
        <h1>{player.nickname || player.name}</h1>
        <p>{player.city || 'Cidade não informada'}{player.state ? ` • ${player.state}` : ''}</p>
      </header>

      <section className="playerStatsGrid">
        <div><span>Elo</span><strong>{stats.elo}</strong></div>
        <div><span>Vitórias</span><strong>{stats.wins}</strong></div>
        <div><span>Derrotas</span><strong>{stats.losses}</strong></div>
        <div><span>Aproveitamento</span><strong>{stats.winRate}%</strong></div>
        <div><span>Torneios</span><strong>{stats.tournaments}</strong></div>
        <div><span>Títulos</span><strong>{stats.championCount}</strong></div>
      </section>

      <main className="playerPortalGrid">
        <section className="playerPortalCard">
          <h2>Últimos resultados</h2>
          {latestResults.length === 0 && <p>Nenhuma partida finalizada encontrada.</p>}
          {latestResults.map((result: any) => (
            <div key={result.id} className="playerResultRow">
              <strong>{result.result}</strong>
              <span>{result.tournament}</span>
              <small>{result.opponent} • {result.score}</small>
            </div>
          ))}
        </section>

        <section className="playerPortalCard">
          <h2>Histórico de torneios</h2>
          {registrations.length === 0 && <p>Nenhum torneio vinculado ao perfil.</p>}
          {registrations.map((registration: any) => (
            <div key={registration.id} className="playerResultRow">
              <strong>{registration.tournament}</strong>
              <span>{registration.status} • {registration.paymentStatus}</span>
              <small>{registration.date ? new Date(registration.date).toLocaleDateString() : 'Data a confirmar'}</small>
            </div>
          ))}
        </section>

        <section className="playerPortalCard">
          <h2>Conquistas</h2>
          {achievements.length === 0 && <p>As conquistas aparecerão conforme os torneios forem finalizados.</p>}
          {achievements.map((item: string) => (
            <div key={item} className="achievementPill">{item}</div>
          ))}
        </section>

        <section className="playerPortalCard">
          <h2>Avisos</h2>
          {notices.length === 0 && <p>Nenhum aviso ativo.</p>}
          {notices.map((notice: any) => (
            <div key={notice.id} className="playerResultRow">
              <strong>{notice.title}</strong>
              <span>{notice.text}</span>
            </div>
          ))}
        </section>
      </main>
    </div>
  )
}

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function login() {
    fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(res => res.json())
      .then(data => {
  if (!data.token) {
    alert(data.error || 'Login inválido')
    return
  }

  localStorage.setItem('token', data.token)
  const redirect = new URLSearchParams(window.location.search).get('redirect')

  if (data.user?.role === 'superadmin') {
    window.location.href = appUrlWithFreshVersion('/admin')
  } else if (redirect && redirect !== '/login') {
    window.location.href = appUrlWithFreshVersion(redirect)
  } else {
    window.location.href = appUrlWithFreshVersion('/app')
  }
})
  }

  return (
    <div className="app">
      <div className="panel" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h1>Login</h1>
        <p>ProMaster Arena</p>

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" />
        <input
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Senha"
          type="password"
        />

        <button className="primaryButton" onClick={login}>Entrar</button>
        <div className="loginLinks">
          <a href="/forgot-password">Esqueci minha senha</a>
          <a href="/cadastro-organizador">Criar nova conta</a>
        </div>
      </div>
    </div>
  )
}

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  function requestReset() {
    if (!email) {
      alert('Informe seu e-mail.')
      return
    }

    setLoading(true)
    fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        alert(data.message || 'Se o e-mail estiver cadastrado, enviaremos as instruções.')
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="app">
      <div className="panel" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h1>Recuperar senha</h1>
        <p>Informe seu e-mail para receber o link de redefinição.</p>

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" />

        <button
          className="primaryButton"
          onClick={requestReset}
          disabled={loading}
        >
          {loading ? 'Enviando...' : 'Solicitar recuperação'}
        </button>

        <div className="loginLinks">
          <a href="/login">Voltar ao login</a>
        </div>
      </div>
    </div>
  )
}

function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  function resetPassword() {
    if (!token) {
      alert('Link inválido.')
      return
    }

    if (!password || password.length < 6) {
      alert('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    if (password !== confirmPassword) {
      alert('As senhas não conferem.')
      return
    }

    setLoading(true)
    fetch(`${API}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        alert('Senha alterada com sucesso.')
        window.location.href = '/login'
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="app">
      <div className="panel" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h1>Nova senha</h1>
        <p>Crie uma nova senha para acessar o ProMaster Arena.</p>

        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Nova senha"
        />

        <input
          type="password"
          value={confirmPassword}
          onChange={e => setConfirmPassword(e.target.value)}
          placeholder="Confirmar nova senha"
        />

        <button className="primaryButton" onClick={resetPassword} disabled={loading}>
          {loading ? 'Salvando...' : 'Alterar senha'}
        </button>

        <div className="loginLinks">
          <a href="/login">Voltar ao login</a>
        </div>
      </div>
    </div>
  )
}

function ClientSidebar({ isMasterPlan = false, onLogout }: { isMasterPlan?: boolean, onLogout?: () => void }) {
  const navigate = useNavigate()
  const [currentPlan, setCurrentPlan] = useState('')
  const showMasterLinks = isMasterPlan || currentPlan === 'master' || currentPlan === 'free'

  useEffect(() => {
    if (!isLoggedIn()) return

    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setCurrentPlan(data.user?.organization?.plan || ''))
      .catch(() => setCurrentPlan(''))
  }, [isMasterPlan])

  function goToTournaments() {
    if (window.location.pathname === '/app') {
      document.getElementById('meus-torneios')?.scrollIntoView({ behavior: 'smooth' })
      return
    }

    navigate('/app')
  }

  function logout() {
    if (onLogout) {
      onLogout()
      return
    }

    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <aside className="sidebar">
      <div className="sidebarLogo">🎱 ProMaster</div>
      <button onClick={() => navigate('/app')}>Dashboard</button>
      <button onClick={() => navigate('/app/perfil')}>Perfil</button>
      <button onClick={goToTournaments}>Meus Torneios</button>
      <button onClick={() => navigate('/criar-torneio')}>Criar Torneio</button>
      <button onClick={() => navigate('/upgrade')}>Planos e pagamentos</button>
      {showMasterLinks && (
        <>
          <button onClick={() => navigate('/campeonatos')}>Campeonatos</button>
          <button onClick={() => navigate('/app/usuarios')}>Usuários</button>
        </>
      )}
      <button className="sidebarFooterButton" onClick={logout}>Sair</button>
    </aside>
  )
}

function AdminSidebar() {
  const navigate = useNavigate()

  function logout() {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  return (
    <aside className="sidebar">
      <div className="sidebarLogo">👑 Admin Master</div>
      <button onClick={() => navigate('/admin')}>Dashboard</button>
      <button onClick={() => navigate('/admin/financeiro')}>Financeiro</button>
      <button onClick={() => navigate('/admin/clientes')}>Clientes</button>
      <button className="sidebarFooterButton" onClick={logout}>Sair</button>
    </aside>
  )
}

function ProfilePage() {
  const [user, setUser] = useState<any>(null)
  const [form, setForm] = useState<any>({
    name: '',
    email: '',
    phone: '',
    organizationName: '',
    street: '',
    number: '',
    complement: '',
    country: '',
    state: '',
    city: '',
    documentType: 'CNPJ',
    documentNumber: '',
    supportedSports: '',
  })
  const [profileSports, setProfileSports] = useState<string[]>([])
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [logoUploading, setLogoUploading] = useState(false)
  const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null)

  function loadProfile() {
    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        setUser(data.user)
        const supportedSports = data.user?.organization?.supportedSports || ''
        setProfileSports(String(supportedSports).split(',').map((item: string) => item.trim()).filter(Boolean))
        setForm({
          name: data.user?.name || '',
          email: data.user?.email || '',
          phone: data.user?.phone || '',
          organizationName: data.user?.organization?.name || '',
          street: data.user?.organization?.street || data.user?.organization?.address || '',
          number: data.user?.organization?.number || '',
          complement: data.user?.organization?.complement || '',
          country: data.user?.organization?.country || '',
          state: data.user?.organization?.state || '',
          city: data.user?.organization?.city || '',
          documentType: data.user?.organization?.documentType || 'CNPJ',
          documentNumber: data.user?.organization?.documentNumber || '',
          supportedSports,
        })
      })
  }

  function updateField(field: string, value: string | boolean) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function updatePasswordField(field: string, value: string) {
    setPasswordForm(current => ({ ...current, [field]: value }))
  }

  function toggleProfileSport(sport: string) {
    setProfileSports(current => (
      current.includes(sport)
        ? current.filter(item => item !== sport)
        : [...current, sport]
    ))
  }

  function saveProfile() {
    fetch(`${API}/me/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        ...form,
        supportedSports: profileSports.join(', '),
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setUser(data.user)
        alert('Perfil atualizado.')
      })
  }

  function changePassword() {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      alert('Preencha todos os campos de senha.')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      alert('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      alert('A confirmação da senha não confere.')
      return
    }

    fetch(`${API}/me/password`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setPasswordForm({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        })
        alert('Senha alterada com sucesso.')
      })
  }

  async function uploadLogo() {
    if (!selectedLogoFile) {
      alert('Selecione uma imagem para enviar.')
      return
    }

    if (!selectedLogoFile.type.startsWith('image/')) {
      alert('Selecione um arquivo de imagem.')
      return
    }

    if (selectedLogoFile.size > 3 * 1024 * 1024) {
      alert('A logo deve ter no máximo 3 MB.')
      return
    }

    const data = new FormData()
    data.append('logo', selectedLogoFile)
    setLogoUploading(true)

    try {
      const response = await fetch(`${API}/me/logo`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: data,
      })

      const text = await response.text()
      let result: any = {}

      try {
        result = text ? JSON.parse(text) : {}
      } catch {
        result = { error: text || 'Resposta inválida do servidor.' }
      }

      if (!response.ok || result.error) {
        alert(result.error || 'Não foi possível enviar a logo.')
        return
      }

      setSelectedLogoFile(null)
      setUser((current: any) => ({
        ...current,
        organization: {
          ...current?.organization,
          logoUrl: result.logoUrl,
        },
      }))
      loadProfile()
      alert('Logo enviada com sucesso.')
    } catch {
      alert('Falha de conexão ao enviar a logo.')
    } finally {
      setLogoUploading(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      goHome()
      return
    }

    loadProfile()
  }, [])

  return (
    <div className="saasLayout">
      <ClientSidebar isMasterPlan={user?.organization?.plan === 'master' || user?.organization?.plan === 'free'} />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">👤 Perfil do cliente</div>
          <h1>Perfil da Arena</h1>
          <p>Atualize os dados do cliente, contato e logo exibida no sistema.</p>
        </header>

        <div className="profileGrid">
          <div className="panel profileLogoPanel">
            <h2>Logo / Foto</h2>
            {user?.organization?.logoUrl ? (
              <img src={user.organization.logoUrl} className="profileLogoPreview" />
            ) : (
              <div className="profileLogoEmpty">Sem logo</div>
            )}

            <label className="fileButton">
              Selecionar arquivo
              <input
                type="file"
                accept="image/*"
                onChange={e => setSelectedLogoFile(e.target.files?.[0] || null)}
                disabled={logoUploading}
              />
            </label>

            {selectedLogoFile && (
              <p className="fileHint">{selectedLogoFile.name}</p>
            )}

            <button
              className="primaryButton"
              type="button"
              onClick={uploadLogo}
              disabled={logoUploading || !selectedLogoFile}
            >
              {logoUploading ? 'Enviando...' : 'Salvar logo'}
            </button>
          </div>

          <div className="panel settingsPanel">
            <h2>Dados do cliente</h2>

            <label>Nome do responsável</label>
            <input value={form.name} onChange={e => updateField('name', e.target.value)} />

            <label>E-mail</label>
            <input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} />

            <label>Telefone / WhatsApp</label>
            <input value={form.phone} onChange={e => updateField('phone', e.target.value)} />

            <label>Nome da arena / organização</label>
            <input value={form.organizationName} onChange={e => updateField('organizationName', e.target.value)} />

            <div className="profileAddressGrid">
              <div>
                <label>Tipo de documento</label>
                <select value={form.documentType} onChange={e => updateField('documentType', e.target.value)}>
                  <option value="CNPJ">CNPJ</option>
                  <option value="CPF">CPF</option>
                  <option value="RG">RG</option>
                </select>
              </div>

              <div>
                <label>Número do documento</label>
                <input value={form.documentNumber} onChange={e => updateField('documentNumber', e.target.value)} />
              </div>
            </div>

            <label>Esportes atendidos</label>
            <div className="sportsPicker">
              {SPORT_OPTIONS.map(sport => (
                <label key={sport}>
                  <input
                    type="checkbox"
                    checked={profileSports.includes(sport)}
                    onChange={() => toggleProfileSport(sport)}
                  />
                  {sport}
                </label>
              ))}
            </div>

            <p className="helperText">
              Validação: {user?.organization?.kycStatus || 'pending'}
            </p>

            <div className="profileAddressGrid">
              <div>
                <label>Logradouro</label>
                <input value={form.street} onChange={e => updateField('street', e.target.value)} />
              </div>

              <div>
                <label>Número</label>
                <input value={form.number} onChange={e => updateField('number', e.target.value)} />
              </div>

              <div>
                <label>Complemento</label>
                <input value={form.complement} onChange={e => updateField('complement', e.target.value)} />
              </div>

              <div>
                <label>País</label>
                <input value={form.country} onChange={e => updateField('country', e.target.value)} />
              </div>

              <div>
                <label>Estado</label>
                <input value={form.state} onChange={e => updateField('state', e.target.value)} />
              </div>

              <div>
                <label>Cidade</label>
                <input value={form.city} onChange={e => updateField('city', e.target.value)} />
              </div>
            </div>

            <button className="primaryButton" onClick={saveProfile}>
              Salvar perfil
            </button>
          </div>

          <div className="panel settingsPanel profilePasswordPanel">
            <h2>Alterar senha</h2>

            <label>Senha atual</label>
            <input
              type="password"
              value={passwordForm.currentPassword}
              onChange={e => updatePasswordField('currentPassword', e.target.value)}
            />

            <label>Nova senha</label>
            <input
              type="password"
              value={passwordForm.newPassword}
              onChange={e => updatePasswordField('newPassword', e.target.value)}
            />

            <label>Confirmar nova senha</label>
            <input
              type="password"
              value={passwordForm.confirmPassword}
              onChange={e => updatePasswordField('confirmPassword', e.target.value)}
            />

            <button className="primaryButton" onClick={changePassword}>
              Alterar senha
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function UsersPage() {
  const [user, setUser] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'operator',
  })

  const isMasterPlan = user?.organization?.plan === 'master' || user?.organization?.plan === 'free'
  const allowedUsers = isMasterPlan ? 4 : 1
  const remainingUsers = Math.max(allowedUsers - users.length, 0)

  function loadUsers() {
    setLoading(true)
    fetch(`${API}/me/users`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setUser(data.user)
        setUsers(data.users || [])
      })
      .finally(() => setLoading(false))
  }

  function updateUserField(field: string, value: string) {
    setForm(current => ({ ...current, [field]: value }))
  }

  async function createUser() {
    if (!form.name || !form.email || !form.password) {
      alert('Preencha nome, e-mail e senha.')
      return
    }

    if (!isMasterPlan) {
      alert('Usuários/equipe está disponível no plano Master.')
      return
    }

    setSaving(true)
    try {
      const response = await fetch(`${API}/me/users/create`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(form),
      })

      const data = await response.json()

      if (!response.ok || data.error) {
        alert(data.error || 'Não foi possível criar o usuário.')
        return
      }

        setForm({
          name: '',
          email: '',
          phone: '',
          password: '',
          role: 'operator',
        })
      loadUsers()
      alert('Usuário criado com sucesso.')
    } catch {
      alert('Falha de conexão ao criar usuário.')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn()) {
      goHome()
      return
    }

    loadUsers()
  }, [])

  return (
    <div className="saasLayout">
      <ClientSidebar isMasterPlan={isMasterPlan} />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">👥 Usuários</div>
          <h1>Usuários da equipe</h1>
          <p>Crie acessos para organizadores acompanharem e operarem torneios da arena.</p>
        </header>

        <div className="usersLayout">
          <section className="panel settingsPanel">
            <h2>Novo usuário</h2>

            {!isMasterPlan && (
              <div className="noticeBox">
                Usuários/equipe está disponível no plano Master.
              </div>
            )}

            <label>Nome</label>
            <input
              value={form.name}
              onChange={e => updateUserField('name', e.target.value)}
              disabled={!isMasterPlan || saving}
            />

            <label>E-mail</label>
            <input
              type="email"
              value={form.email}
              onChange={e => updateUserField('email', e.target.value)}
              disabled={!isMasterPlan || saving}
            />

            <label>WhatsApp</label>
            <input
              value={form.phone}
              onChange={e => updateUserField('phone', e.target.value)}
              placeholder="Ex: 11999999999"
              disabled={!isMasterPlan || saving}
            />

            <label>Senha inicial</label>
            <input
              type="password"
              value={form.password}
              onChange={e => updateUserField('password', e.target.value)}
              disabled={!isMasterPlan || saving}
            />

            <label>Perfil</label>
            <select
              value={form.role}
              onChange={e => updateUserField('role', e.target.value)}
              disabled={!isMasterPlan || saving}
            >
              <option value="operator">Organizador</option>
              <option value="viewer">Visualizador</option>
              <option value="admin">Administrador</option>
            </select>

            <button
              className="primaryButton"
              onClick={createUser}
              disabled={!isMasterPlan || saving || remainingUsers === 0}
            >
              {saving ? 'Criando...' : 'Criar usuário'}
            </button>
          </section>

          <section className="panel">
            <div className="usersHeader">
              <div>
                <h2>Equipe cadastrada</h2>
                <p>{users.length} de {allowedUsers} usuário(s) usados</p>
              </div>
              <strong>{remainingUsers} vaga(s)</strong>
            </div>

            {loading ? (
              <p className="emptyColumn">Carregando usuários...</p>
            ) : users.length === 0 ? (
              <p className="emptyColumn">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="usersList">
                {users.map(teamUser => (
                  <div key={teamUser.id} className="userRow">
                    <div>
                      <strong>{teamUser.name}</strong>
                      <span>{teamUser.email}</span>
                      {teamUser.phone && <span>WhatsApp: {teamUser.phone}</span>}
                    </div>
                    <span className={`statusBadge ${teamUser.role}`}>
                      {teamUser.role === 'admin' ? 'Administrador' : teamUser.role === 'viewer' ? 'Visualizador' : 'Organizador'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}

function Dashboard({ user }: any) {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<any[]>([])
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [detailsTournament, setDetailsTournament] = useState<any>(null)
  const [openTournamentMenuId, setOpenTournamentMenuId] = useState<number | null>(null)
  const plan = user?.organization?.plan || 'trial'
  const isMasterPlan = plan === 'master' || plan === 'free'
  const finishedCount = tournaments.filter(t => t.status === 'finished').length
  const canceledCount = tournaments.filter(t =>
    ['canceled', 'cancelled', 'cancelado'].includes(String(t.status).toLowerCase())
  ).length
  const futureCount = tournaments.filter(t =>
    t.status !== 'finished' && !['canceled', 'cancelled', 'cancelado'].includes(String(t.status).toLowerCase())
  ).length

  function logout() {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  function loadMyTournaments() {
    fetch(`${API}/me/tournaments`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setTournaments(Array.isArray(data) ? data : []))
  }

  useEffect(() => {
  if (!isLoggedIn()) {
    goHome()
    return
  }

  loadMyTournaments()
}, [])

    if (!user) {
    return <div className="app">Carregando dashboard...</div>
  }

  return (
    <div className="saasLayout">
      <ClientSidebar isMasterPlan={isMasterPlan} onLogout={logout} />

      <main className="saasMain">
        <header className="hero">
	  <div className="profileMenu">
  <button onClick={() => navigate('/app/perfil')}>
    👤 {user?.name || 'Perfil'}
  </button>
</div>
          <div className="badge">🎱 ProMaster Arena</div>

          {user?.organization?.logoUrl && (
            <img src={user.organization.logoUrl} className="logo" />
          )}

          <h1>Painel da Arena</h1>
          <p>{user?.organization?.name}</p>
        </header>

        <div className="dashboardStatsGrid">
          <div className="dashboardStatCard">
            <span>Finalizados</span>
            <strong>{finishedCount}</strong>
          </div>

          <div className="dashboardStatCard">
            <span>Futuros</span>
            <strong>{futureCount}</strong>
          </div>

          <div className="dashboardStatCard">
            <span>Cancelados</span>
            <strong>{canceledCount}</strong>
          </div>

          <button className="dashboardCreateCard" onClick={() => navigate('/criar-torneio')}>
            <span>+</span>
            <strong>Criar Torneio</strong>
          </button>
        </div>

        <div id="meus-torneios" className="panel">
          <h2>Meus Torneios</h2>

          {tournaments.length === 0 && <p>Nenhum torneio encontrado.</p>}

          {tournaments.length > 0 && (
            <div className="tournamentsTableWrap">
              <table className="tournamentsTable">
                <thead>
                  <tr>
                    <th>Nome do torneio</th>
                    <th>Local</th>
                    <th>Data</th>
                    <th>Status</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tournaments.map(t => {
                    const publicUrl = publicTournamentUrl(t.publicSlug)

                    return (
                      <tr key={t.id}>
                        <td>
                          <button className="tableLinkButton" onClick={() => navigate(`/tournament/${t.id}`)}>
                            {t.name}
                          </button>
                        </td>
                        <td>{t.location || 'Local não informado'}</td>
                        <td>{t.eventDate ? new Date(t.eventDate).toLocaleDateString() : '-'}</td>
                        <td><span className={`statusBadge ${t.status}`}>{tournamentStatusLabel(t.status)}</span></td>
                        <td>
                          <div className="tableActions">
                            <button className="tableActionIconButton" title="Painel" onClick={() => navigate(`/tournament/${t.id}`)}>▣</button>
                            <button className="tableActionIconButton" title="Detalhes" onClick={() => setDetailsTournament(t)}>i</button>
                            <button className="tableActionIconButton" title="Financeiro" onClick={() => navigate(`/tournament/${t.id}/financeiro`)}>$</button>
                            <div className="tableActionMenu">
                              <button
                                className="tableActionIconButton"
                                title="Mais ações"
                                onClick={() => setOpenTournamentMenuId(current => current === t.id ? null : t.id)}
                              >
                                ⋯
                              </button>
                              {openTournamentMenuId === t.id && (
                                <div className="tableActionMenuList">
                                  <button
                                    disabled={!t.publicSlug}
                                    onClick={() => {
                                      navigator.clipboard.writeText(publicUrl)
                                      setOpenTournamentMenuId(null)
                                    }}
                                  >
                                    Copiar link
                                  </button>
                                  <button
                                    disabled={!t.publicSlug}
                                    onClick={() => {
                                      setQrUrl(publicUrl)
                                      setOpenTournamentMenuId(null)
                                    }}
                                  >
                                    QR Code
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {qrUrl && (
          <div className="qrModal" onClick={() => setQrUrl(null)}>
            <div className="qrContent" onClick={e => e.stopPropagation()}>
              <h3>QR Code do Torneio</h3>
              <QRCodeCanvas value={qrUrl} size={220} />
              <p>{qrUrl}</p>
              <button onClick={() => setQrUrl(null)}>Fechar</button>
            </div>
          </div>
        )}

        {detailsTournament && (
          <div className="qrModal" onClick={() => setDetailsTournament(null)}>
            <div className="detailsContent" onClick={e => e.stopPropagation()}>
              <div className="detailsHeader">
                <div>
                  <span>Detalhes do torneio</span>
                  <h3>{detailsTournament.name}</h3>
                </div>
                <button onClick={() => setDetailsTournament(null)}>Fechar</button>
              </div>

              <div className="detailsList">
                <div>
                  <span>Status</span>
                  <strong>{tournamentStatusLabel(detailsTournament.status)}</strong>
                </div>
                <div>
                  <span>Jogadores</span>
                  <strong>{detailsTournament.playerCount}</strong>
                </div>
                <div>
                  <span>Data</span>
                  <strong>{detailsTournament.eventDate ? new Date(detailsTournament.eventDate).toLocaleDateString() : '-'}</strong>
                </div>
                <div>
                  <span>Horário</span>
                  <strong>{detailsTournament.eventTime || '-'}</strong>
                </div>
                <div>
                  <span>Endereço</span>
                  <strong>{detailsTournament.venueAddress || '-'}</strong>
                </div>
                <div>
                  <span>Premiação</span>
                  <strong>{detailsTournament.prize || '-'}</strong>
                </div>
                <div>
                  <span>Transmissão</span>
                  <strong>
                    {detailsTournament.broadcastType === 'obs'
                      ? 'OBS configurado'
                      : detailsTournament.youtubeUrl
                        ? 'YouTube configurado'
                        : 'Não configurada'}
                  </strong>
                </div>
                {detailsTournament.youtubeUrl && (
                  <div>
                    <span>Link YouTube</span>
                    <a href={detailsTournament.youtubeUrl} target="_blank" rel="noreferrer">
                      Abrir transmissão
                    </a>
                  </div>
                )}
                {detailsTournament.broadcastType === 'obs' && detailsTournament.obsStreamUrl && (
                  <div>
                    <span>URL OBS / RTMP</span>
                    <strong>{detailsTournament.obsStreamUrl}</strong>
                  </div>
                )}
                {detailsTournament.publicSlug && (
                  <div>
                    <span>Página pública</span>
                    <a href={publicTournamentUrl(detailsTournament.publicSlug)} target="_blank" rel="noreferrer">
                      Abrir página
                    </a>
                  </div>
                )}
                <div className="detailsRules">
                  <span>Regras</span>
                  <strong>{detailsTournament.rules || '-'}</strong>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function TournamentOverview({ defaultPanel = 'overview' }: { defaultPanel?: string } = {}) {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<any>(null)
  const [rounds, setRounds] = useState<any[]>([])
  const [ranking, setRanking] = useState<any[]>([])
  const initialPanel = new URLSearchParams(window.location.search).get('painel') || defaultPanel
  const [panel, setPanel] = useState(initialPanel)
  const [selectedRegistrationIds, setSelectedRegistrationIds] = useState<number[]>([])
  const [registrationSearch, setRegistrationSearch] = useState('')
  const [registrationStatusFilter, setRegistrationStatusFilter] = useState('all')
  const [paymentStatusFilter, setPaymentStatusFilter] = useState('all')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all')
  const [showAddRegistration, setShowAddRegistration] = useState(false)
  const [addRegistrationLoading, setAddRegistrationLoading] = useState(false)
  const [showGeneralMessageMenu, setShowGeneralMessageMenu] = useState(false)
  const [openStatusMenuId, setOpenStatusMenuId] = useState<number | null>(null)
  const [openPaymentMenuId, setOpenPaymentMenuId] = useState<number | null>(null)
  const [overviewQrUrl, setOverviewQrUrl] = useState<string | null>(null)
  const [bingoState, setBingoState] = useState<any>(null)
  const [addRegistrationForm, setAddRegistrationForm] = useState({
    name: '',
    rg: '',
    email: '',
    phone: '',
  })

  const registrations = Array.isArray(tournament?.registrations) ? tournament.registrations : []
  const confirmed = registrations.filter((registration: any) => registration.status === 'confirmed')
  const pending = registrations.filter((registration: any) => registration.status === 'pending')
  const waiting = registrations.filter((registration: any) => registration.status === 'waiting')
  const removed = registrations.filter((registration: any) => registration.status === 'removed')
  const activeRegistrations = registrations.filter((registration: any) => registration.status !== 'removed')
  const paidRegistrations = registrations.filter((registration: any) => registration.paymentStatus === 'paid' || registration.checkedIn)
  const matches = rounds.flatMap(round => round.matches || [])
  const playingMatches = matches.filter((match: any) => match.status === 'playing')
  const pendingMatches = matches.filter((match: any) => match.status === 'pending')
  const finishedMatches = matches.filter((match: any) => match.status === 'finished')
  const tournamentTableCount = Math.max(1, Number(tournament?.tableCount || 1))
  const tournamentTables = Array.from({ length: tournamentTableCount }, (_, index) => index + 1)
  const publicUrl = tournament?.publicSlug
    ? publicTournamentUrl(tournament.publicSlug)
    : ''
  const isBingoTournament = tournament?.format === 'bingo' || tournament?.sport?.slug === 'bingo'
  const bingoCards = bingoState?.cards || []
  const bingoDraws = bingoState?.draws || []
  const bingoWinners = bingoState?.winners || []
  const bingoSoldCards = bingoCards.filter((card: any) => card.source === 'online' || ['sold', 'paid', 'confirmed'].includes(card.status)).length
  const bingoRoundNames = Array.from(new Set([
    ...bingoDraws.map((draw: any) => draw.roundName).filter(Boolean),
    ...bingoWinners.map((winner: any) => winner.roundName).filter(Boolean),
  ]))
  const bingoRoundCount = bingoRoundNames.length || (bingoDraws.length > 0 ? 1 : 0)
  const expectedRevenue = Number(tournament?.registrationFee || 0) * confirmed.length
  const statusPriority: Record<string, number> = { confirmed: 1, pending: 2, waiting: 3, removed: 4 }
  const registrationRows = [...registrations].sort((a: any, b: any) => {
    const statusDiff = (statusPriority[a.status] || 99) - (statusPriority[b.status] || 99)
    if (statusDiff !== 0) return statusDiff

    const orderDiff = Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999)
    if (orderDiff !== 0) return orderDiff

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })
  const normalizedRegistrationSearch = registrationSearch.trim().toLowerCase()
  const filteredRegistrationRows = registrationRows.filter((registration: any) => {
    const matchesSearch = !normalizedRegistrationSearch
      || String(registration.name || '').toLowerCase().includes(normalizedRegistrationSearch)
      || String(registration.email || '').toLowerCase().includes(normalizedRegistrationSearch)
      || String(registration.phone || '').toLowerCase().includes(normalizedRegistrationSearch)
    const matchesStatus = registrationStatusFilter === 'all' || registration.status === registrationStatusFilter
    const matchesPayment = paymentStatusFilter === 'all' || paymentStatusValue(registration) === paymentStatusFilter
    const matchesMethod = paymentMethodFilter === 'all' || paymentMethodValue(registration) === paymentMethodFilter

    return matchesSearch && matchesStatus && matchesPayment && matchesMethod
  })
  const allRowsSelected = filteredRegistrationRows.length > 0
    && filteredRegistrationRows.every((registration: any) => selectedRegistrationIds.includes(registration.id))

  function loadTournamentOverview() {
    fetch(`${API}/tournaments/${id}`, { headers: authHeaders(), cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setTournament(data)
        if (data?.format === 'bingo' || data?.sport?.slug === 'bingo') {
          loadBingoOverview()
        }
      })

    fetch(`${API}/tournaments/${id}/bracket`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setRounds(Array.isArray(data.rounds) ? data.rounds : []))

    fetch(`${API}/tournaments/${id}/ranking`, { cache: 'no-store' })
      .then(res => res.json())
      .then(data => setRanking(Array.isArray(data) ? data : []))
  }

  function loadBingoOverview() {
    fetch(`${API}/tournaments/${id}/bingo`, { headers: authHeaders(), cache: 'no-store' })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setBingoState(data)
      })
  }

  useEffect(() => {
    loadTournamentOverview()
  }, [id])

  useEffect(() => {
    const queryPanel = new URLSearchParams(window.location.search).get('painel')
    setPanel(queryPanel || defaultPanel)
  }, [defaultPanel, id])

  function formatDateTime(value: string) {
    if (!value) return '-'
    const date = new Date(value)
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }

  function registrationStatusLabel(status: string) {
    const labels: Record<string, string> = {
      confirmed: 'Confirmado',
      pending: 'Pendente',
      waiting: 'Lista de espera',
      removed: 'Cancelado',
    }

    return labels[status] || status || '-'
  }

  function paymentStatusValue(registration: any) {
    if (registration.paymentStatus === 'paid' || registration.checkedIn) return 'paid'
    if (registration.paymentStatus === 'canceled' || registration.paymentStatus === 'refunded') return 'refunded'
    return 'pending'
  }

  function paymentStatusLabel(registration: any) {
    const status = paymentStatusValue(registration)
    if (status === 'paid') return 'Pago'
    if (status === 'refunded') return 'Estorno'
    return 'Aguardando'
  }

  function paymentStatusClass(registration: any) {
    return paymentStatusValue(registration)
  }

  function paymentMethodValue(registration: any) {
    return ['pix', 'card', 'cash'].includes(registration.paymentMethod)
      ? registration.paymentMethod
      : ''
  }

  function paymentMethodLabel(method: string) {
    const labels: Record<string, string> = {
      pix: 'Pix',
      card: 'Cartão',
      cash: 'Dinheiro',
    }

    return labels[method] || '-'
  }

  async function readApiResponse(response: Response, fallbackMessage: string) {
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.error) {
      alert(data.error || fallbackMessage)
      return null
    }

    return data
  }

  function toggleOverviewRegistrationSelection(registrationId: number, selected: boolean) {
    setSelectedRegistrationIds(current =>
      selected
        ? Array.from(new Set([...current, registrationId]))
        : current.filter(id => id !== registrationId)
    )
  }

  function toggleAllOverviewRegistrations(selected: boolean) {
    setSelectedRegistrationIds(selected ? filteredRegistrationRows.map((registration: any) => registration.id) : [])
  }

  async function updateOverviewRegistrationStatus(registration: any, status: string) {
    const response = await fetch(`${API}/registrations/${registration.id}/move`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ status }),
    })

    const data = await readApiResponse(response, 'Erro ao atualizar status da inscrição')
    if (!data) return

    setOpenStatusMenuId(null)
    loadTournamentOverview()
  }

  async function updateOverviewRegistrationPayment(registration: any, paymentStatus: string, paymentMethod = paymentMethodValue(registration)) {
    const response = await fetch(`${API}/registrations/${registration.id}/payment`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ paymentStatus, paymentMethod }),
    })

    const data = await readApiResponse(response, 'Erro ao atualizar pagamento da inscrição')
    if (!data) return

    setOpenPaymentMenuId(null)
    loadTournamentOverview()
  }

  function updateAddRegistrationField(field: string, value: string) {
    setAddRegistrationForm(current => ({ ...current, [field]: value }))
  }

  async function addOverviewRegistrationFromOrganizer() {
    if (!addRegistrationForm.name || !addRegistrationForm.rg || !addRegistrationForm.email || !addRegistrationForm.phone) {
      alert('Preencha nome, RG, e-mail e WhatsApp.')
      return
    }

    if (!isValidRg(addRegistrationForm.rg)) {
      alert('Informe um RG válido. Use apenas números/letras, com 5 a 12 caracteres.')
      return
    }

    if (!isValidBrazilCellphone(addRegistrationForm.phone)) {
      alert('Informe um celular válido com DDD. Exemplo: (11) 99009-8000.')
      return
    }

    setAddRegistrationLoading(true)

    const response = await fetch(`${API}/tournaments/${id}/registrations`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        ...addRegistrationForm,
        rg: formatRg(addRegistrationForm.rg),
        phone: normalizeBrazilPhone(addRegistrationForm.phone),
      }),
    })

    const data = await readApiResponse(response, 'Erro ao adicionar inscrição')
    setAddRegistrationLoading(false)
    if (!data) return

    setAddRegistrationForm({ name: '', rg: '', email: '', phone: '' })
    setShowAddRegistration(false)
    loadTournamentOverview()
    alert('Inscrição criada. O jogador receberá o link de confirmação por e-mail e WhatsApp.')
  }

  async function sendGeneralNotice(noticeType: string) {
    const labels: Record<string, string> = {
      confirmation: 'confirmação do torneio',
      cancellation: 'cancelamento do torneio',
      reschedule: 'alteração de data do torneio',
      refund: 'reembolso da inscrição',
    }

    if (!confirm(`Enviar mensagem geral de ${labels[noticeType]} aos inscritos?`)) return

    const response = await fetch(`${API}/tournaments/${id}/notify-players`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ noticeType }),
    })

    const data = await readApiResponse(response, 'Erro ao enviar mensagem geral')
    if (!data) return

    setShowGeneralMessageMenu(false)
    alert(`Mensagem geral enviada. E-mails: ${data.sentEmail || 0}. WhatsApp: ${data.sentWhatsApp || 0}.`)
  }

  function showRegistrationContact(registration: any) {
    alert([
      `Jogador: ${registration.name}`,
      `E-mail: ${registration.email || 'não informado'}`,
      `WhatsApp: ${registration.phone || 'não informado'}`,
      `RG: ${registration.rg || 'não informado'}`,
    ].join('\n'))
  }

  async function sendOverviewRegistrationMessage(registration: any) {
    const message = prompt(
      `Mensagem para ${registration.name}`,
      `Olá ${registration.name}, segue atualização sobre o torneio ${tournament.name}.`
    )

    if (!message || !message.trim()) return

    const response = await fetch(`${API}/registrations/${registration.id}/message`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message }),
    })

    const data = await readApiResponse(response, 'Erro ao enviar mensagem ao inscrito')
    if (!data) return

    alert('Mensagem enviada por e-mail e/ou WhatsApp conforme cadastro do jogador.')
  }

  function overviewMatchStatusLabel(status: string) {
    if (status === 'playing') return 'Em andamento'
    if (status === 'finished') return 'Finalizado'
    return 'Aguardando'
  }

  function matchesForTournamentTable(table: number) {
    return matches
      .filter((match: any) => Number(match.table || 0) === Number(table))
      .sort((a: any, b: any) => {
        const statusOrder: Record<string, number> = { playing: 1, pending: 2, finished: 3 }
        const statusDiff = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9)
        if (statusDiff !== 0) return statusDiff
        return Number(a.round || 0) - Number(b.round || 0) || Number(a.id || 0) - Number(b.id || 0)
      })
  }

  function primaryMatchForTournamentTable(table: number) {
    const tableMatches = matchesForTournamentTable(table)
    return tableMatches.find((match: any) => match.status === 'playing') ||
      tableMatches.find((match: any) => match.status === 'pending') ||
      tableMatches[0] ||
      null
  }

  function renderPanel() {
    if (panel === 'inscritos') {
      return (
        <section className="panel">
          <div className="sectionTitleRow">
            <div>
              <h2>Inscritos</h2>
              <p>Controle inscrições, status, pagamento e comunicação com os jogadores.</p>
            </div>

            <div className="sectionHeaderActions">
              <button className="primaryButton" onClick={() => setShowAddRegistration(true)}>
                + Nova inscrição
              </button>
              <div className="quickMenu">
                <button onClick={() => setShowGeneralMessageMenu(current => !current)}>
                  Mensagem geral
                </button>
                {showGeneralMessageMenu && (
                  <div className="quickMenuList">
                    <button onClick={() => sendGeneralNotice('confirmation')}>Confirmação do torneio</button>
                    <button onClick={() => sendGeneralNotice('cancellation')}>Cancelamento do torneio</button>
                    <button onClick={() => sendGeneralNotice('reschedule')}>Alteração de data</button>
                    <button onClick={() => sendGeneralNotice('refund')}>Reembolso da inscrição</button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="overviewMiniGrid registrationsStatsGrid">
            <div><span>Total inscritos</span><strong>{activeRegistrations.length}/{tournament?.playerCount || 0}</strong></div>
            <div><span>Pagos</span><strong>{paidRegistrations.length}</strong></div>
            <div><span>Pendente</span><strong>{pending.length}</strong></div>
            <div><span>Lista de espera</span><strong>{waiting.length}</strong></div>
            <div><span>Cancelados</span><strong>{removed.length}</strong></div>
          </div>

          <div className="registrationsFilters">
            <input
              value={registrationSearch}
              onChange={e => setRegistrationSearch(e.target.value)}
              placeholder="Buscar jogador"
            />
            <select value={registrationStatusFilter} onChange={e => setRegistrationStatusFilter(e.target.value)}>
              <option value="all">Todos os status</option>
              <option value="confirmed">Confirmado</option>
              <option value="pending">Pendente</option>
              <option value="waiting">Lista de espera</option>
              <option value="removed">Cancelado</option>
            </select>
            <select value={paymentStatusFilter} onChange={e => setPaymentStatusFilter(e.target.value)}>
              <option value="all">Todos pagamentos</option>
              <option value="paid">Pago</option>
              <option value="pending">Aguardando</option>
              <option value="refunded">Estorno</option>
            </select>
            <select value={paymentMethodFilter} onChange={e => setPaymentMethodFilter(e.target.value)}>
              <option value="all">Todas formas</option>
              <option value="pix">Pix</option>
              <option value="card">Cartão</option>
              <option value="cash">Dinheiro</option>
            </select>
          </div>

          <div className="registrationsTableWrap">
            <table className="registrationsTable">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allRowsSelected}
                      onChange={e => toggleAllOverviewRegistrations(e.target.checked)}
                      aria-label="Selecionar todos"
                    />
                  </th>
                  <th>Posição ranking</th>
                  <th>Jogador</th>
                  <th>Status do torneio</th>
                  <th>Pagamento</th>
                  <th>Forma de pagamento</th>
                  <th>Data inscrição</th>
                  <th>Ações rápidas</th>
                </tr>
              </thead>
              <tbody>
                {filteredRegistrationRows.map((registration: any) => (
                  <tr key={registration.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRegistrationIds.includes(registration.id)}
                        onChange={e => toggleOverviewRegistrationSelection(registration.id, e.target.checked)}
                        aria-label={`Selecionar ${registration.name}`}
                      />
                    </td>
                    <td>
                      <strong>{registration.status === 'confirmed' && registration.sortOrder ? `#${registration.sortOrder}` : '-'}</strong>
                    </td>
                    <td>
                      <div className="registrationPlayerCell">
                        <strong>{registration.name}</strong>
                      </div>
                    </td>
                    <td>
                      <span className={`registrationStatusPill ${registration.status || 'pending'}`}>
                        {registrationStatusLabel(registration.status)}
                      </span>
                    </td>
                    <td>
                      <div className="registrationPaymentCell">
                        <span className={`paymentIcon ${paymentStatusClass(registration)}`}>
                          {paymentStatusClass(registration) === 'paid' ? '$' : paymentStatusClass(registration) === 'refunded' ? '↩' : '⏳'}
                        </span>
                        <strong>{paymentStatusLabel(registration)}</strong>
                      </div>
                    </td>
                    <td>{paymentMethodLabel(paymentMethodValue(registration))}</td>
                    <td>{formatDateTime(registration.createdAt)}</td>
                    <td>
                      <div className="registrationTableActions">
                        <button className="iconActionButton" title="Visualizar dados do jogador" onClick={() => showRegistrationContact(registration)}>👁</button>

                        <div className="rowActionMenu">
                          <button
                            className="iconActionButton"
                            title="Editar status do torneio"
                            onClick={() => {
                              setOpenPaymentMenuId(null)
                              setOpenStatusMenuId(current => current === registration.id ? null : registration.id)
                            }}
                          >
                            ✎
                          </button>
                          {openStatusMenuId === registration.id && (
                            <div className="rowActionMenuList">
                              <strong>Status do torneio</strong>
                              <button onClick={() => updateOverviewRegistrationStatus(registration, 'confirmed')}>Confirmado</button>
                              <button onClick={() => updateOverviewRegistrationStatus(registration, 'pending')}>Pendente</button>
                              <button onClick={() => updateOverviewRegistrationStatus(registration, 'removed')}>Cancelado</button>
                              <button onClick={() => updateOverviewRegistrationStatus(registration, 'waiting')}>Lista espera</button>
                            </div>
                          )}
                        </div>

                        <button className="iconActionButton" title="Enviar mensagem" onClick={() => sendOverviewRegistrationMessage(registration)}>✉</button>

                        <div className="rowActionMenu">
                          <button
                            className="iconActionButton"
                            title="Pagamento e forma de pagamento"
                            onClick={() => {
                              setOpenStatusMenuId(null)
                              setOpenPaymentMenuId(current => current === registration.id ? null : registration.id)
                            }}
                          >
                            ⋯
                          </button>
                          {openPaymentMenuId === registration.id && (
                            <div className="rowActionMenuList paymentMenuList">
                              <strong>Pagamento</strong>
                              <button onClick={() => updateOverviewRegistrationPayment(registration, 'paid')}>Pago</button>
                              <button onClick={() => updateOverviewRegistrationPayment(registration, 'pending')}>Aguardando</button>
                              <button onClick={() => updateOverviewRegistrationPayment(registration, 'refunded')}>Estorno</button>

                              <strong>Pago através</strong>
                              <button onClick={() => updateOverviewRegistrationPayment(registration, 'paid', 'pix')}>Pix</button>
                              <button onClick={() => updateOverviewRegistrationPayment(registration, 'paid', 'card')}>Cartão</button>
                              <button onClick={() => updateOverviewRegistrationPayment(registration, 'paid', 'cash')}>Dinheiro</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredRegistrationRows.length === 0 && (
                  <tr>
                    <td colSpan={8}>Nenhuma inscrição registrada ainda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {showAddRegistration && (
            <div className="qrModal" onClick={() => setShowAddRegistration(false)}>
              <div className="detailsContent addRegistrationModal" onClick={e => e.stopPropagation()}>
                <div className="detailsHeader">
                  <div>
                    <span>Novo jogador</span>
                    <h3>Nova inscrição</h3>
                    <p>O jogador receberá um link de confirmação por e-mail e WhatsApp.</p>
                  </div>
                  <button className="modalCloseButton" onClick={() => setShowAddRegistration(false)}>Fechar</button>
                </div>

                <div className="addRegistrationGrid">
                  <div>
                    <label>Nome</label>
                    <input
                      value={addRegistrationForm.name}
                      onChange={e => updateAddRegistrationField('name', e.target.value)}
                      disabled={addRegistrationLoading}
                    />
                  </div>

                  <div>
                    <label>RG</label>
                    <input
                      value={addRegistrationForm.rg}
                      onChange={e => updateAddRegistrationField('rg', formatRg(e.target.value))}
                      disabled={addRegistrationLoading}
                    />
                  </div>

                  <div>
                    <label>E-mail</label>
                    <input
                      type="email"
                      value={addRegistrationForm.email}
                      onChange={e => updateAddRegistrationField('email', e.target.value)}
                      disabled={addRegistrationLoading}
                    />
                  </div>

                  <div>
                    <label>WhatsApp</label>
                    <input
                      value={addRegistrationForm.phone}
                      onChange={e => updateAddRegistrationField('phone', formatBrazilCellphone(e.target.value))}
                      placeholder="(11) 99009-8000"
                      inputMode="numeric"
                      disabled={addRegistrationLoading}
                    />
                  </div>
                </div>

                <div className="adminModalActions">
                  <button onClick={() => setShowAddRegistration(false)} disabled={addRegistrationLoading}>
                    Cancelar
                  </button>
                  <button className="primaryButton" onClick={addOverviewRegistrationFromOrganizer} disabled={addRegistrationLoading}>
                    {addRegistrationLoading ? 'Enviando...' : 'Adicionar e enviar confirmação'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>
      )
    }

    if (panel === 'financeiro') {
      return (
        <section className="panel">
          <h2>Financeiro do Torneio</h2>
          <div className="overviewMiniGrid">
            <div><span>Valor inscrição</span><strong>R$ {Number(tournament?.registrationFee || 0).toFixed(2).replace('.', ',')}</strong></div>
            <div><span>Confirmados</span><strong>{confirmed.length}</strong></div>
            <div><span>Receita prevista</span><strong>R$ {expectedRevenue.toFixed(2).replace('.', ',')}</strong></div>
          </div>
        </section>
      )
    }

    if (panel === 'arbitro') {
      return (
        <section className="panel">
          <div className="sectionTitleRow">
            <div>
              <h2>Painel Modo Árbitro</h2>
              <p>Resumo das mesas, jogos em andamento e acesso rápido ao controle de partidas.</p>
            </div>
            <button className="primaryButton" onClick={() => navigate(`/arbitro/${id}`)}>
              Abrir controle completo
            </button>
          </div>

          <div className="overviewMiniGrid">
            <div><span>Mesas configuradas</span><strong>{tournamentTableCount}</strong></div>
            <div><span>Partidas ativas</span><strong>{playingMatches.length + pendingMatches.length}</strong></div>
            <div><span>Aguardando chamada</span><strong>{pendingMatches.length}</strong></div>
          </div>

          <div className="tournamentRefereeGrid">
            <div>
              <h3>Controle das mesas</h3>
              <div className="tournamentRefereeTables">
                {tournamentTables.map(table => {
                  const tableMatches = matchesForTournamentTable(table)
                  const match = primaryMatchForTournamentTable(table)
                  const tablePlayingMatches = tableMatches.filter((item: any) => item.status === 'playing')
                  const tablePendingMatches = tableMatches.filter((item: any) => item.status === 'pending')

                  return (
                    <button key={table} className={`tournamentRefereeTableCard ${match?.status || 'empty'}`} onClick={() => navigate(`/arbitro/${id}?mesa=${table}`)}>
                      <span>Mesa {table}</span>
                      <strong>{tablePlayingMatches.length > 0 ? 'Jogos em andamento' : tablePendingMatches.length > 0 ? 'Aguardando chamada' : 'Livre'}</strong>

                      <div className="tournamentRefereeTableMatches">
                        <div className="tableMatchesBlock playingBlock">
                          <div className="tableMatchesBlockHeader">
                            <strong>Jogos em andamento</strong>
                            <span>{tablePlayingMatches.length}</span>
                          </div>
                          {tablePlayingMatches.length === 0 && <small>Nenhum jogo em andamento nesta mesa</small>}
                          {tablePlayingMatches.map((item: any) => (
                            <div key={item.id} className={`tableMatchLine ${item.status}`}>
                              <small>Jogo #{item.matchNumber} · Rodada {item.round}</small>
                              <b>{item.playerA || 'BYE'} x {item.playerB || 'BYE'}</b>
                              <em>{overviewMatchStatusLabel(item.status)} · {Number(item.scoreA || 0)} x {Number(item.scoreB || 0)}</em>
                            </div>
                          ))}
                        </div>

                        <div className="tableMatchesBlock">
                          <div className="tableMatchesBlockHeader">
                            <strong>Próximos da mesa</strong>
                            <span>{tablePendingMatches.length}</span>
                          </div>
                          {tablePendingMatches.length === 0 && <small>Nenhum jogo aguardando chamada</small>}
                          {tablePendingMatches.slice(0, 2).map((item: any) => (
                            <div key={item.id} className={`tableMatchLine ${item.status}`}>
                              <small>Jogo #{item.matchNumber} · Rodada {item.round}</small>
                              <b>{item.playerA || 'BYE'} x {item.playerB || 'BYE'}</b>
                              <em>{overviewMatchStatusLabel(item.status)} · {Number(item.scoreA || 0)} x {Number(item.scoreB || 0)}</em>
                            </div>
                          ))}
                        </div>
                      </div>

                      <em>{tablePlayingMatches.length} em andamento · {tablePendingMatches.length} aguardando</em>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </section>
      )
    }

    if (panel === 'patrocinadores') {
      return (
        <section className="panel">
          <h2>Patrocinadores</h2>
          <p>Área preparada para cadastrar marcas, cotas, exposição no telão e página pública.</p>
        </section>
      )
    }

    if (panel === 'publico') {
      return (
        <section className="panel publicPanel">
          <h2>Página pública</h2>
          {publicUrl ? (
            <>
              <QRCodeCanvas value={publicUrl} size={180} />
              <p>{publicUrl}</p>
              <button onClick={() => window.open(publicUrl, '_blank')}>Abrir página pública</button>
            </>
          ) : (
            <p>Este torneio ainda não possui link público.</p>
          )}
        </section>
      )
    }

    if (isBingoTournament) {
      return (
        <section className="panel">
          <h2>Dashboard do Bingo</h2>
          <div className="overviewStatsGrid bingoDashboardGrid">
            <div><span>Cartelas totais</span><strong>{bingoCards.length}</strong></div>
            <div><span>Cartelas vendidas</span><strong>{bingoSoldCards}</strong></div>
            <div><span>Rodadas</span><strong>{bingoRoundCount}</strong></div>
            <div><span>Premiação total</span><strong>{tournament?.prize || '-'}</strong></div>
          </div>

          <div className="overviewRankingCard">
            <div>
              <h3>Últimos números sorteados</h3>
              <p>Acompanhamento rápido do sorteio em tempo real.</p>
            </div>

            <div className="bingoNumbers">
              {bingoDraws.length === 0 && <p className="helperText">Nenhum número sorteado ainda.</p>}
              {bingoDraws.slice(-20).map((draw: any) => (
                <span key={draw.id}>{draw.number}</span>
              ))}
            </div>
          </div>
        </section>
      )
    }

    return (
      <section className="panel">
        <h2>Dashboard do torneio</h2>
        <div className="overviewStatsGrid">
          <div><span>Status</span><strong>{tournamentStatusLabel(tournament?.status)}</strong></div>
          <div><span>Inscritos</span><strong>{confirmed.length}/{tournament?.playerCount || 0}</strong></div>
          <div><span>Jogos</span><strong>{matches.length}</strong></div>
          <div><span>Em andamento</span><strong>{playingMatches.length}</strong></div>
          <div><span>Finalizados</span><strong>{finishedMatches.length}</strong></div>
          <div><span>Data</span><strong>{tournament?.eventDate ? new Date(tournament.eventDate).toLocaleDateString() : '-'}</strong></div>
        </div>

        <div className="overviewRankingCard">
          <div>
            <h3>Ranking do torneio</h3>
            <p>Acompanhamento por vitórias, derrotas e aproveitamento.</p>
          </div>

          <div className="overviewRankingList">
            {ranking.slice(0, 5).map((item: any, index: number) => (
              <div key={item.playerId || item.name} className="overviewRankingRow">
                <strong>{index + 1}. {item.name}</strong>
                <span>{item.wins}V / {item.losses}D</span>
                <em>{item.winRate}%</em>
              </div>
            ))}

            {ranking.length === 0 && (
              <p className="helperText">O ranking aparece assim que houver jogadores e resultados.</p>
            )}
          </div>
        </div>
      </section>
    )
  }

  if (!tournament) {
    return <div className="app">Carregando torneio...</div>
  }

  return (
    <div className="tournamentPageLayout">
      <aside className="tournamentMainSidebar">
        <div className="sidebarBrand">🎱 ProMaster</div>
        <button className="backDashboardButton" onClick={() => navigate('/app')}>
          Voltar ao painel principal
        </button>

        <div className="tournamentSidebarInfo">
          <span>Torneio</span>
          <strong>{tournament.name}</strong>
          <small>{tournamentStatusLabel(tournament.status)}</small>
        </div>

        <button className={panel === 'overview' ? 'active' : ''} onClick={() => navigate(`/tournament/${id}`)}>Dashboard</button>
        <button onClick={() => navigate(`/tournament/${id}/chaveamento`)}>{isBingoTournament ? 'AO VIVO' : 'Chaveamento'}</button>
        <button className={panel === 'inscritos' ? 'active' : ''} onClick={() => navigate(`/tournament/${id}/inscritos`)}>Inscritos</button>
        <button onClick={() => navigate(`/tournament/${id}/settings`)}>Configurações / edição</button>
        {!isBingoTournament && <button onClick={() => navigate(`/arbitro/${id}`)}>Modo árbitro</button>}
        <button className={panel === 'financeiro' ? 'active' : ''} onClick={() => navigate(`/tournament/${id}/financeiro`)}>Financeiro</button>
        <button className={panel === 'patrocinadores' ? 'active' : ''} onClick={() => navigate(`/tournament/${id}/patrocinadores`)}>Patrocinadores</button>
        {!isBingoTournament && <button className={panel === 'publico' ? 'active' : ''} onClick={() => navigate(`/tournament/${id}/publico`)}>QR Code público</button>}
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">Painel do Torneio</div>
          <h1>{tournament.name}</h1>
          <p>{tournament.location || 'Local não informado'}{tournament.eventDate ? ` • ${new Date(tournament.eventDate).toLocaleDateString()}` : ''}</p>
          <div className="heroActions tournamentHeroActions">
            <button onClick={() => window.open(`/telao/${id}`, '_blank')}>Telão</button>
            <button disabled={!publicUrl} onClick={() => publicUrl && window.open(publicUrl, '_blank')}>Público</button>
            <button disabled={!publicUrl} onClick={() => publicUrl && navigator.clipboard.writeText(publicUrl)}>Compartilhar link</button>
            <button disabled={!publicUrl} onClick={() => publicUrl && setOverviewQrUrl(publicUrl)}>QR Code</button>
          </div>
        </header>

        <div className="tournamentWorkspace">
          <div className="tournamentPanelContent">
            {renderPanel()}
          </div>
        </div>

        {overviewQrUrl && (
          <div className="qrModal" onClick={() => setOverviewQrUrl(null)}>
            <div className="qrContent" onClick={event => event.stopPropagation()}>
              <h3>QR Code do Torneio</h3>
              <QRCodeCanvas value={overviewQrUrl} size={220} />
              <p>{overviewQrUrl}</p>
              <button onClick={() => setOverviewQrUrl(null)}>Fechar</button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Upgrade() {
  const [pixData, setPixData] = useState<any>(null)
  const [pixLoading, setPixLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])
  const [selectedPlan, setSelectedPlan] = useState('')
  const [showCancel, setShowCancel] = useState(false)
  const [cancelReasons, setCancelReasons] = useState<string[]>([])

  const plan = user?.organization?.plan || 'trial'
  const planLabel = plan === 'free' ? 'ACESSO GRATUITO' : plan.toUpperCase()
  const selectedPlanLabel = selectedPlan
    ? selectedPlan === 'free'
      ? 'ACESSO GRATUITO'
      : selectedPlan === 'avulso'
        ? 'AVULSO'
        : selectedPlan.toUpperCase()
    : planLabel
  const trialEndsAt = user?.organization?.trialEndsAt
  const planExpiresAt = user?.organization?.planExpiresAt
  const tournamentCredits = user?.organization?.tournamentCredits || 0

  function createPix(plan: string) {
    setSelectedPlan(plan)
    setShowCancel(false)
    setPixLoading(true)

    fetch(`${API}/billing/create-pix`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ plan }),
    })
      .then(res => res.json())
      .then(data => setPixData(data))
      .finally(() => setPixLoading(false))
  }

  function toggleCancelReason(reason: string) {
    setCancelReasons(current =>
      current.includes(reason)
        ? current.filter(item => item !== reason)
        : [...current, reason]
    )
  }

  function refreshAccount() {
    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (!data.user) return

        setUser(data.user)
        setSelectedPlan(data.user.organization?.plan || 'trial')
      })
  }

  useEffect(() => {
    refreshAccount()

    fetch(`${API}/me/payments`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setPayments(Array.isArray(data) ? data : []))
  }, [])

  useEffect(() => {
    const interval = setInterval(refreshAccount, 15000)
    const onFocus = () => refreshAccount()
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshAccount()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  useEffect(() => {
    if (!pixData?.paymentId) return

    const interval = setInterval(() => {
      fetch(`${API}/billing/payment/${pixData.paymentId}/status`, {
        headers: authHeaders(),
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'approved') {
            alert('Pagamento aprovado! Plano ou crédito atualizado.')
            window.location.href = '/upgrade'
          }
        })
    }, 5000)

    return () => clearInterval(interval)
  }, [pixData?.paymentId])

  return (
    <div className="saasLayout">
      <ClientSidebar isMasterPlan={user?.organization?.plan === 'master' || user?.organization?.plan === 'free'} />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">💳 ProMaster Arena</div>
          <h1>Planos e pagamentos</h1>
          <p>Consulte seu plano, vencimento, alterações e histórico financeiro.</p>
        </header>

      <div className="panel">
        <h2>Plano atual</h2>

        <div className="planSummary planSummaryWide">
          <div>
            <span>Plano</span>
            <strong>{planLabel}</strong>
          </div>

          <div>
            <span>Plano selecionado</span>
            <strong>{selectedPlanLabel}</strong>
          </div>

          <div>
            <span>Início</span>
            <strong>{user?.organization?.createdAt ? new Date(user.organization.createdAt).toLocaleDateString() : '-'}</strong>
          </div>

          <div>
            <span>Vencimento</span>
            <strong>
              {planExpiresAt
                ? new Date(planExpiresAt).toLocaleDateString()
                : trialEndsAt
                  ? new Date(trialEndsAt).toLocaleDateString()
                  : 'Sem vencimento'}
            </strong>
          </div>

          <div>
            <span>Créditos avulsos</span>
            <strong>{tournamentCredits}</strong>
          </div>

          <div className="planActions">
            <button onClick={() => window.scrollTo({ top: 420, behavior: 'smooth' })}>Upgrade</button>
            <button onClick={() => {
              setSelectedPlan('pro')
              setShowCancel(false)
              window.scrollTo({ top: 420, behavior: 'smooth' })
            }}>
              Downgrade
            </button>
            <button onClick={() => {
              setSelectedPlan('cancelamento')
              setShowCancel(true)
            }}>
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {showCancel && (
        <div className="panel cancelPanel">
          <h2>Confirmar cancelamento</h2>
          <p>Antes de cancelar, selecione o motivo principal. Isso ajuda a melhorar o ProMaster Arena.</p>

          <div className="cancelReasons">
            {[
              'Valor acima do esperado',
              'Usei apenas para um evento',
              'Faltou alguma funcionalidade',
              'Achei difícil de usar',
              'Vou migrar para outra solução',
            ].map(reason => (
              <label key={reason}>
                <input
                  type="checkbox"
                  checked={cancelReasons.includes(reason)}
                  onChange={() => toggleCancelReason(reason)}
                />
                {reason}
              </label>
            ))}
          </div>

          <div className="cancelActions">
            <button onClick={() => {
              setShowCancel(false)
              setSelectedPlan(plan)
              setCancelReasons([])
            }}>
              Manter plano
            </button>
            <button
              className="dangerButton"
              onClick={() => {
                if (cancelReasons.length === 0) {
                  alert('Selecione pelo menos um motivo para continuar.')
                  return
                }

                alert('Solicitação de cancelamento registrada. O suporte finalizará o processo.')
                setShowCancel(false)
              }}
            >
              Confirmar cancelamento
            </button>
          </div>
        </div>
      )}

      <div className="billingPlansGrid">
        <div className={selectedPlan === 'trial' ? 'panel billingPlanCard selectedPlanCard' : 'panel billingPlanCard'}>
          <h2>TRIAL FREE</h2>
          <p>7 dias grátis ou 1 torneio</p>
          <p>Acesso aos principais recursos. Após expirar, mantém login e edição dos torneios existentes, mas bloqueia novos torneios.</p>
          <button onClick={() => setSelectedPlan('trial')}>
            Plano atual inicial
          </button>
        </div>

        <div className={selectedPlan === 'pro' ? 'panel billingPlanCard selectedPlanCard' : 'panel billingPlanCard'}>
          <h2>PRO</h2>
          <p>R$ 59,90/mês</p>
          <p>Mesmas funções principais, com torneios ilimitados até 64 jogadores.</p>
          <button className="primaryButton" onClick={() => createPix('pro')}>
            Gerar Pix PRO
          </button>
        </div>

        <div className={selectedPlan === 'master' ? 'panel billingPlanCard selectedPlanCard' : 'panel billingPlanCard'}>
          <h2>MASTER</h2>
          <p>R$ 89,90/mês</p>
          <p>Torneios acima de 64 jogadores, usuários/equipe e recursos avançados.</p>
          <button className="upgradeButton" onClick={() => createPix('master')}>
            Gerar Pix MASTER
          </button>
        </div>

        <div className={selectedPlan === 'avulso' ? 'panel billingPlanCard selectedPlanCard' : 'panel billingPlanCard'}>
          <h2>Avulso</h2>
          <p>R$ 21,90 por torneio</p>
          <p>Crédito para criar 1 torneio, ideal para eventos únicos.</p>
          <button onClick={() => createPix('avulso')}>
            Gerar Pix Avulso
          </button>
        </div>
      </div>

      {pixLoading && <p>Gerando Pix...</p>}

      {pixData?.qrCodeBase64 && (
        <div className="panel" style={{ maxWidth: 520, margin: '30px auto' }}>
          <h2>Pix gerado</h2>
          <p>Status: aguardando pagamento...</p>

          <img
            src={`data:image/png;base64,${pixData.qrCodeBase64}`}
            style={{ width: 260, maxWidth: '100%', background: 'white', padding: 12 }}
          />

          <textarea
            readOnly
            value={pixData.qrCode}
            style={{ width: '100%', height: 120, marginTop: 16 }}
          />

          <button className="primaryButton" onClick={() => navigator.clipboard.writeText(pixData.qrCode)}>
            Copiar Pix
          </button>

          {pixData.ticketUrl && (
            <button onClick={() => window.open(pixData.ticketUrl, '_blank')}>
              Abrir pagamento
            </button>
          )}
        </div>
      )}

      <div className="panel" style={{ marginTop: 30 }}>
        <h2>Histórico de pagamentos</h2>

        {payments.length === 0 && <p>Nenhum pagamento registrado.</p>}

        {payments.map(payment => (
          <div key={payment.id} className="paymentHistoryRow">
            <div>
              <strong>{payment.plan?.toUpperCase()}</strong>
              <span>{new Date(payment.createdAt).toLocaleDateString()}</span>
            </div>
            <div>
              <strong>R$ {Number(payment.amount).toFixed(2).replace('.', ',')}</strong>
              <span>{payment.status}</span>
            </div>
          </div>
        ))}
      </div>
      </main>
    </div>
  )
}

function TournamentSettings() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [tournament, setTournament] = useState<any>(null)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [playerLimit, setPlayerLimit] = useState(0)
  const [phaseRules, setPhaseRules] = useState<any[]>([])
  const [scheduleRows, setScheduleRows] = useState<any[]>([])
  const [scheduleDayCount, setScheduleDayCount] = useState(1)
  const [form, setForm] = useState<any>({
    name: '',
    location: '',
    venueAddress: '',
    eventDate: '',
    eventTime: '',
    prize: '',
    rules: '',
    playerCount: '',
    format: 'knockout',
    tableCount: '',
    broadcastType: 'none',
    youtubeUrl: '',
    obsStreamUrl: '',
    liveStarted: false,
    registrationOpen: true,
    registrationFee: '',
    paymentCollectionMode: 'manual',
    paymentLink: '',
    matchQuantity: '',
    matchQuantityMode: '',
    scheduleMode: 'single_day',
    phaseSchedule: '',
    phaseMatchRules: '',
    bingoMode: 'physical',
    bingoDrawMode: 'physical',
    bingoCardMode: 'physical',
    bingoMaxNumber: 75,
    bingoCardPrice: '',
    bingoCardsPerParticipant: 1,
  })

  function loadTournamentSettings(refreshForm = false) {
    fetch(`${API}/tournaments/${id}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        setTournament(data)
        if (refreshForm) {
          setForm({
            name: data.name || '',
            location: data.location || '',
            venueAddress: data.venueAddress || '',
            eventDate: data.eventDate ? data.eventDate.slice(0, 10) : '',
            eventTime: data.eventTime || '',
            prize: data.prize || '',
            rules: data.rules || '',
            playerCount: data.playerCount || '',
            format: data.format || 'knockout',
            tableCount: data.tableCount || '',
            broadcastType: data.broadcastType || (data.youtubeUrl ? 'youtube' : 'none'),
            youtubeUrl: data.youtubeUrl || '',
            obsStreamUrl: data.obsStreamUrl || '',
            liveStarted: Boolean(data.liveStarted),
            registrationOpen: data.registrationOpen !== false,
            registrationFee: data.registrationFee || '',
            paymentCollectionMode: data.paymentCollectionMode || 'manual',
            paymentLink: data.paymentLink || '',
            matchQuantity: data.matchQuantity || '',
            matchQuantityMode: data.matchQuantityMode || '',
            scheduleMode: data.scheduleMode || 'single_day',
            phaseSchedule: data.phaseSchedule || '',
            phaseMatchRules: data.phaseMatchRules || '',
            bingoMode: data.bingoMode || 'physical',
            bingoDrawMode: data.bingoDrawMode || 'physical',
            bingoCardMode: data.bingoCardMode || 'physical',
            bingoMaxNumber: data.bingoMaxNumber || 75,
            bingoCardPrice: data.bingoCardPrice || '',
            bingoCardsPerParticipant: data.bingoCardsPerParticipant || 1,
          })
          setPhaseRules(safeJsonArray(data.phaseMatchRules))
          const loadedScheduleRows = safeJsonArray(data.phaseSchedule)
          setScheduleRows(loadedScheduleRows)
          setScheduleDayCount(Math.max(1, loadedScheduleRows.length || 1))
        }
        setPlayerLimit(Number(data.playerCount || 0))
        const loadedRegistrations = Array.isArray(data.registrations) ? data.registrations : []
        setRegistrations(loadedRegistrations)
      })
  }

  useEffect(() => {
    loadTournamentSettings(true)
    const interval = setInterval(() => loadTournamentSettings(false), 10000)
    return () => clearInterval(interval)
  }, [id])

  function updateField(field: string, value: string | boolean) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function updateBingoMode(value: string) {
    setForm((current: any) => {
      if (value === 'physical') {
        return { ...current, bingoMode: value, bingoCardMode: 'physical', bingoDrawMode: 'physical' }
      }

      if (value === 'virtual') {
        return { ...current, bingoMode: value, bingoCardMode: 'virtual', bingoDrawMode: 'virtual' }
      }

      return { ...current, bingoMode: value, bingoCardMode: 'mixed', bingoDrawMode: 'virtual' }
    })
  }

  const effectivePlayerLimit = Number(form.playerCount || playerLimit || 0)
  const tournamentPhases = buildTournamentPhases(effectivePlayerLimit)

  function updatePhaseRule(phase: number, field: string, value: string) {
    setPhaseRules(current => {
      const existing = current.find(item => Number(item.phase) === phase) || { phase, matchQuantity: '', appliesTo: 'phase' }
      const next = { ...existing, [field]: value }
      return [...current.filter(item => Number(item.phase) !== phase), next]
        .sort((a, b) => Number(a.phase) - Number(b.phase))
    })
  }

  function getPhaseRule(phase: number) {
    return phaseRules.find(item => Number(item.phase) === phase) || { phase, matchQuantity: '', appliesTo: 'phase' }
  }

  function visibleRulePhases() {
    const stopRule = phaseRules
      .filter(rule => rule.appliesTo === 'until_final')
      .sort((a, b) => Number(a.phase) - Number(b.phase))[0]

    return stopRule
      ? tournamentPhases.filter(phase => phase.phase <= Number(stopRule.phase))
      : tournamentPhases
  }

  function updateScheduleDayCount(value: string) {
    const count = Math.max(1, Number(value) || 1)
    setScheduleDayCount(count)
    setScheduleRows(current => Array.from({ length: count }, (_, index) => (
      current.find(item => Number(item.day) === index + 1) || { day: index + 1, description: '', date: '', time: '' }
    )))
  }

  function updateScheduleRow(day: number, field: string, value: string) {
    setScheduleRows(current => {
      const existing = current.find(item => Number(item.day) === day) || { day, description: '', date: '', time: '' }
      const next = { ...existing, [field]: value }
      return [...current.filter(item => Number(item.day) !== day), next]
        .sort((a, b) => Number(a.day) - Number(b.day))
    })
  }

  function getScheduleRow(day: number) {
    return scheduleRows.find(item => Number(item.day) === day) || { day, description: '', date: '', time: '' }
  }

  function saveSettings() {
    const selectedBroadcast = ['youtube', 'obs'].includes(form.broadcastType) ? form.broadcastType : 'none'
    const payload = {
      ...form,
      broadcastType: selectedBroadcast,
      youtubeUrl: selectedBroadcast === 'youtube' ? form.youtubeUrl : '',
      obsStreamUrl: selectedBroadcast === 'obs' ? form.obsStreamUrl : '',
      phaseSchedule: form.scheduleMode === 'multi_day'
        ? JSON.stringify(scheduleRows.filter(row => row.description || row.date || row.time))
        : '',
      phaseMatchRules: form.matchQuantityMode === 'by_phase'
        ? JSON.stringify(phaseRules.filter(rule => rule.matchQuantity))
        : '',
    }

    fetch(`${API}/tournaments/${id}/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        alert('Configurações salvas.')
        navigate('/app')
      })
  }

  function generateBracket(mode: 'automatic' | 'manual') {
    if (mode === 'manual') {
      const order = mainRegistrations.map((registration, index) => `${index + 1}. ${registration.name}`).join('\n')
      if (!confirm(`Gerar chave manual usando esta ordem da lista principal?\n\n${order || 'Nenhum jogador na lista principal.'}`)) {
        return
      }
    }

    const closeRegistrations = confirm('Deseja encerrar as inscrições públicas ao gerar a chave?')

    fetch(`${API}/tournaments/${id}/generate-bracket`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ mode, closeRegistrations }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        alert(`Chave gerada com ${data.matchesCreated} jogo(s).`)
        navigate(`/tournament/${id}/chaveamento`)
      })
  }

  const mainRegistrations = registrations
    .filter(registration => registration.status === 'confirmed')
    .sort((a, b) => Number(a.sortOrder || 9999) - Number(b.sortOrder || 9999))
  const isBingoSettings = tournament?.format === 'bingo' || tournament?.sport?.slug === 'bingo' || form.format === 'bingo'

  return (
    <div className="tournamentPageLayout">
      <aside className="tournamentMainSidebar">
        <div className="sidebarBrand">🎱 ProMaster</div>
        <button className="backDashboardButton" onClick={() => navigate('/app')}>
          Voltar ao painel principal
        </button>

        <div className="tournamentSidebarInfo">
          <span>Torneio</span>
          <strong>{tournament?.name || form.name || 'Carregando...'}</strong>
          <small>{tournamentStatusLabel(tournament?.status)}</small>
        </div>

        <button onClick={() => navigate(`/tournament/${id}`)}>Dashboard</button>
        <button onClick={() => navigate(`/tournament/${id}/chaveamento`)}>{isBingoSettings ? 'AO VIVO' : 'Chaveamento'}</button>
        <button onClick={() => navigate(`/tournament/${id}/inscritos`)}>Inscritos</button>
        <button className="active" onClick={() => navigate(`/tournament/${id}/settings`)}>Configurações / edição</button>
        {!isBingoSettings && <button onClick={() => navigate(`/arbitro/${id}`)}>Modo árbitro</button>}
        <button onClick={() => navigate(`/tournament/${id}/financeiro`)}>Financeiro</button>
        <button onClick={() => navigate(`/tournament/${id}/patrocinadores`)}>Patrocinadores</button>
        {!isBingoSettings && <button onClick={() => navigate(`/tournament/${id}/publico`)}>QR Code público</button>}
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">✏️ Editar torneio</div>
          <h1>Editar torneio</h1>
          <p>Atualize dados públicos, regras, premiação e transmissão ao vivo.</p>
        </header>

        <div className="panel settingsPanel">
          <div className="settingsInfoGrid">
            <div>
              <span>{isBingoSettings ? 'Tipo de evento' : 'Tipo de torneio'}</span>
              <strong>{isBingoSettings ? 'Bingo' : tournamentFormatLabel(form.format || tournament?.format)}</strong>
            </div>
            <div>
              <span>{isBingoSettings ? 'Modelo' : 'Jogadores definidos'}</span>
              <strong>{isBingoSettings ? `${form.bingoMaxNumber || 75} bolas` : effectivePlayerLimit || '-'}</strong>
            </div>
            <div>
              <span>{isBingoSettings ? 'Sorteio' : 'Mesas'}</span>
              <strong>{isBingoSettings ? (form.bingoDrawMode === 'virtual' ? 'Virtual' : 'Físico') : form.tableCount || tournament?.tableCount || '-'}</strong>
            </div>
            <div>
              <span>Status</span>
              <strong>{tournamentStatusLabel(tournament?.status)}</strong>
            </div>
          </div>

          <label>Nome do torneio</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)} />

          {isBingoSettings ? (
            <>
              <label>Modelo</label>
              <select
                value={form.bingoMaxNumber}
                onChange={e => updateField('bingoMaxNumber', e.target.value)}
              >
                <option value={75}>Bingo 75 bolas — cartela 5 x 5 com coringa no centro</option>
                <option value={90}>Bingo 90 bolas — cartela tradicional 3 linhas x 5 colunas</option>
              </select>

              <div className="bingoFormatHint">
                {Number(form.bingoMaxNumber) === 75
                  ? '75 bolas: cartela 5 x 5 com letras BINGO e número grátis no centro.'
                  : '90 bolas: cartela tradicional com 3 linhas e 5 números por linha.'}
              </div>

              <div className="bingoConfigBox">
                <h3>Bingo</h3>
                <p>Configure se o evento será presencial, virtual ou misto.</p>

                <label>Formato do Bingo</label>
                <select
                  value={form.bingoMode}
                  onChange={e => updateBingoMode(e.target.value)}
                >
                  <option value="physical">Presencial com estrutura física</option>
                  <option value="virtual">Totalmente virtual</option>
                  <option value="mixed">Misto</option>
                </select>

                <label>Sorteio dos números</label>
                {form.bingoMode === 'mixed' ? (
                  <select value={form.bingoDrawMode} onChange={e => updateField('bingoDrawMode', e.target.value)}>
                    <option value="virtual">Virtual pela plataforma</option>
                    <option value="physical">Físico pelas bolinhas</option>
                  </select>
                ) : (
                  <div className="readonlyField">
                    {form.bingoDrawMode === 'virtual'
                      ? 'Virtual pela plataforma'
                      : 'Físico pelas bolinhas'}
                  </div>
                )}

                <label>Cartelas</label>
                <div className="readonlyField">
                  {form.bingoCardMode === 'virtual'
                    ? 'Cartela virtual'
                    : form.bingoCardMode === 'mixed'
                      ? 'Cartela física e virtual'
                      : 'Cartela física'}
                </div>

                <label>Valor da cartela online</label>
                <input
                  value={form.bingoCardPrice}
                  onChange={e => updateField('bingoCardPrice', e.target.value)}
                  placeholder="Ex: 10,00"
                />

                <label>Limite de cartelas online por participante</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={form.bingoCardsPerParticipant}
                  onChange={e => updateField('bingoCardsPerParticipant', e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <label>Quantidade de inscritos</label>
              <input
                type="number"
                min="2"
                value={form.playerCount}
                onChange={e => updateField('playerCount', e.target.value)}
              />

              <label>Modelo do torneio</label>
              <select
                value={form.format}
                onChange={e => updateField('format', e.target.value)}
              >
                {TOURNAMENT_FORMAT_OPTIONS.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {form.format === 'round_robin' && (
                <p className="helperText">
                  Todos contra todos: no plano Pro o limite é 64 jogadores. Para torneios acima de 64 ou campeonatos com várias etapas/dias e ranking acumulado, use o plano Master.
                </p>
              )}
              <p className="helperText">Quantidade e modelo só podem ser alterados antes de gerar a chave.</p>

              <label>Número de mesas</label>
              <input
                type="number"
                min="1"
                value={form.tableCount}
                onChange={e => updateField('tableCount', e.target.value)}
              />
            </>
          )}

          <label>Local</label>
          <input value={form.location} onChange={e => updateField('location', e.target.value)} />

          <label>Endereço do local</label>
          <input
            value={form.venueAddress}
            onChange={e => updateField('venueAddress', e.target.value)}
            placeholder="Rua, número, bairro e cidade"
          />

          <div className="settingsGrid">
            <div>
              <label>Data</label>
              <input type="date" value={form.eventDate} onChange={e => updateField('eventDate', e.target.value)} />
            </div>

            <div>
              <label>Horário</label>
              <input type="time" value={form.eventTime} onChange={e => updateField('eventTime', e.target.value)} />
            </div>
          </div>

          <label>Premiação</label>
          <input value={form.prize} onChange={e => updateField('prize', e.target.value)} />

          <label>Transmissão</label>
          <select
            value={form.broadcastType}
            onChange={e => updateField('broadcastType', e.target.value)}
          >
            <option value="none">Sem transmissão</option>
            <option value="youtube">YouTube</option>
            <option value="obs">OBS</option>
          </select>

          {form.broadcastType === 'youtube' && (
            <>
              <label>Link da transmissão</label>
              <input
                value={form.youtubeUrl}
                onChange={e => updateField('youtubeUrl', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </>
          )}

          {form.broadcastType === 'obs' && (
            <>
              <label>URL OBS / RTMP</label>
              <input
                value={form.obsStreamUrl}
                onChange={e => updateField('obsStreamUrl', e.target.value)}
                placeholder="rtmp://... ou link da transmissão OBS"
              />
            </>
          )}

          <label className="checkboxLine">
            <input
              type="checkbox"
              checked={form.liveStarted}
              onChange={e => updateField('liveStarted', e.target.checked)}
            />
            {form.liveStarted ? 'Transmissão ao vivo iniciada' : 'Transmissão ao vivo encerrada'}
          </label>

          <label className="checkboxLine">
            <input
              type="checkbox"
              checked={form.registrationOpen}
              onChange={e => updateField('registrationOpen', e.target.checked)}
            />
            {form.registrationOpen ? 'Inscrições públicas abertas' : 'Inscrições públicas encerradas'}
          </label>

          <label>Tipo de cobrança da inscrição</label>
          <select value={form.paymentCollectionMode} onChange={e => updateField('paymentCollectionMode', e.target.value)}>
            <option value="manual">Cobrança manual pelo organizador</option>
            <option value="platform">Pagamento automático pela plataforma</option>
            <option value="both">Manual e automático</option>
          </select>

          <div className="settingsGrid">
            <div>
              <label>Valor da inscrição</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.registrationFee}
                onChange={e => updateField('registrationFee', e.target.value)}
                placeholder="Ex: 30.00"
              />
            </div>

            <div>
              <label>Link de pagamento manual</label>
              <input
                value={form.paymentLink}
                onChange={e => updateField('paymentLink', e.target.value)}
                placeholder="Pix, Mercado Pago ou checkout"
              />
            </div>
          </div>

          <label>Regras</label>
          <textarea value={form.rules} onChange={e => updateField('rules', e.target.value)} />

          {!isBingoSettings && (
            <>
              <label>Regras das partidas</label>
              <select
                value={form.matchQuantityMode}
                onChange={e => updateField('matchQuantityMode', e.target.value)}
              >
                <option value="">Definir depois</option>
                <option value="all">Mesmo padrão até o final</option>
                <option value="by_phase">Alterar partidas por fase</option>
              </select>

              {form.matchQuantityMode === 'all' && (
                <div className="settingsGrid">
                  <div>
                    <label>Número de partidas</label>
                    <input
                      type="number"
                      min="1"
                      value={form.matchQuantity}
                      onChange={e => updateField('matchQuantity', e.target.value)}
                      placeholder="Ex: 3"
                    />
                  </div>

                  <div>
                    <label>Regra aplicada</label>
                    <input
                      value="Até o final"
                      readOnly
                    />
                  </div>
                </div>
              )}

              {form.matchQuantityMode === 'by_phase' && (
                <div className="phaseConfigList">
                  <div className="phaseConfigHeader">
                    <span>Fase</span>
                    <span>Número de partidas</span>
                    <span>Regra aplicada</span>
                  </div>
                  {visibleRulePhases().map(phase => {
                    const rule = getPhaseRule(phase.phase)
                    return (
                      <div key={phase.phase} className="phaseConfigRow">
                        <strong>{phase.label}</strong>
                        <input
                          type="number"
                          min="1"
                          value={rule.matchQuantity}
                          onChange={e => updatePhaseRule(phase.phase, 'matchQuantity', e.target.value)}
                          placeholder="Partidas"
                        />
                        <select
                          value={rule.appliesTo}
                          onChange={e => updatePhaseRule(phase.phase, 'appliesTo', e.target.value)}
                        >
                          <option value="phase">Somente esta fase</option>
                          <option value="until_final">Desta fase até o final</option>
                        </select>
                      </div>
                    )
                  })}
                </div>
              )}

              <label>Programação</label>
              <select
                value={form.scheduleMode}
                onChange={e => updateField('scheduleMode', e.target.value)}
              >
                <option value="single_day">Data única</option>
                <option value="multi_day">Vários dias e horários</option>
              </select>

              {form.scheduleMode === 'multi_day' && (
                <div className="phaseConfigList">
                  <div className="phaseConfigRow">
                    <strong>Quantidade de dias</strong>
                    <input
                      type="number"
                      min="1"
                      value={scheduleDayCount}
                      onChange={e => updateScheduleDayCount(e.target.value)}
                    />
                    <span className="helperText">Gera uma linha para cada dia.</span>
                  </div>

                  {Array.from({ length: scheduleDayCount }, (_, index) => {
                    const day = index + 1
                    const row = getScheduleRow(day)
                    return (
                      <div key={day} className="phaseConfigRow scheduleDayRow">
                        <strong>Dia {day}</strong>
                        <input
                          value={row.description}
                          onChange={e => updateScheduleRow(day, 'description', e.target.value)}
                          placeholder="Descrição: fase inicial, final..."
                        />
                        <input
                          type="date"
                          value={row.date}
                          onChange={e => updateScheduleRow(day, 'date', e.target.value)}
                        />
                        <input
                          type="time"
                          value={row.time}
                          onChange={e => updateScheduleRow(day, 'time', e.target.value)}
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </>
          )}

          <button className="primaryButton" onClick={saveSettings}>Salvar edição</button>

          {!isBingoSettings && (
            <div className="drawActions">
              <button className="primaryButton" onClick={() => generateBracket('automatic')}>
                Gerar sorteio automático
              </button>
              <button className="secondaryButton" onClick={() => generateBracket('manual')}>
                Gerar chave manual pela ordem da lista
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Financeiro() {
  const [finance, setFinance] = useState<any>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([])

  function loadFinance() {
    fetch(`${API}/admin/finance/summary`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setFinance(data))
  }

  function loadMonthlyRevenue() {
    fetch(`${API}/admin/finance/monthly`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setMonthlyRevenue(Array.isArray(data) ? data : []))
  }

  useEffect(() => {
  if (!isLoggedIn()) {
    goHome()
    return
  }

  fetch(`${API}/me`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
      if (data.user?.role !== 'superadmin') {
        goHome()
        return
      }

      loadFinance()
      loadMonthlyRevenue()
    })
}, [])

  return (
    <div className="saasLayout">
      <AdminSidebar />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">💰 ProMaster Arena</div>
          <h1>Painel Financeiro</h1>
          <p>Resumo de cobranças Pix e faturamento</p>
        </header>

        <div className="financeGrid">
          <div className="financeCard">
            <span>Faturamento aprovado</span>
            <strong>R$ {(finance?.totalRevenue || 0).toFixed(2)}</strong>
          </div>

          <div className="financeCard">
            <span>Pendente</span>
            <strong>R$ {(finance?.pendingRevenue || 0).toFixed(2)}</strong>
          </div>

          <div className="financeCard">
            <span>Pagamentos aprovados</span>
            <strong>{finance?.approvedCount || 0}</strong>
          </div>

          <div className="financeCard">
            <span>Pagamentos pendentes</span>
            <strong>{finance?.pendingCount || 0}</strong>
          </div>
        </div>

        <div className="panel">
          <h2>Faturamento mensal</h2>

          <div style={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="total" strokeWidth={3} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <h2>Histórico de pagamentos</h2>

          {(finance?.payments || []).map((p: any) => (
            <div key={p.id} className="paymentRow">
              <div>
                <strong>{p.plan?.toUpperCase()}</strong>
                <span>MP: {p.mercadoPagoId || '-'}</span>
              </div>

              <div>
                <strong>R$ {Number(p.amount).toFixed(2)}</strong>
                <span className={`statusBadge ${p.status}`}>{p.status}</span>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function Landing() {
  return (
    <div className="landing">
      <header className="landingHeader">
        <div className="landingLogo">🎱 ProMaster Arena</div>

        <div className="landingActions">
          <a href="/login">Entrar</a>
          <a className="landingButton" href="/inscreva-se">Inscreva-se</a>
        </div>
      </header>

      <div className="landingNotice">
        <strong>Aviso provisório</strong>
        <span>Esta página está em modo teste. Alguns recursos e informações podem ser ajustados durante a validação da plataforma.</span>
      </div>

      <section className="landingHero">
        <div>
          <span className="landingBadge">Sistema SaaS para torneios</span>

          <h1>Organize torneios profissionais com chave, telão, ranking e Pix.</h1>

          <p>
            Plataforma para clubes, bares, arenas e organizadores criarem torneios
            de sinuca e esportes com visual profissional, QR Code público e gestão online.
          </p>

          <div className="landingCtas">
            <a className="landingButton" href="/inscreva-se">Inscreva-se</a>
            <a className="landingSecondary" href="/planos">Ver planos</a>
          </div>
        </div>

        <div className="landingPreview">
          <h3>🏆 Torneio ao vivo</h3>
          <div className="previewMatch">João <strong>VS</strong> Carlos</div>
          <div className="previewCard">Ranking em tempo real</div>
          <div className="previewCard">QR Code para público</div>
          <div className="previewCard">Telão profissional</div>
        </div>
      </section>

      <section className="landingFeatures">
        <div>
          <h2>Chave automática</h2>
          <p>Crie torneios com jogadores reais e sorteio automático.</p>
        </div>

        <div>
          <h2>Telão público</h2>
          <p>Exiba partidas, status e ranking em TV ou projetor.</p>
        </div>

        <div>
          <h2>Cobranças automáticas</h2>
          <p>Selecione o melhor plano, ative cobranças automáticas por torneio e acompanhe tudo no painel financeiro.</p>
        </div>

        <div>
          <h2>Jogadores</h2>
          <p>Estatísticas em tempo real, ranking, histórico dos torneios e mais.</p>
        </div>
      </section>

      <section id="planos" className="landingPlans">
        <h2>Planos</h2>

        <div className="plansGrid">
          <div className="planCard">
            <h3>Trial Free</h3>
            <strong>7 dias ou 1 torneio</strong>
            <p>Acesso aos principais recursos. Depois expira para novos torneios, mas mantém login e edição.</p>
          </div>

          <div className="planCard featured">
            <h3>Pro</h3>
            <strong>R$ 59,90/mês</strong>
            <p>Mesmas funções principais, com torneios ilimitados até 64 jogadores.</p>
          </div>

          <div className="planCard">
            <h3>Master</h3>
            <strong>R$ 89,90/mês</strong>
            <p>Torneios acima de 64 jogadores, usuários/equipe e recursos avançados.</p>
          </div>

          <div className="planCard">
            <h3>Avulso</h3>
            <strong>R$ 21,90</strong>
            <p>Crédito para criar 1 torneio, ideal para eventos únicos.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function PlansComparison() {
  const plans = [
    {
      name: 'Trial Free',
      price: 'R$ 0',
      detail: '7 dias ou 1 torneio',
      description: 'Para testar a plataforma com acesso aos principais recursos.',
      featured: false,
      cta: 'Começar grátis',
      href: '/inscreva-se',
      features: ['1 torneio', 'Até 16 jogadores', 'Chave e painel do torneio', 'Página pública', 'Login após expirar'],
    },
    {
      name: 'Pro',
      price: 'R$ 59,90',
      detail: 'por mês',
      description: 'Para arenas e organizadores com torneios recorrentes.',
      featured: true,
      cta: 'Escolher Pro',
      href: '/inscreva-se',
      features: ['Torneios ilimitados', 'Até 64 jogadores', 'Telão e página pública', 'Ranking e histórico', 'Recursos principais'],
    },
    {
      name: 'Master',
      price: 'R$ 89,90',
      detail: 'por mês',
      description: 'Para operações maiores, equipe e torneios acima de 64 jogadores.',
      featured: false,
      cta: 'Escolher Master',
      href: '/inscreva-se',
      features: ['Torneios acima de 64 jogadores', 'Usuários/equipe', 'Recursos avançados', 'Gestão ampliada', 'Acesso completo'],
    },
    {
      name: 'Avulso',
      price: 'R$ 21,90',
      detail: 'por torneio',
      description: 'Para quem precisa organizar apenas um evento pontual.',
      featured: false,
      cta: 'Comprar avulso',
      href: '/inscreva-se',
      features: ['Crédito de 1 torneio', 'Ideal para evento único', 'Chave e painel do torneio', 'Página pública', 'Sem mensalidade'],
    },
  ]

  const rows = [
    ['Preço', 'Grátis', 'R$ 59,90/mês', 'R$ 89,90/mês', 'R$ 21,90/torneio'],
    ['Torneios', '1 torneio', 'Ilimitados', 'Ilimitados', '1 crédito'],
    ['Jogadores', 'Até 16', 'Até 64', 'Acima de 64', 'Até 64'],
    ['Login após expirar', 'Sim', 'Sim', 'Sim', 'Sim'],
    ['Criar novo torneio após expirar', 'Não', 'Sim', 'Sim', 'Com novo crédito'],
    ['Usuários/equipe', 'Não', 'Não', 'Sim', 'Não'],
    ['Melhor para', 'Teste inicial', 'Uso recorrente', 'Operação maior', 'Evento único'],
  ]

  return (
    <div className="plansPage">
      <header className="plansPageHeader">
        <a href="/" className="landingLogo">🎱 ProMaster Arena</a>
        <div className="landingActions">
          <a href="/login">Entrar</a>
          <a className="landingButton" href="/inscreva-se">Inscreva-se</a>
        </div>
      </header>

      <main className="plansPageMain">
        <section className="plansHero">
          <span>Comparativo de planos</span>
          <h1>Escolha o plano certo para sua arena</h1>
          <p>Compare limites, valores e recursos antes de começar.</p>
        </section>

        <section className="plansCompareGrid">
          {plans.map(plan => (
            <article key={plan.name} className={plan.featured ? 'planCompareCard featured' : 'planCompareCard'}>
              <div>
                <h2>{plan.name}</h2>
                <strong>{plan.price}</strong>
                <span>{plan.detail}</span>
                <p>{plan.description}</p>
              </div>

              <ul>
                {plan.features.map(feature => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>

              <a className={plan.featured ? 'landingButton' : 'landingSecondary'} href={plan.href}>
                {plan.cta}
              </a>
            </article>
          ))}
        </section>

        <section className="plansTablePanel">
          <h2>Comparativo rápido</h2>
          <div className="plansTableWrap">
            <table className="plansTable">
              <thead>
                <tr>
                  <th>Recurso</th>
                  <th>Trial Free</th>
                  <th>Pro</th>
                  <th>Master</th>
                  <th>Avulso</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row[0]}>
                    {row.map(cell => (
                      <td key={cell}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  )
}

function PublicTournament() {
  const { slug } = useParams()
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [registrationForm, setRegistrationForm] = useState<any>({
    name: '',
    rg: '',
    email: '',
    phone: '',
    representsOrganization: false,
    representedOrganizationName: '',
    representedOrganizationType: '',
    representedOrganizationDocument: '',
  })
  const [registrationLoading, setRegistrationLoading] = useState(false)
  const [registrationPayment, setRegistrationPayment] = useState<any>(null)
  const [bingoBuyer, setBingoBuyer] = useState({ name: '', email: '', whatsapp: '', quantity: 1 })
  const [bingoMessage, setBingoMessage] = useState('')

  function loadPublicTournament() {
    fetch(`${API}/public/${slug}`, { cache: 'no-store' })
      .then(async res => {
        const result = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(result?.error || 'Erro ao carregar pagina publica')
        }
        return result
      })
      .then(result => {
        setError('')
        setData(result)
      })
      .catch(err => setError(err.message || 'Erro ao carregar pagina publica'))
  }

  useEffect(() => {
    setError('')
    setData(null)
    loadPublicTournament()
    const interval = setInterval(loadPublicTournament, 15000)
    return () => clearInterval(interval)
  }, [slug])

  useEffect(() => {
    if (!registrationPayment?.registrationId || !registrationPayment?.paymentId) return

    const interval = setInterval(() => {
      fetch(`${API}/public/registrations/${registrationPayment.registrationId}/payment-status`, { cache: 'no-store' })
        .then(res => res.json())
        .then(result => {
          if (result.paymentStatus === 'paid') {
            setRegistrationPayment((current: any) => ({ ...current, status: 'approved', paymentStatus: 'paid' }))
            loadPublicTournament()
          }
        })
    }, 8000)

    return () => clearInterval(interval)
  }, [registrationPayment?.registrationId, registrationPayment?.paymentId])

  if (error) {
    return (
      <div className="publicPage">
        <main>
          <section className="publicCard publicErrorCard">
            <span className="publicCardLabel">Pagina publica</span>
            <h1>Nao foi possivel carregar este torneio</h1>
            <p>{error}</p>
            <button onClick={() => window.location.reload()}>Tentar novamente</button>
          </section>
        </main>
      </div>
    )
  }

  if (!data?.tournament) {
    return <div className="publicPage">Carregando torneio...</div>
  }

  const { tournament, rounds, registrations = [], bingo } = data
  const embedUrl = youtubeEmbedUrl(tournament.youtubeUrl)
  const isBingo = tournament.format === 'bingo' || tournament.sport?.slug === 'bingo'
  const bingoNumbers = bingo?.drawnNumbers || []
  const bingoWinners = bingo?.winners || []
  const bingoCards = bingo?.cards || []
  const bingoCurrentRound = bingo?.currentRound
  const canBuyBingoCards = isBingo && ['virtual', 'mixed'].includes(tournament.bingoCardMode || 'physical')
  const bingoCardLimit = Math.max(Number(tournament.bingoCardsPerParticipant || 1), 1)
  const finalRound = rounds?.[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner
  const prizeLines = tournament.prize
    ? String(tournament.prize).split(/\n|,/).map((line: string) => line.trim()).filter(Boolean)
    : []
  const ruleLines = tournament.rules
    ? String(tournament.rules).split(/\n|,/).map((line: string) => line.trim()).filter(Boolean)
    : []
  const confirmedRegistrations = registrations.filter((registration: any) => registration.status === 'confirmed')
  const waitingRegistrations = registrations.filter((registration: any) => registration.status === 'waiting')

  function updateRegistrationField(field: string, value: string | boolean) {
    setRegistrationForm((current: any) => ({ ...current, [field]: value }))
  }

  function registerPlayer() {
    if (!registrationForm.name || !registrationForm.rg || !registrationForm.email || !registrationForm.phone) {
      alert('Preencha nome, RG, e-mail e WhatsApp.')
      return
    }

    if (!isValidRg(registrationForm.rg)) {
      alert('Informe um RG válido. Use apenas números/letras, com 5 a 12 caracteres.')
      return
    }

    if (!isValidBrazilCellphone(registrationForm.phone)) {
      alert('Informe um celular válido com DDD. Exemplo: (11) 99009-8000.')
      return
    }

    setRegistrationLoading(true)
    fetch(`${API}/public/${slug}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...registrationForm,
        rg: formatRg(registrationForm.rg),
        phone: normalizeBrazilPhone(registrationForm.phone),
      }),
    })
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          alert(result.error)
          return
        }

        setRegistrationForm({
          name: '',
          rg: '',
          email: '',
          phone: '',
          representsOrganization: false,
          representedOrganizationName: '',
          representedOrganizationType: '',
          representedOrganizationDocument: '',
        })
        setRegistrationPayment(result.payment ? {
          ...result.payment,
          registrationId: result.registration?.id,
          paymentStatus: result.registration?.paymentStatus,
        } : null)
        loadPublicTournament()
        alert(result.payment ? 'Inscrição recebida. Gere o pagamento Pix e confirme sua participação pelo link enviado.' : 'Inscrição recebida. Enviamos um link por e-mail e WhatsApp para confirmar sua participação.')
      })
      .finally(() => setRegistrationLoading(false))
  }

  function reserveBingoCard() {
    setBingoMessage('')
    fetch(`${API}/public/${slug}/bingo/cards`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bingoBuyer),
    })
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          setBingoMessage(result.error)
          return
        }

        setBingoMessage('Cartela reservada. Aguarde a confirmação do pagamento pelo organizador.')
        setBingoBuyer(current => ({ ...current, name: '', email: '', whatsapp: '' }))
      })
  }

  function claimPublicBingo() {
    setBingoMessage('')
    const claimName = bingoBuyer.name || prompt('Informe seu nome para avisar BINGO', '') || ''

    if (!claimName.trim()) {
      setBingoMessage('Informe seu nome para avisar BINGO.')
      return
    }

    fetch(`${API}/public/${slug}/bingo/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: claimName }),
    })
      .then(res => res.json())
      .then(result => {
        if (result.error) {
          setBingoMessage(result.error)
          return
        }

        setBingoMessage('BINGO enviado para o telão e organização.')
        loadPublicTournament()
      })
  }

  return (
    <div className="publicPage">
      <header className="publicHero">
        <span>{tournament.liveStarted ? 'AO VIVO • ProMaster Arena' : 'ProMaster Arena'}</span>
      </header>

      <main>
        <section className="publicTopGrid">
          <div className="publicCard publicTitleCard">
            <span className="publicCardLabel">Torneio</span>
            <h1>{tournament.name}</h1>
            {champion && <div className="publicChampion">🏆 Campeão: {champion}</div>}
            {tournament.liveStarted && (
              <a className="publicLiveButton" href={`/telao/${tournament.id}`}>
                AO VIVO - Acompanhar Telão
              </a>
            )}
          </div>

          <div className="publicCard publicMiniInfoCard">
            <span className="publicCardLabel">Status</span>
            <strong>{tournamentStatusLabel(tournament.status)}</strong>
            <p>{tournament.location || 'Local não informado'}</p>
            {tournament.venueAddress && <p>{tournament.venueAddress}</p>}
            <p>
              {tournament.eventDate ? new Date(tournament.eventDate).toLocaleDateString() : 'Data não informada'}
              {tournament.eventTime ? ` • ${tournament.eventTime}` : ''}
            </p>
            <p>{tournament.registrationOpen ? 'Inscrições abertas' : 'Inscrições encerradas'}</p>
          </div>

          <div className="publicCard publicMiniInfoCard">
            <span className="publicCardLabel">Premiação</span>
            {prizeLines.length > 0 ? (
              <div className="publicTextLines">
                {prizeLines.map((line: string, index: number) => (
                  <p key={index}>{line}</p>
                ))}
              </div>
            ) : (
              <p>Premiação não informada</p>
            )}
          </div>

          <div className="publicCard publicMiniInfoCard">
            <span className="publicCardLabel">Regras</span>
            {ruleLines.length > 0 ? (
              <div className="publicTextLines">
                {ruleLines.map((line: string, index: number) => (
                  <p key={index}>- {line.replace(/^-+/, '').trim()}</p>
                ))}
              </div>
            ) : (
              <p>Regras não informadas</p>
            )}
          </div>
        </section>

        {embedUrl && (
          <section className="publicCard publicVideo publicVideoWide">
            <span className="publicCardLabel">Transmissão YouTube</span>
            <iframe
              src={embedUrl}
              title="Transmissão ao vivo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </section>
        )}

        {isBingo && (
          <section className="publicMatchColumns">
            <div className="publicCard publicMatchColumn live">
              <span className="publicCardLabel">Bingo</span>
              <h2>Números sorteados</h2>
              {bingoCurrentRound && (
                <div className="publicBingoRoundBox">
                  <strong>{bingoCurrentRound.name}</strong>
                  <span>{bingoCurrentRound.prize || 'Premiação da rodada não informada'}</span>
                </div>
              )}
              <div className="bingoNumbers">
                {bingoNumbers.length === 0 && <p>Nenhum número sorteado.</p>}
                {bingoNumbers.map((number: number) => (
                  <span key={number}>{number}</span>
                ))}
              </div>
            </div>

            <div className="publicCard publicMatchColumn done">
              <span className="publicCardLabel">Rodadas</span>
              <h2>Ganhadores</h2>
              {bingoWinners.length === 0 && <p>Nenhum ganhador registrado.</p>}
              {bingoWinners.map((winner: any) => (
                <div key={winner.id} className="publicMatchCard done">
                  <strong>{winner.winnerName}</strong>
                  <span>{winner.prize || winner.roundName || 'Rodada'}</span>
                </div>
              ))}
            </div>

            <div className="publicCard publicMatchColumn next">
              <span className="publicCardLabel">Cartelas</span>
              <h2>{bingoCards.length} registradas</h2>
              <p>
                {canBuyBingoCards
                  ? 'Participação online habilitada.'
                  : 'Venda de cartelas online não habilitada.'}
              </p>
              {canBuyBingoCards && (
                <div className="publicBingoForm">
                  <input
                    value={bingoBuyer.name}
                    onChange={e => setBingoBuyer(current => ({ ...current, name: e.target.value }))}
                    placeholder="Nome"
                  />
                  <input
                    value={bingoBuyer.email}
                    onChange={e => setBingoBuyer(current => ({ ...current, email: e.target.value }))}
                    placeholder="E-mail"
                  />
                  <input
                    value={bingoBuyer.whatsapp}
                    onChange={e => setBingoBuyer(current => ({ ...current, whatsapp: e.target.value }))}
                    placeholder="WhatsApp"
                  />
                  <input
                    type="number"
                    min={1}
                    max={bingoCardLimit}
                    value={bingoBuyer.quantity}
                    onChange={e => {
                      const quantity = Math.min(Math.max(Number(e.target.value || 1), 1), bingoCardLimit)
                      setBingoBuyer(current => ({ ...current, quantity }))
                    }}
                  />
                  <p>Limite: {bingoCardLimit} cartela(s) por participante.</p>
                  <button onClick={reserveBingoCard}>Reservar cartela</button>
                  <button className="publicBingoButton" onClick={claimPublicBingo}>BINGO!</button>
                  {bingoMessage && <p>{bingoMessage}</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {!isBingo && (
          <section className="publicRegistrationGrid">
            <div className="publicCard publicRegistrationForm">
              <span className="publicCardLabel">Inscrição</span>
              {!tournament.registrationOpen ? (
                <div className="publicClosedBox">
                  <strong>Inscrições encerradas</strong>
                </div>
              ) : (
                <>
                  <h2>Inscrever-se no torneio</h2>
                  <p>Preencha seus dados para participar.</p>
                  <input
                    value={registrationForm.name}
                    onChange={e => updateRegistrationField('name', e.target.value)}
                    placeholder="Nome completo"
                    disabled={registrationLoading}
                  />
                  <input
                    value={registrationForm.rg}
                    onChange={e => updateRegistrationField('rg', formatRg(e.target.value))}
                    placeholder="RG"
                    disabled={registrationLoading}
                  />
                  <input
                    type="email"
                    value={registrationForm.email}
                    onChange={e => updateRegistrationField('email', e.target.value)}
                    placeholder="E-mail"
                    disabled={registrationLoading}
                  />
                  <input
                    value={registrationForm.phone}
                    onChange={e => updateRegistrationField('phone', formatBrazilCellphone(e.target.value))}
                    placeholder="WhatsApp com DDD. Ex: (11) 99009-8000"
                    inputMode="numeric"
                    disabled={registrationLoading}
                  />

                  <label className="publicCheckboxLine">
                    <input
                      type="checkbox"
                      checked={registrationForm.representsOrganization}
                      onChange={e => updateRegistrationField('representsOrganization', e.target.checked)}
                      disabled={registrationLoading}
                    />
                    Represento clube, salão, arena ou organização
                  </label>

                  {registrationForm.representsOrganization && (
                    <div className="publicOrgFields">
                      <input
                        value={registrationForm.representedOrganizationName}
                        onChange={e => updateRegistrationField('representedOrganizationName', e.target.value)}
                        placeholder="Nome da organização representada"
                        disabled={registrationLoading}
                      />
                      <select
                        value={registrationForm.representedOrganizationType}
                        onChange={e => updateRegistrationField('representedOrganizationType', e.target.value)}
                        disabled={registrationLoading}
                      >
                        <option value="">Tipo</option>
                        <option value="clube">Clube</option>
                        <option value="salao">Salão</option>
                        <option value="arena">Arena</option>
                        <option value="associacao">Associação</option>
                        <option value="outro">Outro</option>
                      </select>
                      <input
                        value={registrationForm.representedOrganizationDocument}
                        onChange={e => updateRegistrationField('representedOrganizationDocument', e.target.value)}
                        placeholder="Documento da organização, se houver"
                        disabled={registrationLoading}
                      />
                    </div>
                  )}

                  <button onClick={registerPlayer} disabled={registrationLoading}>
                    {registrationLoading ? 'Enviando...' : 'Confirmar inscrição'}
                  </button>

                  {tournament.paymentCollectionMode !== 'manual' && Number(tournament.registrationFee || 0) > 0 && (
                    <p className="publicPaymentHint">
                      Pagamento automático via Pix: R$ {Number(tournament.registrationFee).toFixed(2).replace('.', ',')}
                    </p>
                  )}

                  {registrationPayment && (
                    <div className="publicPaymentBox">
                      <strong>Pagamento da inscrição</strong>
                      <span>Status: {registrationPayment.paymentStatus === 'paid' || registrationPayment.status === 'approved' ? 'pago' : 'aguardando Pix'}</span>
                      {registrationPayment.qrCodeBase64 && (
                        <img
                          src={`data:image/png;base64,${registrationPayment.qrCodeBase64}`}
                          alt="QR Code Pix da inscrição"
                        />
                      )}
                      {registrationPayment.qrCode && (
                        <button type="button" onClick={() => navigator.clipboard.writeText(registrationPayment.qrCode)}>
                          Copiar código Pix
                        </button>
                      )}
                      {registrationPayment.ticketUrl && (
                        <button type="button" onClick={() => window.open(registrationPayment.ticketUrl, '_blank')}>
                          Abrir pagamento
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="publicCard publicParticipantsCard">
              <span className="publicCardLabel">Participantes</span>
              <h2>{confirmedRegistrations.length}/{tournament.playerCount}</h2>
              <p>Jogadores inscritos na lista principal.</p>
            </div>

            <div className="publicCard publicParticipantsCard">
              <span className="publicCardLabel">Lista de espera</span>
              <h2>{waitingRegistrations.length}</h2>
              <p>Jogadores aguardando vaga.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function SeasonsPage({ user }: any) {
  const navigate = useNavigate()
  const isMasterPlan = user?.organization?.plan === 'master' || user?.organization?.plan === 'free'
  const [seasons, setSeasons] = useState<any[]>([])
  const [selectedSeasonId, setSelectedSeasonId] = useState<number | null>(null)
  const [seasonDetails, setSeasonDetails] = useState<any>(null)
  const [form, setForm] = useState<any>({
    name: 'Campeonato da Temporada',
    tournamentCount: 4,
    playerCount: 32,
    startDate: '',
    endDate: '',
    locations: '',
    rules: '',
    prize: '',
  })

  function updateSeasonField(field: string, value: string | number) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function loadSeasons() {
    fetch(`${API}/seasons`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        setSeasons(list)

        if (!selectedSeasonId && list[0]) {
          setSelectedSeasonId(list[0].id)
        }
      })
  }

  function loadSeasonDetails(id: number) {
    fetch(`${API}/seasons/${id}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setSeasonDetails(data.error ? null : data))
  }

  function createSeason() {
    if (!isMasterPlan) {
      alert('Modo campeonato disponível apenas no plano Master.')
      return
    }

    fetch(`${API}/seasons`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(form),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setSelectedSeasonId(data.season.id)
        loadSeasons()
      })
  }

  function finishSeason() {
    if (!selectedSeasonId) return

    fetch(`${API}/seasons/${selectedSeasonId}/finish`, {
      method: 'POST',
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        alert(`Campeão da temporada: ${data.champion.name}`)
        loadSeasonDetails(selectedSeasonId)
        loadSeasons()
      })
  }

  useEffect(() => {
    loadSeasons()
  }, [])

  useEffect(() => {
    if (selectedSeasonId) {
      loadSeasonDetails(selectedSeasonId)
    }
  }, [selectedSeasonId])

  return (
    <div className="saasLayout">
      <ClientSidebar isMasterPlan={isMasterPlan} />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">🏁 Modo Campeonato</div>
          <h1>Campeonatos</h1>
          <p>Configure temporadas com vários torneios e ranking por vitórias e derrotas.</p>
        </header>

        {!isMasterPlan && (
          <div className="panel cancelPanel">
            <h2>Recurso Master</h2>
            <p>O modo campeonato está disponível para o plano Master.</p>
            <button onClick={() => navigate('/upgrade')}>Ver planos</button>
          </div>
        )}

        <div className="seasonLayout">
          <section className="panel">
            <h2>Novo campeonato</h2>

            <label>Nome da temporada</label>
            <input value={form.name} onChange={e => updateSeasonField('name', e.target.value)} />

            <div className="seasonFormGrid">
              <div>
                <label>Nº de torneios</label>
                <input type="number" value={form.tournamentCount} onChange={e => updateSeasonField('tournamentCount', Number(e.target.value))} />
              </div>

              <div>
                <label>Jogadores na temporada</label>
                <input type="number" value={form.playerCount} onChange={e => updateSeasonField('playerCount', Number(e.target.value))} />
              </div>

              <div>
                <label>Início</label>
                <input type="date" value={form.startDate} onChange={e => updateSeasonField('startDate', e.target.value)} />
              </div>

              <div>
                <label>Final</label>
                <input type="date" value={form.endDate} onChange={e => updateSeasonField('endDate', e.target.value)} />
              </div>
            </div>

            <label>Locais</label>
            <textarea value={form.locations} onChange={e => updateSeasonField('locations', e.target.value)} placeholder="Um local por linha ou lista de sedes" />

            <label>Regras da temporada</label>
            <textarea value={form.rules} onChange={e => updateSeasonField('rules', e.target.value)} placeholder="Critérios, desempate, presença, pontuação..." />

            <label>Premiação</label>
            <textarea value={form.prize} onChange={e => updateSeasonField('prize', e.target.value)} placeholder="Premiação final da temporada" />

            <button className="primaryButton" onClick={createSeason}>
              Criar campeonato
            </button>
          </section>

          <section className="panel">
            <h2>Temporadas</h2>

            {seasons.length === 0 && <p>Nenhum campeonato criado.</p>}

            <div className="seasonList">
              {seasons.map(season => (
                <button
                  key={season.id}
                  className={selectedSeasonId === season.id ? 'seasonItem active' : 'seasonItem'}
                  onClick={() => setSelectedSeasonId(season.id)}
                >
                  <strong>{season.name}</strong>
                  <span>{season.tournaments?.length || 0}/{season.tournamentCount} torneios</span>
                  {season.championName && <small>Campeão: {season.championName}</small>}
                </button>
              ))}
            </div>
          </section>
        </div>

        {seasonDetails && (
          <section className="panel seasonDetailsPanel">
            <div className="seasonDetailsHeader">
              <div>
                <h2>{seasonDetails.season.name}</h2>
                <p>
                  {seasonDetails.season.tournamentCount} torneios • {seasonDetails.season.playerCount} jogadores • status {seasonDetails.season.status}
                </p>
              </div>

              <div className="tournamentActions">
                <button onClick={() => navigate(`/criar-torneio?seasonId=${seasonDetails.season.id}`)}>
                  Criar torneio da temporada
                </button>
                <button className="primaryButton" onClick={finishSeason}>
                  Declarar campeão
                </button>
              </div>
            </div>

            {seasonDetails.champion && (
              <div className="seasonChampion">
                <span>Campeão parcial/final</span>
                <strong>🏆 {seasonDetails.champion.name}</strong>
                <p>{seasonDetails.champion.points} pontos</p>
              </div>
            )}

            <div className="seasonInfoGrid">
              <div><span>Datas</span><strong>{seasonDetails.season.startDate ? new Date(seasonDetails.season.startDate).toLocaleDateString() : '-'} até {seasonDetails.season.endDate ? new Date(seasonDetails.season.endDate).toLocaleDateString() : '-'}</strong></div>
              <div><span>Locais</span><strong>{seasonDetails.season.locations || '-'}</strong></div>
              <div><span>Regras</span><strong>{seasonDetails.season.rules || '-'}</strong></div>
              <div><span>Premiação</span><strong>{seasonDetails.season.prize || '-'}</strong></div>
            </div>

            <h3>Torneios da temporada</h3>
            <div className="seasonTournamentList">
              {seasonDetails.tournaments.length === 0 && <p>Nenhum torneio vinculado ainda.</p>}
              {seasonDetails.tournaments.map((tournament: any) => (
                <div key={tournament.id} className="clientTournamentRow">
                  <div>
                    <strong>{tournament.name}</strong>
                  <span>{tournamentStatusLabel(tournament.status)} • {tournament.playerCount} jogadores</span>
                  </div>
                  <button onClick={() => navigate(`/tournament/${tournament.id}`)}>Painel</button>
                </div>
              ))}
            </div>

            <h3>Ranking da temporada</h3>
            <div className="seasonRankingTable">
              <div className="seasonRankingHead">
                <span>#</span>
                <span>Jogador</span>
                <span>Pontos</span>
                <span>V</span>
                <span>D</span>
                <span>Aprov.</span>
              </div>
              {seasonDetails.ranking.map((item: any, index: number) => (
                <div key={item.name} className="seasonRankingRow">
                  <span>{index + 1}</span>
                  <strong>{item.name}</strong>
                  <span>{item.points}</span>
                  <span>{item.wins}</span>
                  <span>{item.losses}</span>
                  <span>{item.winRate}%</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

function CreateTournament({ user }: any) {
  const navigate = useNavigate()

  const [templates, setTemplates] = useState<any[]>([])
  const [seasons, setSeasons] = useState<any[]>([])
  const [name, setName] = useState('Novo Torneio')
  const [playerCount, setPlayerCount] = useState(16)
  const [tournamentFormat, setTournamentFormat] = useState('knockout')
  const [templateId, setTemplateId] = useState(1)
  const [sportSlug, setSportSlug] = useState('sinuca')
  const [sportSelectionDone, setSportSelectionDone] = useState(false)
  const [seasonId, setSeasonId] = useState('')
  const [tableCount, setTableCount] = useState(4)

  const [location, setLocation] = useState('')
  const [venueAddress, setVenueAddress] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [prize, setPrize] = useState('')
  const [rules, setRules] = useState('')
  const [broadcastType, setBroadcastType] = useState('none')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [obsStreamUrl, setObsStreamUrl] = useState('')
  const [registrationOpen, setRegistrationOpen] = useState(true)
  const [registrationFee, setRegistrationFee] = useState('')
  const [paymentCollectionMode, setPaymentCollectionMode] = useState('manual')
  const [paymentLink, setPaymentLink] = useState('')
  const [matchQuantity, setMatchQuantity] = useState('')
  const [matchQuantityMode, setMatchQuantityMode] = useState('')
  const [scheduleMode, setScheduleMode] = useState('single_day')
  const [phaseRules, setPhaseRules] = useState<any[]>([])
  const [scheduleRows, setScheduleRows] = useState<any[]>([])
  const [scheduleDayCount, setScheduleDayCount] = useState(1)
  const tournamentPhases = buildTournamentPhases(Number(playerCount || 2))
  const [bingoMode, setBingoMode] = useState('physical')
  const [bingoDrawMode, setBingoDrawMode] = useState('physical')
  const [bingoCardMode, setBingoCardMode] = useState('physical')
  const [bingoMaxNumber, setBingoMaxNumber] = useState(75)
  const [bingoCardPrice, setBingoCardPrice] = useState('')
  const [bingoCardsPerParticipant, setBingoCardsPerParticipant] = useState(1)
  const templateSports = Array.from(
    new Map(
      templates
        .filter(template => template.sport)
        .map(template => [template.sport.slug, template.sport])
    ).values()
  )
  const sports = [
    { slug: 'sinuca', name: 'Sinuca' },
    { slug: 'bingo', name: 'Bingo' },
    ...templateSports.filter((sport: any) => !['sinuca', 'bingo'].includes(sport.slug)),
  ].map(baseSport => {
    const templateSport = templateSports.find((sport: any) => sport.slug === baseSport.slug)
    return templateSport || baseSport
  })
  const filteredTemplates = templates.filter(template => (
    template.sport?.slug ? template.sport.slug === sportSlug : true
  ))
  const selectedTemplate = templates.find(template => Number(template.id) === Number(templateId))
  const isBingo = tournamentFormat === 'bingo' || selectedTemplate?.format === 'bingo' || selectedTemplate?.sport?.slug === 'bingo'
  const selectedSport = sports.find((sport: any) => sport.slug === sportSlug)

  function updatePhaseRule(phase: number, field: string, value: string) {
    setPhaseRules(current => {
      const existing = current.find(item => Number(item.phase) === phase) || { phase, matchQuantity: '', appliesTo: 'phase' }
      const next = { ...existing, [field]: value }
      return [...current.filter(item => Number(item.phase) !== phase), next]
        .sort((a, b) => Number(a.phase) - Number(b.phase))
    })
  }

  function getPhaseRule(phase: number) {
    return phaseRules.find(item => Number(item.phase) === phase) || { phase, matchQuantity: '', appliesTo: 'phase' }
  }

  function visibleRulePhases() {
    const stopRule = phaseRules
      .filter(rule => rule.appliesTo === 'until_final')
      .sort((a, b) => Number(a.phase) - Number(b.phase))[0]

    return stopRule
      ? tournamentPhases.filter(phase => phase.phase <= Number(stopRule.phase))
      : tournamentPhases
  }

  function updateScheduleDayCount(value: string) {
    const count = Math.max(1, Number(value) || 1)
    setScheduleDayCount(count)
    setScheduleRows(current => Array.from({ length: count }, (_, index) => (
      current.find(item => Number(item.day) === index + 1) || { day: index + 1, description: '', date: '', time: '' }
    )))
  }

  function updateScheduleRow(day: number, field: string, value: string) {
    setScheduleRows(current => {
      const existing = current.find(item => Number(item.day) === day) || { day, description: '', date: '', time: '' }
      const next = { ...existing, [field]: value }
      return [...current.filter(item => Number(item.day) !== day), next]
        .sort((a, b) => Number(a.day) - Number(b.day))
    })
  }

  function getScheduleRow(day: number) {
    return scheduleRows.find(item => Number(item.day) === day) || { day, description: '', date: '', time: '' }
  }

  useEffect(() => {
    fetch(`${API}/templates`)
      .then(res => res.json())
      .then(data => {
        const list = Array.isArray(data) ? data : []
        const defaultSport = list.some((template: any) => template.sport?.slug === 'sinuca')
          ? 'sinuca'
          : list[0]?.sport?.slug || ''
        const defaultTemplate = list.find((template: any) => template.sport?.slug === defaultSport) || list[0]

        setTemplates(list)
        setSportSlug(defaultSport)

        if (defaultTemplate) {
          setTemplateId(defaultTemplate.id)
          setTournamentFormat(defaultTemplate.format || (defaultTemplate.sport?.slug === 'bingo' ? 'bingo' : 'knockout'))
          if (defaultTemplate.playerCount) setPlayerCount(Number(defaultTemplate.playerCount))
        }
      })

    if (user?.organization?.plan === 'master' || user?.organization?.plan === 'free') {
      fetch(`${API}/seasons`, { headers: authHeaders() })
        .then(res => res.json())
        .then(data => {
          const list = Array.isArray(data) ? data : []
          const querySeasonId = new URLSearchParams(window.location.search).get('seasonId')

          setSeasons(list)

          if (querySeasonId && list.some((season: any) => String(season.id) === querySeasonId)) {
            setSeasonId(querySeasonId)
          }
        })
    }
  }, [])

  function chooseSport(nextSport: string) {
    const nextTemplate = templates.find(template => template.sport?.slug === nextSport)

    setSportSlug(nextSport)

    if (nextTemplate) {
      setTemplateId(nextTemplate.id)
      setTournamentFormat(nextTemplate.format || (nextSport === 'bingo' ? 'bingo' : 'knockout'))
      if (nextTemplate.playerCount) setPlayerCount(Number(nextTemplate.playerCount))
    } else {
      setTournamentFormat(nextSport === 'bingo' ? 'bingo' : 'knockout')
    }

    setSportSelectionDone(true)
  }

  function createTournament() {
  const organizationId = user?.organizationId

  if (!organizationId) {
    alert('Usuário sem organização')
    return
  }

  if (!name) {
    alert('Informe o nome do torneio')
    return
  }

  const scheduleDetails = scheduleMode === 'multi_day'
    ? JSON.stringify(scheduleRows.filter(row => row.description || row.date || row.time))
    : ''
  const phaseRuleDetails = matchQuantityMode === 'by_phase'
    ? JSON.stringify(phaseRules.filter(rule => rule.matchQuantity))
    : ''
  const selectedBroadcast = ['youtube', 'obs'].includes(broadcastType) ? broadcastType : 'none'

  fetch(`${API}/organizations/${organizationId}/tournaments/create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      templateId,
      playerCount,
      format: tournamentFormat,
      tableCount: isBingo ? 1 : tableCount,
      location,
      venueAddress,
      eventDate,
      eventTime,
      prize,
      rules,
      broadcastType: selectedBroadcast,
      youtubeUrl: selectedBroadcast === 'youtube' ? youtubeUrl : '',
      obsStreamUrl: selectedBroadcast === 'obs' ? obsStreamUrl : '',
      seasonId: seasonId || null,
      registrationOpen,
      registrationFee,
      paymentCollectionMode,
      paymentLink,
      matchQuantity,
      matchQuantityMode,
      scheduleMode,
      phaseSchedule: scheduleDetails,
      phaseMatchRules: phaseRuleDetails,
      bingoMode,
      bingoDrawMode,
      bingoCardMode,
      bingoMaxNumber,
      bingoCardPrice,
      bingoCardsPerParticipant,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error)
        return
      }

      alert('Torneio criado. A página pública já está disponível. Gere a chave após inscrições/check-in.')
      navigate(`/tournament/${data.tournament.id}/settings`)
    })
}

  if (!sportSelectionDone) {
    return (
      <div className="saasLayout">
        <ClientSidebar isMasterPlan={user?.organization?.plan === 'master' || user?.organization?.plan === 'free'} />

        <main className="saasMain">
          <header className="hero">
            <div className="badge">🏆 Novo Torneio</div>
            <h1>Escolha a modalidade</h1>
            <p>Primeiro selecione o esporte ou formato do evento. Depois abrimos os campos certos para configurar o torneio.</p>
          </header>

          <div className="sportChoiceGrid">
            {templates.length === 0 && (
              <div className="panel">
                <h2>Carregando modalidades</h2>
                <p>Aguarde enquanto buscamos os modelos disponíveis.</p>
              </div>
            )}

            {sports.map((sport: any) => {
              const isSportBingo = sport.slug === 'bingo'
              const hasTemplate = templates.some(template => template.sport?.slug === sport.slug)

              return (
                <button
                  key={sport.slug}
                  className="sportChoiceCard"
                  onClick={() => chooseSport(sport.slug)}
                  disabled={!hasTemplate}
                  type="button"
                >
                  <span>{isSportBingo ? 'Bingo' : sport.name}</span>
                  <strong>{sport.name}</strong>
                  <p>
                    {isSportBingo
                      ? 'Cartelas, sorteio físico ou virtual, telão de números e ganhadores.'
                      : 'Chaveamento, partidas, mesas, ranking e controle do torneio.'}
                  </p>
                </button>
              )
            })}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="saasLayout">
      <ClientSidebar isMasterPlan={user?.organization?.plan === 'master' || user?.organization?.plan === 'free'} />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">🏆 Novo Torneio</div>
          <h1>Criar Torneio</h1>
          <p>Configure o evento, publique as inscrições e gere a chave somente quando estiver pronto.</p>
        </header>

        <div className="createGrid">
          <div className="panel">
            <h2>Dados principais</h2>

            <label>Nome do torneio</label>
            <input value={name} onChange={e => setName(e.target.value)} />

            <label>Esporte / modalidade</label>
            <div className="selectedSportBox">
              <div>
                <strong>{selectedSport?.name || 'Modalidade selecionada'}</strong>
                <span>{isBingo ? 'Evento de bingo' : 'Torneio esportivo'}</span>
              </div>
              <button type="button" onClick={() => setSportSelectionDone(false)}>
                Trocar modalidade
              </button>
            </div>

            <label>Modelo</label>
            {isBingo ? (
              <>
                <select
                  value={bingoMaxNumber}
                  onChange={e => setBingoMaxNumber(Number(e.target.value))}
                >
                  <option value={75}>Bingo 75 bolas — cartela 5 x 5 com coringa no centro</option>
                  <option value={90}>Bingo 90 bolas — cartela tradicional 3 linhas x 5 colunas</option>
                </select>

                <div className="bingoFormatHint">
                  {bingoMaxNumber === 75
                    ? '75 bolas: cartela 5 x 5 com letras BINGO e número grátis no centro.'
                    : '90 bolas: cartela tradicional com 3 linhas e 5 números por linha.'}
                </div>
              </>
            ) : (
              <select
                value={templateId}
                onChange={e => {
                  const nextTemplateId = Number(e.target.value)
                  const nextTemplate = templates.find(template => Number(template.id) === nextTemplateId)
                  setTemplateId(nextTemplateId)
                  if (nextTemplate) {
                    setSportSlug(nextTemplate.sport?.slug || sportSlug)
                    setTournamentFormat(nextTemplate.format || (nextTemplate.sport?.slug === 'bingo' ? 'bingo' : 'knockout'))
                    if (nextTemplate.playerCount) setPlayerCount(Number(nextTemplate.playerCount))
                  }
                }}
              >
                {filteredTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {!isBingo && (
              <>
                <label>Quantidade de inscritos</label>
                <input
                  type="number"
                  min="2"
                  value={playerCount}
                  onChange={e => setPlayerCount(Math.max(2, Number(e.target.value) || 2))}
                />

                <label>Formato do torneio</label>
                <select value={tournamentFormat} onChange={e => setTournamentFormat(e.target.value)}>
                  {TOURNAMENT_FORMAT_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </>
            )}
            {tournamentFormat === 'round_robin' && (
              <p className="helperText">
                Todos contra todos: plano Pro permite até 64 jogadores. Plano Master permite torneios acima de 64 e também campeonatos em várias etapas/dias com ranking acumulado.
              </p>
            )}

            {isBingo && (
              <div className="bingoConfigBox">
                <h3>Bingo</h3>
                <p>Configure se o evento será presencial, virtual ou misto.</p>

                <label>Formato do Bingo</label>
                <select
                  value={bingoMode}
                  onChange={e => {
                    const nextMode = e.target.value
                    setBingoMode(nextMode)

                    if (nextMode === 'physical') {
                      setBingoCardMode('physical')
                      setBingoDrawMode('physical')
                    } else if (nextMode === 'virtual') {
                      setBingoCardMode('virtual')
                      setBingoDrawMode('virtual')
                    } else if (nextMode === 'mixed') {
                      setBingoCardMode('mixed')
                      setBingoDrawMode('virtual')
                    }
                  }}
                >
                  <option value="physical">Presencial com estrutura física</option>
                  <option value="virtual">Totalmente virtual</option>
                  <option value="mixed">Misto</option>
                </select>

                <label>Sorteio dos números</label>
                {bingoMode === 'mixed' ? (
                  <select value={bingoDrawMode} onChange={e => setBingoDrawMode(e.target.value)}>
                    <option value="virtual">Virtual pela plataforma</option>
                    <option value="physical">Físico pelas bolinhas</option>
                  </select>
                ) : (
                  <div className="readonlyField">
                    {bingoDrawMode === 'virtual'
                      ? 'Virtual pela plataforma'
                      : 'Físico pelas bolinhas'}
                  </div>
                )}

                <label>Cartelas</label>
                <div className="readonlyField">
                  {bingoCardMode === 'virtual'
                    ? 'Cartela virtual'
                    : bingoCardMode === 'mixed'
                      ? 'Cartela física e virtual'
                      : 'Cartela física'}
                </div>

                <label>Valor da cartela online</label>
                <input
                  value={bingoCardPrice}
                  onChange={e => setBingoCardPrice(e.target.value)}
                  placeholder="Ex: 10,00"
                />

                <label>Limite de cartelas online por participante</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={bingoCardsPerParticipant}
                  onChange={e => setBingoCardsPerParticipant(Number(e.target.value))}
                />
              </div>
            )}

            {seasons.length > 0 && (
              <>
                <label>Campeonato / temporada</label>
                <select value={seasonId} onChange={e => setSeasonId(e.target.value)}>
                  <option value="">Torneio avulso fora de campeonato</option>
                  {seasons.map(season => (
                    <option key={season.id} value={season.id}>
                      {season.name}
                    </option>
                  ))}
                </select>
              </>
            )}

            {!isBingo && (
              <>
                <label>Número de mesas</label>
                <input
                  type="number"
                  value={tableCount}
                  onChange={e => setTableCount(Number(e.target.value))}
                />
              </>
            )}

            <label>Local</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Ex: Bar do João, Mesa 1..."
            />

            <label>Endereço do local</label>
            <input
              value={venueAddress}
              onChange={e => setVenueAddress(e.target.value)}
              placeholder="Rua, número, bairro e cidade"
            />

            <label>Data</label>
            <input
              type="date"
              value={eventDate}
              onChange={e => setEventDate(e.target.value)}
            />

            <label>Horário</label>
            <input
              type="time"
              value={eventTime}
              onChange={e => setEventTime(e.target.value)}
            />

            <label>Premiação</label>
            <input
              value={prize}
              onChange={e => setPrize(e.target.value)}
              placeholder="Ex: R$ 500 + troféu"
            />

            <label>Regras gerais</label>
            <textarea
              value={rules}
              onChange={e => setRules(e.target.value)}
              placeholder="Ex: Melhor de 3, atraso máximo 10 minutos..."
            />

            <label>Regras das partidas</label>
            <select value={matchQuantityMode} onChange={e => setMatchQuantityMode(e.target.value)}>
              <option value="">Definir depois</option>
              <option value="all">Até o final do torneio</option>
              <option value="by_phase">Alterar por fase</option>
            </select>

            {matchQuantityMode === 'all' && (
              <div className="settingsGrid">
                <div>
                  <label>Número de partidas</label>
                  <input
                    type="number"
                    min="1"
                    value={matchQuantity}
                    onChange={e => setMatchQuantity(e.target.value)}
                    placeholder="Ex: 3"
                  />
                </div>

                <div>
                  <label>Regra aplicada</label>
                  <input value="Até o final" readOnly />
                </div>
              </div>
            )}

            {matchQuantityMode === 'by_phase' && (
              <div className="phaseConfigList">
                <div className="phaseConfigHeader">
                  <span>Fase</span>
                  <span>Número de partidas</span>
                  <span>Regra aplicada</span>
                </div>
                {visibleRulePhases().map(phase => {
                  const rule = getPhaseRule(phase.phase)
                  return (
                    <div key={phase.phase} className="phaseConfigRow">
                      <strong>{phase.label}</strong>
                      <input
                        type="number"
                        min="1"
                        value={rule.matchQuantity}
                        onChange={e => updatePhaseRule(phase.phase, 'matchQuantity', e.target.value)}
                        placeholder="Partidas"
                      />
                      <select
                        value={rule.appliesTo}
                        onChange={e => updatePhaseRule(phase.phase, 'appliesTo', e.target.value)}
                      >
                        <option value="phase">Somente esta fase</option>
                        <option value="until_final">Desta fase até o final</option>
                      </select>
                    </div>
                  )
                })}
              </div>
            )}

            <label>Programação</label>
            <select value={scheduleMode} onChange={e => setScheduleMode(e.target.value)}>
              <option value="single_day">Data única</option>
              <option value="multi_day">Vários dias e horários</option>
            </select>

            {scheduleMode === 'multi_day' && (
              <div className="phaseConfigList">
                <div className="phaseConfigRow">
                  <strong>Quantidade de dias</strong>
                  <input
                    type="number"
                    min="1"
                    value={scheduleDayCount}
                    onChange={e => updateScheduleDayCount(e.target.value)}
                  />
                  <span className="helperText">Gera uma linha para cada dia.</span>
                </div>

                {Array.from({ length: scheduleDayCount }, (_, index) => {
                  const day = index + 1
                  const row = getScheduleRow(day)
                  return (
                    <div key={day} className="phaseConfigRow scheduleDayRow">
                      <strong>Dia {day}</strong>
                      <input
                        value={row.description}
                        onChange={e => updateScheduleRow(day, 'description', e.target.value)}
                        placeholder="Descrição: fase inicial, final..."
                      />
                      <input
                        type="date"
                        value={row.date}
                        onChange={e => updateScheduleRow(day, 'date', e.target.value)}
                      />
                      <input
                        type="time"
                        value={row.time}
                        onChange={e => updateScheduleRow(day, 'time', e.target.value)}
                      />
                    </div>
                  )
                })}
              </div>
            )}

            <label>Transmissão</label>
            <select value={broadcastType} onChange={e => setBroadcastType(e.target.value)}>
              <option value="none">Sem transmissão</option>
              <option value="youtube">YouTube</option>
              <option value="obs">OBS</option>
            </select>

            {broadcastType === 'youtube' && (
              <>
                <label>Link da transmissão</label>
                <input
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </>
            )}

            {broadcastType === 'obs' && (
              <>
                <label>URL OBS / RTMP</label>
                <input
                  value={obsStreamUrl}
                  onChange={e => setObsStreamUrl(e.target.value)}
                  placeholder="rtmp://... ou link da transmissão OBS"
                />
              </>
            )}

            <label className="checkboxLine">
              <input
                type="checkbox"
                checked={registrationOpen}
                onChange={e => setRegistrationOpen(e.target.checked)}
              />
              Abrir inscrições públicas
            </label>

            <label>Tipo de cobrança da inscrição</label>
            <select value={paymentCollectionMode} onChange={e => setPaymentCollectionMode(e.target.value)}>
              <option value="manual">Cobrança manual pelo organizador</option>
              <option value="platform">Pagamento automático pela plataforma</option>
              <option value="both">Manual e automático</option>
            </select>

            <label>Valor da inscrição</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={registrationFee}
              onChange={e => setRegistrationFee(e.target.value)}
              placeholder="Ex: 30.00"
            />

            <label>Link de pagamento manual</label>
            <input
              value={paymentLink}
              onChange={e => setPaymentLink(e.target.value)}
              placeholder="Pix, Mercado Pago ou checkout"
            />
          </div>

          {!isBingo && (
          <div className="panel">
            <h2>Resumo</h2>

            <div className="previewCard">
              <h3>{name}</h3>
              <p>{playerCount} inscritos • {tournamentFormatLabel(tournamentFormat)}</p>
              {location && <p>Local: {location}</p>}
              {venueAddress && <p>Endereço: {venueAddress}</p>}
              {eventDate && <p>Data: {eventDate}</p>}
              {eventTime && <p>Horário: {eventTime}</p>}
              {broadcastType === 'youtube' && youtubeUrl && <p>Transmissão: YouTube</p>}
              {broadcastType === 'obs' && <p>Transmissão: OBS</p>}
              <p>Cobrança: {paymentCollectionMode === 'platform' ? 'Automática pela plataforma' : paymentCollectionMode === 'both' ? 'Manual e automática' : 'Manual pelo organizador'}</p>
              {seasonId && <p>Vinculado ao campeonato</p>}
            </div>

            <button className="primaryButton" onClick={createTournament}>
              Criar torneio e página pública
            </button>
          </div>
          )}

          {isBingo && (
            <div className="panel">
              <h2>Resumo do Bingo</h2>
              <div className="previewCard">
                <h3>{name}</h3>
                {location && <p>Local: {location}</p>}
                {eventDate && <p>Data: {eventDate}</p>}
                {eventTime && <p>Horário: {eventTime}</p>}
                <p>Formato: {bingoMode === 'virtual' ? 'Totalmente virtual' : bingoMode === 'mixed' ? 'Misto' : 'Presencial'}</p>
                <p>Sorteio: {bingoDrawMode === 'virtual' ? 'Virtual pela plataforma' : 'Físico pelas bolinhas'}</p>
                <p>Cartelas: {bingoCardMode === 'virtual' ? 'Virtuais' : bingoCardMode === 'mixed' ? 'Físicas e virtuais' : 'Físicas'}</p>
                <p>Bolas: 1 a {bingoMaxNumber}</p>
                <p>{bingoMaxNumber === 75 ? 'Cartela 5 x 5 com coringa central' : 'Cartela 90 bolas com 3 linhas e 5 números por linha'}</p>
                <p>Limite online: {bingoCardsPerParticipant} cartela(s) por participante</p>
                {bingoCardPrice && <p>Cartela online: R$ {bingoCardPrice}</p>}
              </div>

              <button className="primaryButton" onClick={createTournament}>
                Criar Bingo
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function TournamentBracket() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [rounds, setRounds] = useState<any[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [panelMode] = useState<'board' | 'bracket'>('bracket')
  const [bingoState, setBingoState] = useState<any>(null)
  const [bingoRoundName, setBingoRoundName] = useState('Rodada 1')
  const [bingoRoundPrize, setBingoRoundPrize] = useState('')
  const [showNewBingoRound, setShowNewBingoRound] = useState(false)
  const [showPhysicalNumberModal, setShowPhysicalNumberModal] = useState(false)
  const [newBingoRoundNumber, setNewBingoRoundNumber] = useState(2)
  const [newBingoRoundPrize, setNewBingoRoundPrize] = useState('')
  const [physicalNumberInput, setPhysicalNumberInput] = useState('')
  const [panelQrUrl, setPanelQrUrl] = useState<string | null>(null)
  const [winnerName, setWinnerName] = useState('')
  const matches = rounds.flatMap(round =>
    (round.matches || []).map((match: any) => ({ ...match, round: round.round }))
  )
  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner
  const pendingMatches = matches.filter((match: any) => match.status === 'pending')
  const playingMatches = matches.filter((match: any) => match.status === 'playing')
  const finishedMatches = matches.filter((match: any) => match.status === 'finished')
  const hasGeneratedBracket = rounds.some(round => (round.matches || []).length > 0)
  const bracketRounds = hasGeneratedBracket ? rounds : buildBracketSkeletonRounds(Number(tournament?.playerCount || 0))
  const isBingo = tournament?.format === 'bingo' || tournament?.sport?.slug === 'bingo'
  const publicUrl = tournament?.publicSlug ? publicTournamentUrl(tournament.publicSlug) : ''
  const bingoMaxNumber = Number(tournament?.bingoMaxNumber || 75)
  const bingoNumbers = bingoState?.drawnNumbers || []
  const bingoDraws = bingoState?.draws || []
  const latestBingoNumber = bingoNumbers[bingoNumbers.length - 1]
  const bingoWinners = bingoState?.winners || []
  const bingoCards = bingoState?.cards || []
  const currentRoundData = bingoState?.currentRound
  const currentBingoRoundNumber = Number(currentRoundData?.number || 1)
  const currentBingoRound = currentRoundData?.name || bingoRoundName || `Rodada ${currentBingoRoundNumber}`
  const currentBingoPrize = currentRoundData?.prize || bingoRoundPrize || tournament?.prize || '-'
  const bingoRoundClosed = currentRoundData?.status === 'closed'
  const bingoRoundRows = (() => {
    const rows = new Map<string, any>()
    const ensureRow = (roundName: string, fallbackPrize = '') => {
      const label = roundName || `Rodada ${currentBingoRoundNumber}`
      if (!rows.has(label)) {
        const match = String(label).match(/\d+/)
        rows.set(label, {
          roundNumber: match ? Number(match[0]) : rows.size + 1,
          roundName: label,
          numbers: [] as number[],
          winners: [] as string[],
          prize: fallbackPrize || '',
        })
      }
      return rows.get(label)
    }

    bingoDraws.forEach((draw: any) => {
      const row = ensureRow(draw.roundName || currentBingoRound, draw.prize || currentBingoPrize)
      if (draw.number && !row.numbers.includes(draw.number)) row.numbers.push(draw.number)
      if (draw.prize && !row.prize) row.prize = draw.prize
    })

    bingoWinners.forEach((winner: any) => {
      const row = ensureRow(winner.roundName || currentBingoRound, winner.prize || currentBingoPrize)
      if (winner.winnerName && !row.winners.includes(winner.winnerName)) row.winners.push(winner.winnerName)
      if (winner.prize && !row.prize) row.prize = winner.prize
    })

    if (rows.size === 0) ensureRow(currentBingoRound, currentBingoPrize)

    return Array.from(rows.values()).sort((a, b) => a.roundNumber - b.roundNumber)
  })()

  function loadBracket() {
    fetch(`${API}/tournaments/${id}/bracket`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setRounds(data.rounds || []))
  }

  function loadTournamentPanel() {
    fetch(`${API}/tournaments/${id}`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setTournament(data))
  }

  function loadBingo() {
    fetch(`${API}/tournaments/${id}/bingo`, {
      headers: authHeaders(),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setBingoState(data)
      })
  }

  function startMatch(matchId: number) {
    fetch(`${API}/matches/${matchId}/start`, {
      method: 'POST',
      headers: authHeaders(),
    }).then(loadBracket)
  }

  function finishMatch(matchId: number, winnerId: number) {
    fetch(`${API}/matches/${matchId}/result`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ winnerId }),
    }).then(loadBracket)
  }

  function drawVirtualNumber() {
    fetch(`${API}/tournaments/${id}/bingo/draw`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ source: 'virtual' }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        setShowPhysicalNumberModal(false)
        setPhysicalNumberInput('')
        loadBingo()
      })
  }

  function registerPhysicalNumber() {
    setPhysicalNumberInput('')
    setShowPhysicalNumberModal(true)
  }

  function submitPhysicalNumber() {
    const number = Number(physicalNumberInput)
    if (!Number.isInteger(number) || number < 1 || number > bingoMaxNumber) {
      alert(`Informe um número entre 1 e ${bingoMaxNumber}.`)
      return
    }

    fetch(`${API}/tournaments/${id}/bingo/draw`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ source: 'physical', number }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        loadBingo()
      })
  }

  function openNewBingoRoundModal() {
    setNewBingoRoundNumber(currentBingoRoundNumber + 1)
    setNewBingoRoundPrize('')
    setShowNewBingoRound(true)
  }

  function createNewBingoRound() {
    fetch(`${API}/tournaments/${id}/bingo/rounds`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ roundNumber: newBingoRoundNumber, prize: newBingoRoundPrize }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setBingoRoundName(`Rodada ${data.currentRound?.number || newBingoRoundNumber}`)
        setBingoRoundPrize(data.currentRound?.prize || '')
        setShowNewBingoRound(false)
        loadTournamentPanel()
        loadBingo()
      })
  }

  function closeBingoRound() {
    if (!confirm(`Encerrar ${currentBingoRound}?`)) return

    fetch(`${API}/tournaments/${id}/bingo/rounds/close`, {
      method: 'POST',
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        loadBingo()
      })
  }

  function triggerBingoClaim() {
    const claimedName = winnerName || prompt('Quem gritou BINGO?', '') || 'BINGO'

    fetch(`${API}/tournaments/${id}/bingo/claim`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ winnerName: claimedName }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        loadTournamentPanel()
        loadBingo()
      })
  }

  function registerBingoWinner() {
    fetch(`${API}/tournaments/${id}/bingo/winners`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ winnerName, roundName: currentBingoRound, prize: currentBingoPrize }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        setWinnerName('')
        loadBingo()
      })
  }

  useEffect(() => {
    loadBracket()
    loadTournamentPanel()
    loadBingo()

    const interval = setInterval(() => {
      loadBracket()
      loadTournamentPanel()
      loadBingo()
    }, 5000)
    return () => clearInterval(interval)
  }, [id])

  function renderMatchCard(match: any) {
    return (
      <div
        key={match.id}
        className={`proMatch ${match.status} ${match.winner ? 'hasWinner' : ''}`}
      >
        <div className="matchMeta">
          <span>Jogo #{match.matchNumber || match.id}</span>
          <span>Mesa {match.table}</span>
        </div>

        <div className="matchStatus">
          {match.status === 'playing'
            ? 'JOGANDO'
            : match.status === 'finished'
              ? 'FINALIZADO'
              : 'AGUARDANDO'}
        </div>

        <div className={match.winner === match.playerA ? 'proPlayer winner' : 'proPlayer'}>
          <span>{match.playerA}</span>
          {match.status !== 'finished' && (
            <button onClick={() => finishMatch(match.id, match.playerAId)}>
              Venceu
            </button>
          )}
        </div>

        <div className={match.winner === match.playerB ? 'proPlayer winner' : 'proPlayer'}>
          <span>{match.playerB}</span>
          {match.status !== 'finished' && (
            <button onClick={() => finishMatch(match.id, match.playerBId)}>
              Venceu
            </button>
          )}
        </div>

        {match.status === 'pending' && (
          <button className="startButton" onClick={() => startMatch(match.id)}>
            Iniciar jogo
          </button>
        )}

        {match.winner && (
          <div className={match.winner === champion ? 'advanceLine championLine' : 'advanceLine'}>
            {match.winner === champion ? `🏆 Campeão: ${match.winner}` : `${match.winner} avançou`}
          </div>
        )}
      </div>
    )
  }

  function renderBracketCard(match: any, isFinalRound = false) {
    return (
      <div key={match.id} className={`proMatch ${match.status} ${match.winner ? 'hasWinner' : ''}`}>
        <div className="matchMeta">
          <span>Jogo #{match.matchNumber || match.id}</span>
          <span>{match.skeleton ? 'Aguardando sorteio' : `Mesa ${match.table}`}</span>
        </div>

        {match.skeleton ? (
          <>
            <div className="proPlayer skeletonPlayer">
              <span className="bracketPlaceholder" />
            </div>

            <div className="proPlayer skeletonPlayer">
              <span className="bracketPlaceholder" />
            </div>
          </>
        ) : (
          <>
            <div className={match.winner === match.playerA ? 'proPlayer winner' : 'proPlayer'}>
              <span>{match.playerA}</span>
            </div>

            <div className={match.winner === match.playerB ? 'proPlayer winner' : 'proPlayer'}>
              <span>{match.playerB}</span>
            </div>
          </>
        )}

        {match.winner && (
          <div className={isFinalRound ? 'advanceLine championLine' : 'advanceLine'}>
            {isFinalRound ? `🏆 Campeão: ${match.winner}` : `${match.winner} avançou`}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="tournamentPageLayout">
      <aside className="tournamentMainSidebar">
        <div className="sidebarBrand">🎱 ProMaster</div>
        <button className="backDashboardButton" onClick={() => navigate('/app')}>
          Voltar ao painel principal
        </button>

        <div className="tournamentSidebarInfo">
          <span>Torneio</span>
          <strong>{tournament?.name || 'Carregando...'}</strong>
          <small>{tournamentStatusLabel(tournament?.status)}</small>
        </div>

        <button onClick={() => navigate(`/tournament/${id}`)}>Dashboard</button>
        <button className="active" onClick={() => navigate(`/tournament/${id}/chaveamento`)}>{isBingo ? 'AO VIVO' : 'Chaveamento'}</button>
        <button onClick={() => navigate(`/tournament/${id}/inscritos`)}>Inscritos</button>
        <button onClick={() => navigate(`/tournament/${id}/settings`)}>Configurações / edição</button>
        {!isBingo && <button onClick={() => navigate(`/arbitro/${id}`)}>Modo árbitro</button>}
        <button onClick={() => navigate(`/tournament/${id}/financeiro`)}>Financeiro</button>
        <button onClick={() => navigate(`/tournament/${id}/patrocinadores`)}>Patrocinadores</button>
        {!isBingo && <button onClick={() => navigate(`/tournament/${id}/publico`)}>QR Code público</button>}
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">🏆 Painel do Torneio</div>

          <h1>{isBingo ? 'Painel Bingo' : 'Painel Torneio'}</h1>
          <p>
            {isBingo
              ? 'Controle números sorteados, cartelas e ganhadores das rodadas.'
              : 'Visualização em forma de bracket, atualizada com os jogos do torneio.'}
          </p>

          {isBingo && (
            <div className="heroActions bingoHeaderActions">
              <button onClick={() => window.open(`/telao/${id}`, '_blank')}>Telão</button>
              <button disabled={!publicUrl} onClick={() => publicUrl && window.open(publicUrl, '_blank')}>Público</button>
              <button disabled={!publicUrl} onClick={() => publicUrl && navigator.clipboard?.writeText(publicUrl)}>Compartilhar link</button>
              <button disabled={!publicUrl} onClick={() => publicUrl && setPanelQrUrl(publicUrl)}>QR Code</button>
            </div>
          )}

          {champion && (
            <div className="championBanner">
              🏆 Campeão: {champion}
            </div>
          )}

        </header>

        {isBingo && (
          <div className="bingoControlGrid">
            <section className="panel bingoControlPanel bingoControlPanelFeatured">
              <h2>Controle do Bingo</h2>
              <div className="bingoRoundSummary">
                <div><span>Rodada atual</span><strong>{currentBingoRound}</strong></div>
                <div><span>Premiação da rodada</span><strong>{currentBingoPrize}</strong></div>
              </div>
              {bingoRoundClosed && <p className="helperText">Rodada encerrada. Abra uma nova rodada para continuar sorteando.</p>}

              <div className="bingoFeaturedControl">
                <div className="bingoCurrentNumber">
                  <span>Último número</span>
                  <strong>{latestBingoNumber || '--'}</strong>
                </div>

                <div className="bingoNumbersBlock">
                  <span>Números sorteados</span>
                  <div className="bingoNumbers bingoNumbersFeatured">
                    {bingoNumbers.length === 0 && <p>Nenhum número sorteado.</p>}
                    {bingoNumbers.map((number: number) => (
                      <span key={number}>{number}</span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bingoActionRow bingoControlButtons">
                <button onClick={drawVirtualNumber} disabled={bingoRoundClosed}>Sortear virtual</button>
                <button onClick={registerPhysicalNumber} disabled={bingoRoundClosed}>Registrar bolinha</button>
                <button onClick={openNewBingoRoundModal}>Nova rodada</button>
                <button className="secondaryButton" onClick={closeBingoRound} disabled={bingoRoundClosed}>Encerrar rodada</button>
                <button className="bingoClaimButton bingoClaimButtonLarge" onClick={triggerBingoClaim}>BINGO!</button>
              </div>
            </section>

            <section className="panel bingoControlPanel">
              <h2>Rodada</h2>
              <div className="bingoRoundFields">
                <div>
                  <span>Número da rodada</span>
                  <strong>{currentBingoRoundNumber}</strong>
                </div>
                <div>
                  <span>Premiação</span>
                  <strong>{currentBingoPrize}</strong>
                </div>
              </div>
              <div className="bingoActionRow">
                <input
                  value={winnerName}
                  onChange={e => setWinnerName(e.target.value)}
                  placeholder="Nome do ganhador"
                />
                <button onClick={registerBingoWinner}>Registrar ganhador</button>
              </div>
            </section>

            <section className="panel bingoControlPanel">
              <h2>Cartelas</h2>
              <div className="bingoStats">
                <strong>{bingoCards.length}</strong>
                <span>cartelas registradas</span>
              </div>
              <p>
                {tournament?.bingoCardMode === 'virtual'
                  ? 'Cartelas online habilitadas.'
                  : tournament?.bingoCardMode === 'mixed'
                    ? 'Cartelas físicas e online.'
                    : 'Cartelas físicas.'}
              </p>
            </section>

            <section className="panel bingoControlPanel bingoRoundsPanel">
              <h2>Histórico</h2>
              <div className="bingoRoundsTableWrap">
                <table className="bingoRoundsTable">
                  <thead>
                    <tr>
                      <th>Rodada</th>
                      <th>Números sorteados</th>
                      <th>Vencedor</th>
                      <th>Premiação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bingoRoundRows.map((row: any) => (
                      <tr key={row.roundName}>
                        <td>{row.roundNumber}</td>
                        <td>{row.numbers.length ? row.numbers.join(', ') : '-'}</td>
                        <td>{row.winners.length ? row.winners.join(', ') : '-'}</td>
                        <td>{row.prize || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {panelQrUrl && (
          <div className="qrModal" onClick={() => setPanelQrUrl(null)}>
            <div className="qrContent" onClick={event => event.stopPropagation()}>
              <h3>QR Code do Torneio</h3>
              <QRCodeCanvas value={panelQrUrl} size={220} />
              <p>{panelQrUrl}</p>
              <button onClick={() => setPanelQrUrl(null)}>Fechar</button>
            </div>
          </div>
        )}

        {showPhysicalNumberModal && (
          <div className="qrModal" onClick={() => setShowPhysicalNumberModal(false)}>
            <div className="detailsContent bingoRoundModal" onClick={event => event.stopPropagation()}>
              <div className="detailsHeader">
                <div>
                  <span>Registrar bolinha</span>
                  <h3>Número sorteado manualmente</h3>
                  <p>Informe o número retirado no sorteio físico.</p>
                </div>
                <button className="modalCloseButton" onClick={() => setShowPhysicalNumberModal(false)}>Fechar</button>
              </div>

              <label>Número da bolinha</label>
              <input
                type="number"
                min={1}
                max={bingoMaxNumber}
                value={physicalNumberInput}
                onChange={event => setPhysicalNumberInput(event.target.value)}
                placeholder={`1 a ${bingoMaxNumber}`}
              />

              <div className="adminModalActions">
                <button onClick={() => setShowPhysicalNumberModal(false)}>Cancelar</button>
                <button className="primaryButton" onClick={submitPhysicalNumber}>Registrar número</button>
              </div>
            </div>
          </div>
        )}

        {showNewBingoRound && (
          <div className="qrModal" onClick={() => setShowNewBingoRound(false)}>
            <div className="detailsContent bingoRoundModal" onClick={event => event.stopPropagation()}>
              <div className="detailsHeader">
                <div>
                  <span>Nova rodada</span>
                  <h3>Abrir próxima rodada</h3>
                  <p>Esses dados aparecem no painel AO VIVO e no telão.</p>
                </div>
                <button className="modalCloseButton" onClick={() => setShowNewBingoRound(false)}>Fechar</button>
              </div>

              <label>Número da rodada</label>
              <input
                type="number"
                min={1}
                value={newBingoRoundNumber}
                onChange={e => setNewBingoRoundNumber(Math.max(1, Number(e.target.value) || 1))}
              />

              <label>Premiação da rodada</label>
              <input
                value={newBingoRoundPrize}
                onChange={e => setNewBingoRoundPrize(e.target.value)}
                placeholder="Ex: R$ 500,00"
              />

              <div className="adminModalActions">
                <button onClick={() => setShowNewBingoRound(false)}>Cancelar</button>
                <button className="primaryButton" onClick={createNewBingoRound}>Abrir rodada</button>
              </div>
            </div>
          </div>
        )}

        {!isBingo && panelMode === 'board' ? (
          <div className="matchBoard">
          <section className="matchColumn pending">
            <h2>Aguardando</h2>
            {pendingMatches.length === 0 && <p className="emptyColumn">Nenhum jogo aguardando.</p>}
            <div className="roundMatches">
              {pendingMatches.map(renderMatchCard)}
            </div>
          </section>

          <section className="matchColumn playing">
            <h2>Jogando</h2>
            {playingMatches.length === 0 && <p className="emptyColumn">Nenhum jogo em andamento.</p>}
            <div className="roundMatches">
              {playingMatches.map(renderMatchCard)}
            </div>
          </section>

          <section className="matchColumn finished">
            <h2>Finalizados</h2>
            {finishedMatches.length === 0 && <p className="emptyColumn">Nenhum jogo finalizado.</p>}
            <div className="roundMatches">
              {finishedMatches.map(renderMatchCard)}
            </div>
          </section>
        </div>
        ) : !isBingo ? (
          <div className="proBracket">
            {bracketRounds.map((round, roundIndex) => (
              <div key={round.round} className="proRound">
                <h2>
                  {roundIndex === bracketRounds.length - 1
                    ? 'Final'
                    : roundIndex === bracketRounds.length - 2
                      ? 'Semifinal'
                      : `Rodada ${round.round}`}
                </h2>

                <div className="roundMatches">
                  {round.matches.map((match: any) => renderBracketCard(match, roundIndex === bracketRounds.length - 1))}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </main>
    </div>
  )
}

function RefereeMode() {
  const { id } = useParams()
  const navigate = useNavigate()
  const initialTable = Number(new URLSearchParams(window.location.search).get('mesa') || 0)
  const [tournament, setTournament] = useState<any>(null)
  const [matches, setMatches] = useState<any[]>([])
  const [selectedTable, setSelectedTable] = useState<number | null>(initialTable || null)
  const [now, setNow] = useState(Date.now())

  const tableCount = Math.max(1, Number(tournament?.tableCount || 1))
  const tables = Array.from({ length: tableCount }, (_, index) => index + 1)
  const currentTable = selectedTable || tables[0] || 1
  const playingMatches = matches.filter(match => match.status === 'playing')
  const refereePublicUrl = tournament?.publicSlug ? `/public/${tournament.publicSlug}` : ''

  function loadReferee() {
    fetch(`${API}/tournaments/${id}/referee`, { headers: authHeaders(), cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setTournament(data.tournament || null)
        setMatches(Array.isArray(data.matches) ? data.matches : [])
      })
  }

  useEffect(() => {
    loadReferee()
    const interval = setInterval(loadReferee, 5000)
    return () => clearInterval(interval)
  }, [id])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (!tournament) return

    if (!selectedTable || selectedTable > tableCount) {
      if (initialTable && initialTable <= tableCount) {
        setSelectedTable(initialTable)
        return
      }

      const preferredMatch = matches.find(match => match.status === 'playing') ||
        matches.find(match => match.status === 'pending')
      setSelectedTable(Number(preferredMatch?.table || 1))
    }
  }, [tournament, matches.length, selectedTable, tableCount])

  function playerName(player: any) {
    return player?.name || 'BYE'
  }

  function statusLabel(status: string) {
    if (status === 'playing') return 'Jogando'
    if (status === 'finished') return 'Finalizado'
    return 'Aguardando'
  }

  function currentMatchQuantity(match: any) {
    const defaultQuantity = Number(tournament?.matchQuantity || 0)
    if (tournament?.matchQuantityMode !== 'by_phase') return defaultQuantity

    const rules = safeJsonArray(tournament?.phaseMatchRules)
    const exactRule = rules.find(rule => Number(rule.phase) === Number(match?.round))
    const inheritedRule = rules
      .filter(rule => rule.appliesTo === 'until_final' && Number(rule.phase) <= Number(match?.round))
      .sort((a, b) => Number(b.phase) - Number(a.phase))[0]
    return Number(exactRule?.matchQuantity || inheritedRule?.matchQuantity || defaultQuantity)
  }

  function targetWins(match: any) {
    const quantity = Number(currentMatchQuantity(match) || 0)
    return quantity > 0 ? Math.floor(quantity / 2) + 1 : 0
  }

  function matchFormatLabel(match: any) {
    const quantity = Number(currentMatchQuantity(match) || 0)
    if (!quantity) return 'Partida simples'
    return `Melhor de ${quantity} - vence com ${targetWins(match)}`
  }

  function formatElapsed(ms: number) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const minuteLabel = String(minutes).padStart(2, '0')
    const secondLabel = String(seconds).padStart(2, '0')
    return hours > 0
      ? `${hours}:${minuteLabel}:${secondLabel}`
      : `${minuteLabel}:${secondLabel}`
  }

  function matchElapsedLabel(match: any) {
    if (!match || match.status !== 'playing') return '00:00'
    const startedAt = match.startedAt || match.calledAt
    if (!startedAt) return '00:00'
    return formatElapsed(now - new Date(startedAt).getTime())
  }

  function matchesForTable(table: number) {
    return matches
      .filter(match => Number(match.table || 0) === Number(table))
      .sort((a, b) => {
        const statusOrder: Record<string, number> = { playing: 1, pending: 2, finished: 3 }
        const statusDiff = (statusOrder[a.status] || 9) - (statusOrder[b.status] || 9)
        if (statusDiff !== 0) return statusDiff
        return Number(a.round || 0) - Number(b.round || 0) || Number(a.id || 0) - Number(b.id || 0)
      })
  }

  function currentMatchForTable(table: number) {
    const tableMatches = matchesForTable(table)
    return tableMatches.find(match => match.status === 'playing') ||
      tableMatches.find(match => match.status === 'pending') ||
      tableMatches.find(match => match.status === 'finished') ||
      null
  }

  function nextPendingForTable(table: number, currentMatchId?: number) {
    return matches
      .filter(match => (
        Number(match.table || 0) === Number(table) &&
        match.status === 'pending' &&
        match.id !== currentMatchId
      ))
      .sort((a, b) => Number(a.round || 0) - Number(b.round || 0) || Number(a.id || 0) - Number(b.id || 0))[0]
  }

  function otherTablesPendingMatches(table: number) {
    return matches
      .filter(match => Number(match.table || 0) !== Number(table) && match.status === 'pending')
      .sort((a, b) => Number(a.table || 0) - Number(b.table || 0) || Number(a.round || 0) - Number(b.round || 0))
      .slice(0, 8)
  }

  function canDeclareWinner(match: any, side: 'A' | 'B') {
    const target = targetWins(match)
    if (!target) return true
    return Number(side === 'A' ? match.scoreA : match.scoreB) >= target
  }

  function callMatch(matchId: number) {
    fetch(`${API}/matches/${matchId}/call`, {
      method: 'POST',
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) alert(data.error)
        loadReferee()
      })
  }

  function toggleRefereeLive() {
    if (!tournament) return

    fetch(`${API}/tournaments/${id}/live`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ liveStarted: !tournament.liveStarted }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setTournament((current: any) => ({
          ...current,
          liveStarted: data.tournament?.liveStarted ?? !current?.liveStarted,
        }))
      })
  }

  function startMatch(matchId: number) {
    fetch(`${API}/matches/${matchId}/start`, {
      method: 'POST',
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) alert(data.error)
        loadReferee()
      })
  }

  function updateScore(match: any, side: 'A' | 'B', delta: number) {
    const scoreA = Math.max(0, Number(match.scoreA || 0) + (side === 'A' ? delta : 0))
    const scoreB = Math.max(0, Number(match.scoreB || 0) + (side === 'B' ? delta : 0))

    setMatches(current => current.map(item =>
      item.id === match.id ? { ...item, scoreA, scoreB } : item
    ))

    fetch(`${API}/matches/${match.id}/score`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ scoreA, scoreB }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        if (data.autoFinished) {
          loadReferee()
        }
      })
  }

  function setScoreManually(match: any) {
    const value = prompt(
      'Informe o placar da partida no formato A-B',
      `${Number(match.scoreA || 0)}-${Number(match.scoreB || 0)}`
    )
    if (!value) return

    const [scoreA, scoreB] = value.split(/[-xX]/).map(item => Number(item.trim()))
    if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) {
      alert('Formato inválido. Exemplo: 2-1')
      return
    }

    fetch(`${API}/matches/${match.id}/score`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify({ scoreA, scoreB }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        loadReferee()
      })
  }

  function finishMatch(match: any, winnerId: number, resultType = 'normal') {
    if (resultType !== 'wo') {
      const winnerSide = winnerId === match.playerAId ? 'A' : 'B'
      if (!canDeclareWinner(match, winnerSide)) {
        const confirmEarly = confirm(`O placar ainda não atingiu o mínimo configurado (${matchFormatLabel(match)}). Confirmar vencedor mesmo assim?`)
        if (!confirmEarly) return
      }
    }

    const url = resultType === 'wo'
      ? `${API}/matches/${match.id}/wo`
      : `${API}/matches/${match.id}/result`

    fetch(url, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        winnerId,
        scoreA: match.scoreA || 0,
        scoreB: match.scoreB || 0,
        resultType,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) alert(data.error)
        loadReferee()
      })
  }

  function renderMiniMatch(match: any, title: string) {
    if (!match) {
      return (
        <div className="refereeSideCard empty">
          <strong>{title}</strong>
          <span>Nenhuma partida aguardando.</span>
        </div>
      )
    }

    return (
      <div className={`refereeSideCard ${match.status}`}>
        <strong>{title}</strong>
        <span>Jogo #{match.matchNumber} · Mesa {match.table || '-'} · Rodada {match.round}</span>
        <p>{playerName(match.playerA)} x {playerName(match.playerB)}</p>
        <button onClick={() => callMatch(match.id)}>Chamar jogadores</button>
      </div>
    )
  }

  function renderPlayerControl(match: any, side: 'A' | 'B') {
    const player = side === 'A' ? match.playerA : match.playerB
    const playerId = side === 'A' ? match.playerAId : match.playerBId
    const score = side === 'A' ? match.scoreA : match.scoreB
    const opponentName = side === 'A' ? playerName(match.playerB) : playerName(match.playerA)

    return (
      <div className="refereePlayerControl">
        <div>
          <span>{side === 'A' ? 'Jogador A' : 'Jogador B'}</span>
          <strong>{playerName(player)}</strong>
        </div>
        <div className="refereeLiveScore">
          <span>Placar</span>
          <strong>{score || 0}</strong>
        </div>
        <div className="refereePlayerButtons">
          <button disabled={!playerId} onClick={() => finishMatch(match, playerId, 'normal')}>Vitória</button>
          <button disabled={!playerId} onClick={() => finishMatch(match, playerId, 'wo')}>WO</button>
          <button disabled={!playerId} onClick={() => finishMatch(match, playerId, 'desistencia')} title={`${opponentName} desistiu`}>
            Desistência
          </button>
          <button disabled={!playerId} onClick={() => finishMatch(match, playerId, 'desclassificacao')} title={`${opponentName} foi desclassificado`}>
            Desclass.
          </button>
        </div>
      </div>
    )
  }

  function renderTableCard(table: number) {
    const tableMatch = currentMatchForTable(table)
    const activeCount = matches.filter(match => Number(match.table || 0) === table && match.status !== 'finished').length

    return (
      <button
        key={table}
        className={`refereeTableCard ${currentTable === table ? 'active' : ''} ${tableMatch?.status || 'empty'}`}
        onClick={() => setSelectedTable(table)}
      >
        <span>Mesa {table}</span>
        <strong>{tableMatch ? statusLabel(tableMatch.status) : 'Livre'}</strong>
        <small>{tableMatch ? `${playerName(tableMatch.playerA)} x ${playerName(tableMatch.playerB)}` : 'Sem partida agora'}</small>
        <em>{activeCount} jogo(s) pendente(s)</em>
      </button>
    )
  }

  const selectedMatch = currentMatchForTable(currentTable)
  const nextSameTable = nextPendingForTable(currentTable, selectedMatch?.id)
  const otherNextMatches = otherTablesPendingMatches(currentTable)
  const isBingoReferee = tournament?.format === 'bingo' || tournament?.sport?.slug === 'bingo'

  return (
    <div className="tournamentPageLayout">
      <aside className="tournamentMainSidebar">
        <div className="sidebarBrand">🎱 ProMaster</div>
        <button className="backDashboardButton" onClick={() => navigate('/app')}>
          Voltar ao painel principal
        </button>

        <div className="tournamentSidebarInfo">
          <span>Torneio</span>
          <strong>{tournament?.name || 'Carregando...'}</strong>
          <small>{tournamentStatusLabel(tournament?.status)}</small>
        </div>

        <button onClick={() => navigate(`/tournament/${id}`)}>Dashboard</button>
        <button onClick={() => navigate(`/tournament/${id}/chaveamento`)}>{isBingoReferee ? 'AO VIVO' : 'Chaveamento'}</button>
        <button onClick={() => navigate(`/tournament/${id}/inscritos`)}>Inscritos</button>
        <button onClick={() => navigate(`/tournament/${id}/settings`)}>Configurações / edição</button>
        {!isBingoReferee && <button className="active" onClick={() => navigate(`/arbitro/${id}`)}>Modo árbitro</button>}
        <button onClick={() => navigate(`/tournament/${id}/financeiro`)}>Financeiro</button>
        <button onClick={() => navigate(`/tournament/${id}/patrocinadores`)}>Patrocinadores</button>
        {!isBingoReferee && <button onClick={() => navigate(`/tournament/${id}/publico`)}>QR Code público</button>}
      </aside>

      <main className="saasMain refereeMain">
        <header className="hero">
          <div className="badge">Modo Árbitro</div>
          <h1>{tournament?.name || 'Painel do Árbitro'}</h1>
          <p>Controle mesas, chamada de jogadores, placar, WO, desistência e desclassificação pelo celular.</p>
          <div className="heroActions">
            <button disabled={!refereePublicUrl} onClick={() => refereePublicUrl && window.open(refereePublicUrl, '_blank')}>
              Público
            </button>
            <button onClick={() => window.open(`/telao/${id}`, '_blank')}>Telão</button>
            <button className={tournament?.liveStarted ? 'dangerButton' : ''} onClick={toggleRefereeLive}>
              {tournament?.liveStarted ? 'Encerrar transmissão' : 'Iniciar transmissão'}
            </button>
          </div>
        </header>

        <section className="refereeTablesPanel">
          <div>
            <h2>Mesas do torneio</h2>
            <p>{tableCount} mesa(s) configurada(s)</p>
          </div>
          <div className="refereeTablesGrid">
            {tables.map(renderTableCard)}
          </div>
        </section>

        <section className="refereeDashboardGrid">
          <div className="refereeMatchPanel">
            <div className="refereeSelectedHeader">
              <div>
                <span>Mesa {currentTable}</span>
                <h2>{selectedMatch ? `Jogo #${selectedMatch.matchNumber}` : 'Mesa sem partida'}</h2>
              </div>
              <div className="refereeTimerCard">
                <span>Tempo da partida</span>
                <strong>{matchElapsedLabel(selectedMatch)}</strong>
              </div>
            </div>

            {!selectedMatch && (
              <div className="refereeEmptyState">
                <strong>Nenhuma partida vinculada a esta mesa agora.</strong>
                <span>Selecione outra mesa ou gere a chave do torneio.</span>
              </div>
            )}

            {selectedMatch && (
              <>
                <div className="refereeMatchMeta">
                  <span>{statusLabel(selectedMatch.status)}</span>
                  <span>Rodada {selectedMatch.round}</span>
                  <span>{matchFormatLabel(selectedMatch)}</span>
                  <span>Total: {currentMatchQuantity(selectedMatch) || 1} partida(s)</span>
                </div>

                <div className="refereeScoreboard">
                  <div>
                    <span>{playerName(selectedMatch.playerA)}</span>
                    <strong>{selectedMatch.scoreA || 0}</strong>
                  </div>
                  <small>x</small>
                  <div>
                    <span>{playerName(selectedMatch.playerB)}</span>
                    <strong>{selectedMatch.scoreB || 0}</strong>
                  </div>
                </div>

                <div className="refereeScoreControls">
                  <button onClick={() => updateScore(selectedMatch, 'A', -1)}>- A</button>
                  <button onClick={() => updateScore(selectedMatch, 'A', 1)}>+ A</button>
                  <button onClick={() => updateScore(selectedMatch, 'B', -1)}>- B</button>
                  <button onClick={() => updateScore(selectedMatch, 'B', 1)}>+ B</button>
                  <button onClick={() => setScoreManually(selectedMatch)}>Inserir pontuação</button>
                </div>

                <div className="refereePlayersControlGrid">
                  {renderPlayerControl(selectedMatch, 'A')}
                  {renderPlayerControl(selectedMatch, 'B')}
                </div>

                <div className="refereePrimaryActions">
                  <button onClick={() => callMatch(selectedMatch.id)}>Chamar jogadores</button>
                  {selectedMatch.status === 'pending' && (
                    <button onClick={() => startMatch(selectedMatch.id)}>Iniciar partida</button>
                  )}
                  {selectedMatch.calledAt && (
                    <span>Chamada enviada {selectedMatch.callCount || 1} vez(es)</span>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="refereeSidePanel">
            {renderMiniMatch(nextSameTable, 'Próximo jogo desta mesa')}

            <div className="refereeSideCard">
              <strong>Próximas partidas das outras mesas</strong>
              {otherNextMatches.length === 0 && <span>Nenhuma outra mesa aguardando.</span>}
              <div className="refereeOtherMatches">
                {otherNextMatches.map(match => (
                  <button key={match.id} onClick={() => setSelectedTable(Number(match.table || 1))}>
                    <span>Mesa {match.table || '-'}</span>
                    <strong>{playerName(match.playerA)} x {playerName(match.playerB)}</strong>
                    <small>Jogo #{match.matchNumber}</small>
                  </button>
                ))}
              </div>
            </div>

            <div className="refereeSideCard">
              <strong>Jogos em andamento</strong>
              {playingMatches.length === 0 && <span>Nenhum jogo em andamento agora.</span>}
              <div className="refereeOtherMatches">
                {playingMatches.map(match => (
                  <button key={match.id} onClick={() => setSelectedTable(Number(match.table || 1))}>
                    <span>Mesa {match.table || '-'}</span>
                    <strong>{playerName(match.playerA)} x {playerName(match.playerB)}</strong>
                    <small>Jogo #{match.matchNumber} · {Number(match.scoreA || 0)} x {Number(match.scoreB || 0)}</small>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

function TelaoTV() {
  const { id } = useParams()
  const [rounds, setRounds] = useState<any[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [ranking, setRanking] = useState<any[]>([])
  const [bingoState, setBingoState] = useState<any>(null)
  const [bingoClaim, setBingoClaim] = useState<any>(null)
  const [view, setView] = useState(0)

  const publicUrl = tournament?.publicSlug
    ? publicTournamentUrl(tournament.publicSlug)
    : null
  const matches = rounds.flatMap(r => r.matches || [])
  const playing = matches.filter(m => m.status === 'playing')
  const pending = matches.filter(m => m.status === 'pending')
  const finished = matches.filter(m => m.status === 'finished')
  const destaque = playing[0] || pending[0]
  const isBingo = tournament?.format === 'bingo' || tournament?.sport?.slug === 'bingo'
  const drawnNumbers = bingoState?.drawnNumbers || []
  const latestBingoNumber = drawnNumbers[drawnNumbers.length - 1]
  const bingoWinners = bingoState?.winners || []
  const bingoCards = bingoState?.cards || []
  const currentRoundData = bingoState?.currentRound
  const currentBingoRound = currentRoundData?.name || bingoWinners[0]?.roundName || 'Rodada principal'
  const currentBingoPrize = currentRoundData?.prize || bingoWinners[0]?.prize || tournament?.prize || '-'

  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner

  function loadBracket() {
    fetch(`${API}/tournaments/${id}/bracket`)
      .then(res => res.json())
      .then(data => setRounds(data.rounds || []))

    fetch(`${API}/tournaments/${id}/ranking`)
      .then(res => res.json())
      .then(data => setRanking(Array.isArray(data) ? data : []))
  }

  function loadBingo() {
    fetch(`${API}/tournaments/${id}/bingo`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) {
          setBingoState(data)
          if (data.tournament) setTournament(data.tournament)
        }
      })
  }

  useEffect(() => {
    loadBracket()

    fetch(`${API}/tournaments/${id}`)
      .then(res => res.json())
      .then(data => {
        setTournament(data)
        if (data?.format === 'bingo' || data?.sport?.slug === 'bingo') {
          loadBingo()
        }
      })

    document.documentElement.requestFullscreen?.().catch(() => {})

    const updateInterval = setInterval(() => {
      loadBracket()
      loadBingo()
    }, 4000)

    const rotateInterval = setInterval(() => {
      setView(v => (v + 1) % (champion ? 3 : 2))
    }, 15000)

    return () => {
      clearInterval(updateInterval)
      clearInterval(rotateInterval)
    }
  }, [id, champion])

  useEffect(() => {
    if (!tournament?.bingoLastClaimAt) return

    setBingoClaim({
      at: tournament.bingoLastClaimAt,
      name: tournament.bingoLastClaimName || 'BINGO',
    })

    const timer = setTimeout(() => setBingoClaim(null), 9000)
    return () => clearTimeout(timer)
  }, [tournament?.bingoLastClaimAt])

  const bracketCardHeight = 132
  const bracketBaseGap = 18

  function bracketRoundStyle(roundIndex: number) {
    const scale = Math.pow(2, roundIndex)
    const unit = bracketCardHeight + bracketBaseGap

    return {
      '--tv-round-offset': `${roundIndex === 0 ? 0 : ((scale - 1) * unit) / 2}px`,
      '--tv-match-gap': `${bracketBaseGap + (scale - 1) * unit}px`,
    } as any
  }

  return (
    <div className="tvMode">
      <div className="tvHeader">
        <div>
          <span className="tvBadge">🎱 ProMaster Arena</span>

          {tournament?.organization?.logoUrl && (
            <img src={tournament.organization.logoUrl} className="tvLogo" />
          )}

          <h1>{tournament?.name || 'Torneio'}</h1>

          <p className="tvMeta">
            {tournament?.location && `📍 ${tournament.location}`}
            {tournament?.eventDate &&
              ` • 📅 ${new Date(tournament.eventDate).toLocaleDateString()}`}
            {tournament?.eventTime && ` • ⏰ ${tournament.eventTime}`}
          </p>
        </div>

        <div className="tvRight">
          <div className="tvLive">
            <span></span>
            AO VIVO
          </div>

          {publicUrl && (
            <div className="tvQr">
              <QRCodeCanvas value={publicUrl} size={120} />
            </div>
          )}
        </div>
      </div>

      {champion && (
        <div className="tvChampion">
          🏆 CAMPEÃO: {champion}
        </div>
      )}

      {isBingo && (
        <div className="bingoTv">
          {bingoClaim && (
            <div className="bingoTvClaim">
              <span>BINGO!</span>
              <strong>{bingoClaim.name}</strong>
            </div>
          )}

          <section className="bingoTvFeatured">
            <div className="bingoTvRoundMeta">
              <div>
                <span>Rodada</span>
                <strong>{currentBingoRound}</strong>
              </div>
              <div>
                <span>Premiação</span>
                <strong>{currentBingoPrize}</strong>
              </div>
            </div>
            <span>Número sorteado</span>
            <strong>{latestBingoNumber || '--'}</strong>
            <p>
              {tournament?.bingoDrawMode === 'virtual'
                ? 'Sorteio virtual pela plataforma'
                : 'Sorteio físico pelas bolinhas'}
            </p>
          </section>

          <div className="bingoTvGrid">
            <div className="tvPanel">
              <h3>Números sorteados</h3>
              <div className="bingoNumbers">
                {drawnNumbers.length === 0 && <p>Nenhum número sorteado</p>}
                {drawnNumbers.map((number: number) => (
                  <span key={number}>{number}</span>
                ))}
              </div>
            </div>

            <div className="tvPanel">
              <h3>Ganhadores das rodadas</h3>
              {bingoWinners.length === 0 && <p>Nenhum ganhador registrado</p>}
              {bingoWinners.slice(0, 8).map((winner: any) => (
                <div key={winner.id} className="tvRow live">
                  <span>{winner.winnerName}</span>
                  <strong>{winner.roundName || 'Rodada'}</strong>
                </div>
              ))}
            </div>

            <div className="tvPanel">
              <h3>Cartelas</h3>
              <div className="bingoStats">
                <strong>{bingoCards.length}</strong>
                <span>cartelas registradas</span>
              </div>
              <p>
                {tournament?.bingoCardMode === 'virtual'
                  ? 'Participação online habilitada'
                  : tournament?.bingoCardMode === 'mixed'
                    ? 'Cartelas físicas e virtuais'
                    : 'Cartelas físicas'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!isBingo && view === 0 && (
        <>
          <section className="tvFeatured">
            {destaque ? (
              <>
                <h2>
                  {destaque.status === 'playing'
                    ? 'JOGO EM ANDAMENTO'
                    : 'PRÓXIMO JOGO'}
                </h2>

                <div className="tvVersus">
                  <strong>{destaque.playerA}</strong>
                  <span>VS</span>
                  <strong>{destaque.playerB}</strong>
                </div>

                <p>Mesa {destaque.table}</p>
              </>
            ) : (
              <h2>Torneio finalizado</h2>
            )}
          </section>

          <div className="tvGrid">
            <div className="tvPanel">
              <h3>Jogando agora</h3>
              {playing.length === 0 && <p>Nenhum jogo em andamento</p>}
              {playing.map(m => (
                <div key={m.id} className="tvRow live">
                  <span>{m.playerA} x {m.playerB}</span>
                  <strong>Mesa {m.table}</strong>
                </div>
              ))}
            </div>

            <div className="tvPanel">
              <h3>Próximos jogos</h3>
              {pending.slice(0, 8).map(m => (
                <div key={m.id} className="tvRow">
                  <span>{m.playerA} x {m.playerB}</span>
                  <strong>Mesa {m.table}</strong>
                </div>
              ))}
            </div>

            <div className="tvPanel">
              <h3>Finalizados</h3>
              {finished.slice(-8).reverse().map(m => (
                <div key={m.id} className="tvRow">
                  <span>
                    {m.winner === m.playerA ? `🏆 ${m.playerA}` : m.playerA}
                    {' x '}
                    {m.winner === m.playerB ? `🏆 ${m.playerB}` : m.playerB}
                  </span>
                  <strong>Finalizado</strong>
                </div>
              ))}
            </div>

            <div className="tvPanel tvRankingPanel">
              <h3>Ranking</h3>
              {ranking.slice(0, 8).map((item: any, index: number) => (
                <div key={item.playerId || item.name} className="tvRow ranking">
                  <span>{index + 1}. {item.name}</span>
                  <strong>{item.wins}V / {item.losses}D</strong>
                </div>
              ))}
              {ranking.length === 0 && <p>Ranking aguardando resultados</p>}
            </div>
          </div>
        </>
      )}

      {!isBingo && view === 1 && (
        <div className="tvBracketView">
          <h2>Chave do Torneio</h2>

          <div className="tvBracket">
            {rounds.map((round, roundIndex) => (
              <div
                key={round.round}
                className="tvBracketRound"
                style={bracketRoundStyle(roundIndex)}
              >
                <h3>
                  {roundIndex === rounds.length - 1
                    ? 'Final'
                    : roundIndex === rounds.length - 2
                      ? 'Semifinal'
                      : `Rodada ${round.round}`}
                </h3>

                <div className="tvBracketRoundMatches">
                  {round.matches.map((match: any) => (
                    <div key={match.id} className={`tvBracketMatch ${match.status}`}>
                      <div className="matchMeta">
                        <span>Jogo #{match.matchNumber || match.id}</span>
                        <span>Mesa {match.table}</span>
                      </div>

                      <div className={match.winner === match.playerA ? 'tvBracketPlayer winner' : 'tvBracketPlayer'}>
                        {match.playerA}
                      </div>

                      <div className={match.winner === match.playerB ? 'tvBracketPlayer winner' : 'tvBracketPlayer'}>
                        {match.playerB}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isBingo && view === 2 && champion && (
        <div className="tvCelebration">
          <div className="confettiLayer">
            {Array.from({ length: 24 }).map((_, i) => (
              <span key={i} style={{ '--i': i } as any}></span>
            ))}
          </div>

          <div className="fireworksLayer">
            <span></span>
            <span></span>
            <span></span>
          </div>

          <div className="championTrophy">🏆</div>
          <p>Campeão do torneio</p>
          <h2>{champion}</h2>
        </div>
      )}
    </div>
  )
}

function AdminClientes() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [planFilter, setPlanFilter] = useState('todos')
  const [selectedOrg, setSelectedOrg] = useState<any>(null)
  const [editingOrg, setEditingOrg] = useState<any>(null)
  const [editForm, setEditForm] = useState<any>({
    name: '',
    email: '',
    phone: '',
    organizationName: '',
    street: '',
    number: '',
    complement: '',
    country: '',
    state: '',
    city: '',
  })
  const filteredOrgs = orgs
    .filter(org => org.name?.toLowerCase().includes(search.toLowerCase()))
    .filter(org => planFilter === 'todos' ? true : org.plan === planFilter)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())

  function loadClientes() {
    fetch(`${API}/admin/organizations`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => {
        const sorted = Array.isArray(data)
          ? [...data].sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
          : []
        setOrgs(sorted)
      })
  }

  function changePlan(id: number, plan: string) {
    fetch(`${API}/admin/organization/${id}/plan`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ plan }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        loadClientes()
      })
  }

  function openEditClient(org: any) {
    const adminUser = org.users?.find((user: any) => user.role === 'admin') || org.users?.[0]

    setEditingOrg(org)
    setEditForm({
      name: adminUser?.name || '',
      email: adminUser?.email || '',
      phone: adminUser?.phone || '',
      organizationName: org.name || '',
      street: org.street || org.address || '',
      number: org.number || '',
      complement: org.complement || '',
      country: org.country || '',
      state: org.state || '',
      city: org.city || '',
    })
  }

  function updateEditField(field: string, value: string) {
    setEditForm((current: any) => ({ ...current, [field]: value }))
  }

  function saveClientEdit() {
    if (!editingOrg) return

    fetch(`${API}/admin/organization/${editingOrg.id}/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(editForm),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        setEditingOrg(null)
        loadClientes()
        alert('Cliente atualizado.')
      })
  }

 useEffect(() => {
  if (!isLoggedIn()) {
    goHome()
    return
  }

  fetch(`${API}/me`, { headers: authHeaders() })
    .then(res => res.json())
    .then(data => {
      if (data.user?.role !== 'superadmin') {
        goHome()
        return
      }

      loadClientes()
    })
}, [])

  return (
    <div className="saasLayout">
      <AdminSidebar />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">👑 Superadmin</div>
          <h1>Clientes / Arenas</h1>
          <p>Gerencie organizações, planos, usuários e torneios.</p>
        </header>

        <div className="panel">
          <h2>Organizações cadastradas</h2>

          <div className="clientFilters">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Pesquisar por nome"
            />

            <select value={planFilter} onChange={e => setPlanFilter(e.target.value)}>
              <option value="todos">Todos os planos</option>
              <option value="trial">Trial</option>
              <option value="free">Acesso gratuito</option>
              <option value="pro">Pro</option>
              <option value="master">Master</option>
            </select>
          </div>

          {filteredOrgs.length === 0 && <p>Nenhum cliente encontrado.</p>}

          {filteredOrgs.map(org => (
            <div key={org.id} className="clientCard">
              <div>
                <strong>{org.name}</strong>
                <span>Cadastro: {org.createdAt ? new Date(org.createdAt).toLocaleDateString() : '-'}</span>
              </div>

              <div className="clientMetrics">
                <span>Plano: {org.plan === 'free' ? 'acesso gratuito' : org.plan}</span>
                <span>Usuários: {org.users?.length || 0}</span>
                <span>Torneios: {org.tournaments?.length || 0}</span>
              </div>

              <div className="clientActions">
                <button onClick={() => changePlan(org.id, 'trial')}>Trial</button>
                <button onClick={() => changePlan(org.id, 'pro')}>Pro</button>
                <button onClick={() => changePlan(org.id, 'master')}>Master</button>
                <button className="clientEditButton" onClick={() => openEditClient(org)}>
                  Editar cliente/arena
                </button>
                <button onClick={() => setSelectedOrg(org)}>Torneios</button>
                <button onClick={() => changePlan(org.id, 'free')}>Acesso gratuito</button>
              </div>
            </div>
          ))}
        </div>

        {editingOrg && (
          <div className="qrModal" onClick={() => setEditingOrg(null)}>
            <div className="detailsContent adminEditModal" onClick={e => e.stopPropagation()}>
              <div className="detailsHeader">
                <div>
                  <span>Editar cliente/arena</span>
                  <h3>{editingOrg.name}</h3>
                  <p>Atualize os dados principais do cliente, contato e endereço da arena.</p>
                </div>
                <button className="modalCloseButton" onClick={() => setEditingOrg(null)}>Fechar</button>
              </div>

              <div className="adminEditSection">
                <h4>Dados do cliente</h4>
                <div className="adminEditGrid">
                  <div>
                    <label>Nome do responsável</label>
                    <input value={editForm.name} onChange={e => updateEditField('name', e.target.value)} />
                  </div>

                  <div>
                    <label>E-mail</label>
                    <input type="email" value={editForm.email} onChange={e => updateEditField('email', e.target.value)} />
                  </div>

                  <div>
                    <label>Telefone / WhatsApp</label>
                    <input value={editForm.phone} onChange={e => updateEditField('phone', e.target.value)} />
                  </div>

                  <div>
                    <label>Nome da arena / organização</label>
                    <input value={editForm.organizationName} onChange={e => updateEditField('organizationName', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="adminEditSection">
                <h4>Endereço da arena</h4>
                <div className="adminEditGrid">
                  <div className="adminEditWide">
                    <label>Logradouro</label>
                    <input value={editForm.street} onChange={e => updateEditField('street', e.target.value)} />
                  </div>

                  <div>
                    <label>Número</label>
                    <input value={editForm.number} onChange={e => updateEditField('number', e.target.value)} />
                  </div>

                  <div>
                    <label>Complemento</label>
                    <input value={editForm.complement} onChange={e => updateEditField('complement', e.target.value)} />
                  </div>

                  <div>
                    <label>País</label>
                    <input value={editForm.country} onChange={e => updateEditField('country', e.target.value)} />
                  </div>

                  <div>
                    <label>Estado</label>
                    <input value={editForm.state} onChange={e => updateEditField('state', e.target.value)} />
                  </div>

                  <div>
                    <label>Cidade</label>
                    <input value={editForm.city} onChange={e => updateEditField('city', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="adminModalActions">
                <button onClick={() => setEditingOrg(null)}>Cancelar</button>
                <button className="primaryButton" onClick={saveClientEdit}>
                  Salvar cliente/arena
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedOrg && (
          <div className="qrModal" onClick={() => setSelectedOrg(null)}>
            <div className="detailsContent" onClick={e => e.stopPropagation()}>
              <div className="detailsHeader">
                <div>
                  <span>Torneios do cliente</span>
                  <h3>{selectedOrg.name}</h3>
                </div>
                <button onClick={() => setSelectedOrg(null)}>Fechar</button>
              </div>

              {(selectedOrg.tournaments || []).length === 0 && <p>Nenhum torneio encontrado.</p>}

              <div className="clientTournamentList">
                {(selectedOrg.tournaments || []).map((tournament: any) => (
                  <div key={tournament.id} className="clientTournamentRow">
                    <div>
                      <strong>{tournament.name}</strong>
                      <span>{tournamentStatusLabel(tournament.status)} • {tournament.playerCount} jogadores</span>
                    </div>
                    <button onClick={() => navigate(`/tournament/${tournament.id}`)}>
                      Abrir
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function Admin() {
  const navigate = useNavigate()
  const [orgs, setOrgs] = useState<any[]>([])
  const totalClientes = orgs.length
  const freeClientes = orgs.filter(org => org.plan === 'free').length
  const masterClientes = orgs.filter(org => org.plan === 'master').length
  const proClientes = orgs.filter(org => org.plan === 'pro').length

  useEffect(() => {
    if (!isLoggedIn()) {
      goHome()
      return
    }

    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        if (data.user?.role !== 'superadmin') {
          goHome()
          return
        }

        fetch(`${API}/admin/organizations`, { headers: authHeaders() })
          .then(res => res.json())
          .then(data => setOrgs(Array.isArray(data) ? data : []))
      })
  }, [])

  return (
    <div className="saasLayout">
      <AdminSidebar />

      <main className="saasMain">
        <header className="hero">
          <div className="badge">👑 Superadmin</div>
          <h1>Painel Master</h1>
          <p>Gestão da plataforma ProMaster Arena</p>
        </header>

        <div className="financeGrid adminStatsGrid">
          <div className="financeCard">
            <span>Clientes</span>
            <strong>{totalClientes}</strong>
          </div>

          <div className="financeCard">
            <span>Acesso gratuito</span>
            <strong>{freeClientes}</strong>
          </div>

          <div className="financeCard">
            <span>Master</span>
            <strong>{masterClientes}</strong>
          </div>

          <div className="financeCard">
            <span>Pro</span>
            <strong>{proClientes}</strong>
          </div>
        </div>

        <div className="panel adminQuickPanel">
          <h2>Ações rápidas</h2>
          <div className="tournamentActions">
            <button onClick={() => navigate('/admin/clientes')}>Gerenciar clientes</button>
            <button onClick={() => navigate('/admin/financeiro')}>Ver financeiro</button>
          </div>
        </div>
      </main>
    </div>
  )
}
