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

function isPublicPath(path: string) {
  return (
    path === '/' ||
    path === '/login' ||
    path === '/register' ||
    path === '/forgot-password' ||
    path.startsWith('/telao/') ||
    path.startsWith('/public/')
  )
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
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard user={user} />} />
      <Route path="/upgrade" element={<Upgrade />} />
      <Route path="/criar-torneio" element={<CreateTournament user={user} />} />
      <Route path="/tournament/:id/settings" element={<TournamentSettings />} />
      <Route path="/public/:slug" element={<PublicTournament />} />
      <Route path="/admin/financeiro" element={<Financeiro />} />
      <Route path="/admin/clientes" element={<AdminClientes />} />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" />} />
<Route path="/tournament/:id" element={<TournamentBracket />} />
<Route path="/telao/:id" element={<TelaoTV />} />
<Route path="/register" element={<Register />} />

    </Routes>
  )
}

function Register() {
  const [organizationName, setOrganizationName] = useState('')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)

  function register() {
    if (!organizationName || !email || !phone || !password) {
      alert('Preencha organização, e-mail, telefone e senha')
      return
    }

    if (password !== confirmPassword) {
      alert('As senhas não conferem')
      return
    }

    setLoading(true)

    fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organizationName,
        name,
        email,
        phone,
        address,
        password,
      }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        alert('Cadastro criado! Você já pode entrar com seu e-mail e senha.')
        window.location.href = '/login'
      })
      .finally(() => setLoading(false))
  }

  return (
    <div className="registerPage">
      <div className="registerCard">
        <div className="badge">🎱 ProMaster Arena</div>
        <h1>Comece grátis</h1>
        <p>Crie sua arena e teste por 7 dias.</p>

        <label>Nome da organização *</label>
        <input value={organizationName} onChange={e => setOrganizationName(e.target.value)} />

        <label>Seu nome</label>
        <input value={name} onChange={e => setName(e.target.value)} />

        <label>E-mail *</label>
        <input value={email} onChange={e => setEmail(e.target.value)} />

        <label>Telefone *</label>
        <input value={phone} onChange={e => setPhone(e.target.value)} />

        <label>Endereço</label>
        <input value={address} onChange={e => setAddress(e.target.value)} />

        <label>Senha *</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} />

        <label>Confirmar senha *</label>
        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />

        <button className="primaryButton" onClick={register} disabled={loading}>
          {loading ? 'Criando...' : 'Criar conta grátis'}
        </button>

        <a href="/login">Já tenho conta</a>
      </div>
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
    window.location.href = '/admin'
  } else if (redirect && redirect !== '/login') {
    window.location.href = redirect
  } else {
    window.location.href = '/app'
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
          <a href="/register">Criar nova conta</a>
        </div>
      </div>
    </div>
  )
}

function ForgotPassword() {
  const [email, setEmail] = useState('')

  return (
    <div className="app">
      <div className="panel" style={{ maxWidth: 420, margin: '80px auto' }}>
        <h1>Recuperar senha</h1>
        <p>Informe seu e-mail. A recuperação automática ainda está em implantação.</p>

        <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" />

        <button
          className="primaryButton"
          onClick={() => alert('Recuperação de senha em implantação. Entre em contato com o suporte para redefinir o acesso.')}
        >
          Solicitar recuperação
        </button>

        <div className="loginLinks">
          <a href="/login">Voltar ao login</a>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ user }: any) {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<any[]>([])
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [detailsTournament, setDetailsTournament] = useState<any>(null)
  const plan = user?.organization?.plan || 'free'
  const isMasterPlan = plan === 'master'
  const trialEndsAt = user?.organization?.trialEndsAt
  const planExpiresAt = user?.organization?.planExpiresAt

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
      <aside className="sidebar">
        <div className="sidebarLogo">🎱 ProMaster</div>

        <button onClick={() => navigate('/app')}>Dashboard</button>
        <button onClick={() => navigate('/criar-torneio')}>Criar Torneio</button>
        <button onClick={() => navigate('/upgrade')}>Planos e pagamentos</button>
        {isMasterPlan && (
          <button onClick={() => navigate('/app/usuarios')}>Usuários</button>
        )}
        <button onClick={logout}>Sair</button>
      </aside>

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

          <div className="planSummary">
            <div>
              <span>Plano atual</span>
              <strong>{plan.toUpperCase()}</strong>
            </div>

            <div>
              <span>Início</span>
              <strong>{new Date(user?.organization?.createdAt).toLocaleDateString()}</strong>
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

          </div>

          <button className="primaryButton" onClick={() => navigate('/criar-torneio')}>
            + Criar Torneio
          </button>
        </header>

        <div className="panel">
          <h2>Meus Torneios</h2>

          {tournaments.length === 0 && <p>Nenhum torneio encontrado.</p>}

          {tournaments.map(t => {
            const publicUrl = `https://www.promasterarena.com.br/public/${t.publicSlug}`

            return (
              <div key={t.id} className="tournamentCard">
                <div className="tournamentHeader">
                  <div className="tournamentTitleBlock">
                    <strong>{t.name}</strong>
                    <span>{t.location ? `📍 ${t.location}` : 'Local não informado'}</span>
                  </div>
                  <span className={`statusBadge ${t.status}`}>{t.status}</span>
                </div>

                <div className="tournamentActions">
                  <button onClick={() => navigate(`/tournament/${t.id}`)}>
                    Painel
                  </button>

                  <button onClick={() => setDetailsTournament(t)}>
                    Detalhes
                  </button>

                  <button onClick={() => window.open(`/telao/${t.id}`, '_blank')}>
                    Telão
                  </button>

                    <button onClick={() => navigate(`/tournament/${t.id}/settings`)}>
                      Editar
                  </button>

                  {t.publicSlug && (
                    <>
                      <button onClick={() => navigator.clipboard.writeText(publicUrl)}>
                        Copiar link
                      </button>

                      <button onClick={() => window.open(publicUrl, '_blank')}>
                        Público
                      </button>

                      <button onClick={() => setQrUrl(publicUrl)}>
                        QR Code
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
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
                  <strong>{detailsTournament.status}</strong>
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
                  <span>Premiação</span>
                  <strong>{detailsTournament.prize || '-'}</strong>
                </div>
                <div>
                  <span>Transmissão</span>
                  <strong>{detailsTournament.youtubeUrl ? 'YouTube configurado' : 'Não configurada'}</strong>
                </div>
                {detailsTournament.youtubeUrl && (
                  <div>
                    <span>Link YouTube</span>
                    <a href={detailsTournament.youtubeUrl} target="_blank" rel="noreferrer">
                      Abrir transmissão
                    </a>
                  </div>
                )}
                {detailsTournament.publicSlug && (
                  <div>
                    <span>Página pública</span>
                    <a href={`https://www.promasterarena.com.br/public/${detailsTournament.publicSlug}`} target="_blank" rel="noreferrer">
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

function Upgrade() {
  const navigate = useNavigate()
  const [pixData, setPixData] = useState<any>(null)
  const [pixLoading, setPixLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [payments, setPayments] = useState<any[]>([])

  const plan = user?.organization?.plan || 'free'
  const trialEndsAt = user?.organization?.trialEndsAt
  const planExpiresAt = user?.organization?.planExpiresAt

  function createPix(plan: string) {
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

  useEffect(() => {
    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setUser(data.user))

    fetch(`${API}/me/payments`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setPayments(Array.isArray(data) ? data : []))
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
            alert('Pagamento aprovado! Plano ativado.')
            window.location.href = '/upgrade'
          }
        })
    }, 5000)

    return () => clearInterval(interval)
  }, [pixData?.paymentId])

  return (
    <div className="saasLayout">
      <aside className="sidebar">
        <div className="sidebarLogo">🎱 ProMaster</div>
        <button onClick={() => navigate('/app')}>Dashboard</button>
        <button onClick={() => navigate('/upgrade')}>Planos e pagamentos</button>
        <button className="sidebarFooterButton" onClick={() => navigate(-1)}>Voltar</button>
      </aside>

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
            <strong>{plan.toUpperCase()}</strong>
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

          <div className="planActions">
            <button onClick={() => window.scrollTo({ top: 420, behavior: 'smooth' })}>Upgrade</button>
            <button onClick={() => alert('Downgrade em implantação. Entre em contato com o suporte.')}>Downgrade</button>
            <button onClick={() => alert('Cancelamento em implantação. Entre em contato com o suporte.')}>Cancelar</button>
          </div>
        </div>
      </div>

      <div className="billingPlansGrid">
        <div className="panel billingPlanCard">
          <h2>PRO</h2>
          <p>R$ 29,90/mês</p>
          <p>Torneios ilimitados até 64 jogadores.</p>
          <button className="primaryButton" onClick={() => createPix('pro')}>
            Gerar Pix PRO
          </button>
        </div>

        <div className="panel billingPlanCard">
          <h2>MASTER</h2>
          <p>R$ 59,90/mês</p>
          <p>Até 128 jogadores ou 32 times.</p>
          <button className="upgradeButton" onClick={() => createPix('master')}>
            Gerar Pix MASTER
          </button>
        </div>

        <div className="panel billingPlanCard">
          <h2>Avulso</h2>
          <p>R$ 9,90 por torneio</p>
          <p>Ideal para eventos únicos.</p>
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
  const [playersText, setPlayersText] = useState('')
  const [form, setForm] = useState<any>({
    name: '',
    location: '',
    eventDate: '',
    eventTime: '',
    prize: '',
    rules: '',
    youtubeUrl: '',
  })

  useEffect(() => {
    fetch(`${API}/tournaments/${id}`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        setForm({
          name: data.name || '',
          location: data.location || '',
          eventDate: data.eventDate ? data.eventDate.slice(0, 10) : '',
          eventTime: data.eventTime || '',
          prize: data.prize || '',
          rules: data.rules || '',
          youtubeUrl: data.youtubeUrl || '',
        })
        setPlayersText(Array.isArray(data.players)
          ? data.players.map((player: any) => player.name).join('\n')
          : '')
      })
  }, [id])

  function updateField(field: string, value: string) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function saveSettings() {
    const players = playersText
      .split('\n')
      .map(player => player.trim())
      .filter(Boolean)

    fetch(`${API}/tournaments/${id}/settings`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ ...form, players }),
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

  return (
    <div className="saasLayout">
      <aside className="sidebar">
        <div className="sidebarLogo">🎱 ProMaster</div>
        <button onClick={() => navigate('/app')}>Dashboard</button>
        <button onClick={() => navigate('/upgrade')}>Planos e pagamentos</button>
        <button className="sidebarFooterButton" onClick={() => navigate(-1)}>Voltar</button>
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">✏️ Editar torneio</div>
          <h1>Editar torneio</h1>
          <p>Atualize dados públicos, jogadores, regras, premiação e transmissão ao vivo.</p>
        </header>

        <div className="panel settingsPanel">
          <label>Nome do torneio</label>
          <input value={form.name} onChange={e => updateField('name', e.target.value)} />

          <label>Local</label>
          <input value={form.location} onChange={e => updateField('location', e.target.value)} />

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

          <label>Link da transmissão YouTube</label>
          <input
            value={form.youtubeUrl}
            onChange={e => updateField('youtubeUrl', e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />

          <label>Regras</label>
          <textarea value={form.rules} onChange={e => updateField('rules', e.target.value)} />

          <label>Jogadores</label>
          <textarea
            className="playersTextarea"
            value={playersText}
            onChange={e => setPlayersText(e.target.value)}
            spellCheck={false}
            placeholder="Um jogador por linha"
          />
          <p className="helperText">
            Para manter a chave segura, edite os nomes mantendo a mesma quantidade de jogadores.
          </p>

          <button className="primaryButton" onClick={saveSettings}>Salvar edição</button>
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
    <div className="app">
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
          <a className="landingButton" href="/register">Começar grátis</a>
        </div>
      </header>

      <section className="landingHero">
        <div>
          <span className="landingBadge">Sistema SaaS para torneios</span>

          <h1>Organize torneios profissionais com chave, telão, ranking e Pix.</h1>

          <p>
            Plataforma para clubes, bares, arenas e organizadores criarem torneios
            de sinuca e esportes com visual profissional, QR Code público e gestão online.
          </p>

          <div className="landingCtas">
            <a className="landingButton" href="/register">Testar grátis por 7 dias</a>
            <a className="landingSecondary" href="#planos">Ver planos</a>
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
          <h2>Pix integrado</h2>
          <p>Venda planos, torneios avulsos e acompanhe o financeiro.</p>
        </div>
      </section>

      <section id="planos" className="landingPlans">
        <h2>Planos</h2>

        <div className="plansGrid">
          <div className="planCard">
            <h3>Free</h3>
            <strong>7 dias grátis</strong>
            <p>1 torneio até 16 jogadores.</p>
          </div>

          <div className="planCard featured">
            <h3>Pro</h3>
            <strong>R$ 29,90/mês</strong>
            <p>Torneios ilimitados até 64 jogadores.</p>
          </div>

          <div className="planCard">
            <h3>Master</h3>
            <strong>R$ 59,90/mês</strong>
            <p>Até 128 jogadores ou 32 times.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

function PublicTournament() {
  const { slug } = useParams()
  const [data, setData] = useState<any>(null)

  useEffect(() => {
    fetch(`${API}/public/${slug}`)
      .then(res => res.json())
      .then(setData)
  }, [slug])

  if (!data?.tournament) {
    return <div className="publicPage">Carregando torneio...</div>
  }

  const { tournament, rounds } = data
  const matches = (rounds || []).flatMap((round: any) =>
    (round.matches || []).map((match: any) => ({ ...match, round: round.round }))
  )
  const pending = matches.filter((match: any) => match.status === 'pending')
  const playing = matches.filter((match: any) => match.status === 'playing')
  const finished = matches.filter((match: any) => match.status === 'finished')
  const finalRound = rounds?.[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner
  const embedUrl = youtubeEmbedUrl(tournament.youtubeUrl)

  return (
    <div className="publicPage">
      <header className="publicHero">
        <span>AO VIVO • ProMaster Arena</span>
      </header>

      <main>
        {embedUrl ? (
          <>
            <section className="publicBroadcastGrid">
              <div className="publicCard publicVideo publicVideoLarge">
                <span className="publicCardLabel">Transmissão</span>
                <iframe
                  src={embedUrl}
                  title="Transmissão ao vivo"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>

              <aside className="publicSideStack">
                <div className="publicCard publicTitleCard">
                  <span className="publicCardLabel">Torneio</span>
                  <h1>{tournament.name}</h1>
                  {champion && <div className="publicChampion">🏆 Campeão: {champion}</div>}
                </div>

                <div className="publicCard publicInfoCard">
                  <span className="publicCardLabel">Informações</span>
                  <div className="publicInfoList">
                    <div><span>Status</span><strong>{tournament.status}</strong></div>
                    <div><span>Local</span><strong>{tournament.location || '-'}</strong></div>
                    <div><span>Data</span><strong>{tournament.eventDate ? new Date(tournament.eventDate).toLocaleDateString() : '-'}</strong></div>
                    <div><span>Horário</span><strong>{tournament.eventTime || '-'}</strong></div>
                    <div><span>Premiação</span><strong>{tournament.prize || '-'}</strong></div>
                    <div><span>Regras</span><strong>{tournament.rules || '-'}</strong></div>
                  </div>
                </div>
              </aside>
            </section>

            <section className="publicMatchColumns">
              <div className="publicCard publicMatchColumn next">
                <span className="publicCardLabel">Agenda</span>
                <h2>Próximos jogos</h2>
                {pending.length === 0 && <p>Nenhum próximo jogo.</p>}
                {pending.slice(0, 8).map((match: any) => (
                  <div key={match.id} className="publicMatchCard">
                    <strong>Jogo #{match.matchNumber || match.id}</strong>
                    <span>{match.playerA} x {match.playerB}</span>
                    <small>Mesa {match.table}</small>
                  </div>
                ))}
              </div>

              <div className="publicCard publicMatchColumn live">
                <span className="publicCardLabel">Agora</span>
                <h2>Em andamento</h2>
                {playing.length === 0 && <p>Nenhum jogo em andamento.</p>}
                {playing.map((match: any) => (
                  <div key={match.id} className="publicMatchCard live">
                    <strong>Jogo #{match.matchNumber || match.id}</strong>
                    <span>{match.playerA} x {match.playerB}</span>
                    <small>Mesa {match.table}</small>
                  </div>
                ))}
              </div>

              <div className="publicCard publicMatchColumn done">
                <span className="publicCardLabel">Placar</span>
                <h2>Resultados</h2>
                {finished.length === 0 && <p>Nenhum resultado registrado.</p>}
                {finished.slice(-8).reverse().map((match: any) => (
                  <div key={match.id} className="publicMatchCard done">
                    <strong>Jogo #{match.matchNumber || match.id}</strong>
                    <span>
                      {match.winner === match.playerA ? `🏆 ${match.playerA}` : match.playerA}
                      {' x '}
                      {match.winner === match.playerB ? `🏆 ${match.playerB}` : match.playerB}
                    </span>
                    <small>Vencedor: {match.winner}</small>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : (
          <section className="publicNoVideoGrid">
            <div className="publicCard publicInfoCard">
              <span className="publicCardLabel">Torneio</span>
              <h1>{tournament.name}</h1>
              {champion && <div className="publicChampion">🏆 Campeão: {champion}</div>}
              <div className="publicInfoList">
                <div><span>Status</span><strong>{tournament.status}</strong></div>
                <div><span>Local</span><strong>{tournament.location || '-'}</strong></div>
                <div><span>Data</span><strong>{tournament.eventDate ? new Date(tournament.eventDate).toLocaleDateString() : '-'}</strong></div>
                <div><span>Horário</span><strong>{tournament.eventTime || '-'}</strong></div>
                <div><span>Premiação</span><strong>{tournament.prize || '-'}</strong></div>
                <div><span>Regras</span><strong>{tournament.rules || '-'}</strong></div>
              </div>
            </div>

          <div className="publicCard publicMatchColumn next">
            <span className="publicCardLabel">Agenda</span>
            <h2>Próximos jogos</h2>
            {pending.length === 0 && <p>Nenhum próximo jogo.</p>}
            {pending.slice(0, 8).map((match: any) => (
              <div key={match.id} className="publicMatchCard">
                <strong>Jogo #{match.matchNumber || match.id}</strong>
                <span>{match.playerA} x {match.playerB}</span>
                <small>Mesa {match.table}</small>
              </div>
            ))}
          </div>

          <div className="publicCard publicMatchColumn live">
            <span className="publicCardLabel">Agora</span>
            <h2>Em andamento</h2>
            {playing.length === 0 && <p>Nenhum jogo em andamento.</p>}
            {playing.map((match: any) => (
              <div key={match.id} className="publicMatchCard live">
                <strong>Jogo #{match.matchNumber || match.id}</strong>
                <span>{match.playerA} x {match.playerB}</span>
                <small>Mesa {match.table}</small>
              </div>
            ))}
          </div>

          <div className="publicCard publicMatchColumn done">
            <span className="publicCardLabel">Placar</span>
            <h2>Resultados</h2>
            {finished.length === 0 && <p>Nenhum resultado registrado.</p>}
            {finished.slice(-8).reverse().map((match: any) => (
              <div key={match.id} className="publicMatchCard done">
                <strong>Jogo #{match.matchNumber || match.id}</strong>
                <span>
                  {match.winner === match.playerA ? `🏆 ${match.playerA}` : match.playerA}
                  {' x '}
                  {match.winner === match.playerB ? `🏆 ${match.playerB}` : match.playerB}
                </span>
                <small>Vencedor: {match.winner}</small>
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
  const [name, setName] = useState('Novo Torneio')
  const [templateId, setTemplateId] = useState(1)
  const [tableCount, setTableCount] = useState(4)

  const [location, setLocation] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [prize, setPrize] = useState('')
  const [rules, setRules] = useState('')
  const [hasYoutube, setHasYoutube] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [playersText, setPlayersText] = useState('')

  useEffect(() => {
    fetch(`${API}/templates`)
      .then(res => res.json())
      .then(data => setTemplates(Array.isArray(data) ? data : []))
  }, [])

  function createTournament() {
  const organizationId = user?.organizationId

  if (user?.organization?.plan === 'free') {
  alert('Seu plano permite apenas 1 torneio. Faça upgrade.')
  navigate('/upgrade')
  return
}

  if (!organizationId) {
    alert('Usuário sem organização')
    return
  }

  if (!name) {
    alert('Informe o nome do torneio')
    return
  }

  if (!playersText.trim()) {
    alert('Adicione jogadores')
    return
  }

  const players = playersText
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean)

  if (players.length < 2) {
    alert('Mínimo 2 jogadores')
    return
  }

  // 🔥 AQUI FICA O FETCH
  fetch(`${API}/organizations/${organizationId}/tournaments/create`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({
      name,
      templateId,
      tableCount,
      location,
      eventDate,
      eventTime,
      prize,
      rules,
      youtubeUrl: hasYoutube ? youtubeUrl : '',
      players,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.error) {
        alert(data.error)
        return
      }

      // 🚀 REDIRECIONAMENTO PROFISSIONAL
      navigate(`/tournament/${data.tournament.id}`)
    })
}

  return (
    <div className="saasLayout">
      <aside className="sidebar">
        <div className="sidebarLogo">🎱 ProMaster</div>
        <button onClick={() => navigate('/app')}>Dashboard</button>
        <button onClick={() => navigate('/upgrade')}>Planos e pagamentos</button>
        <button className="sidebarFooterButton" onClick={() => navigate(-1)}>Voltar</button>
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">🏆 Novo Torneio</div>
          <h1>Criar Torneio</h1>
          <p>Configure o evento e informe os participantes do torneio.</p>
        </header>

        <div className="createGrid">
          <div className="panel">
            <h2>Dados principais</h2>

            <label>Nome do torneio</label>
            <input value={name} onChange={e => setName(e.target.value)} />

            <label>Modelo</label>
            <select value={templateId} onChange={e => setTemplateId(Number(e.target.value))}>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            <label>Número de mesas</label>
            <input
              type="number"
              value={tableCount}
              onChange={e => setTableCount(Number(e.target.value))}
            />

            <label>Local</label>
            <input
              value={location}
              onChange={e => setLocation(e.target.value)}
              placeholder="Ex: Bar do João, Mesa 1..."
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

            <label className="checkboxLine">
              <input
                type="checkbox"
                checked={hasYoutube}
                onChange={e => setHasYoutube(e.target.checked)}
              />
              Transmissão YouTube
            </label>

            {hasYoutube && (
              <>
                <label>Link da transmissão</label>
                <input
                  value={youtubeUrl}
                  onChange={e => setYoutubeUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=..."
                />
              </>
            )}
          </div>

          <div className="panel">
            <h2>Jogadores</h2>

            <p>Digite ou cole um jogador por linha. A ordem será embaralhada ao gerar a chave.</p>

            <textarea
              className="playersTextarea"
              value={playersText}
              onChange={e => setPlayersText(e.target.value)}
              spellCheck={false}
              placeholder={`João Silva\nCarlos "Cacá"\nMarcos de Santos\nPedro Bola 8`}
            />

            <p style={{ marginTop: 10, color: '#94a3b8' }}>
               Jogadores: {playersText.split('\n').filter(p => p.trim()).length}
          </p>

           <div className="previewCard">
  <h3>Resumo</h3>
  <p><strong>{name}</strong></p>
  <p>{playersText.split('\n').filter(p => p.trim()).length} jogadores</p>
  {location && <p>📍 {location}</p>}
  {eventDate && <p>📅 {eventDate}</p>}
  {eventTime && <p>⏰ {eventTime}</p>}
  {hasYoutube && youtubeUrl && <p>Transmissão YouTube configurada</p>}
</div>

            <button className="primaryButton" onClick={createTournament}>
              Criar torneio e gerar chave
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}

function TournamentBracket() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [rounds, setRounds] = useState<any[]>([])
  const [panelMode, setPanelMode] = useState<'board' | 'bracket'>('board')
  const matches = rounds.flatMap(round =>
    (round.matches || []).map((match: any) => ({ ...match, round: round.round }))
  )
  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner
  const pendingMatches = matches.filter((match: any) => match.status === 'pending')
  const playingMatches = matches.filter((match: any) => match.status === 'playing')
  const finishedMatches = matches.filter((match: any) => match.status === 'finished')

  function loadBracket() {
    fetch(`${API}/tournaments/${id}/bracket`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setRounds(data.rounds || []))
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

  useEffect(() => {
    loadBracket()

    const interval = setInterval(loadBracket, 5000)
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
          <span>Mesa {match.table}</span>
        </div>

        <div className={match.winner === match.playerA ? 'proPlayer winner' : 'proPlayer'}>
          <span>{match.playerA}</span>
        </div>

        <div className={match.winner === match.playerB ? 'proPlayer winner' : 'proPlayer'}>
          <span>{match.playerB}</span>
        </div>

        {match.winner && (
          <div className={isFinalRound ? 'advanceLine championLine' : 'advanceLine'}>
            {isFinalRound ? `🏆 Campeão: ${match.winner}` : `${match.winner} avançou`}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="saasLayout">
      <aside className="sidebar">
        <div className="sidebarLogo">🎱 ProMaster</div>
        <button onClick={() => navigate('/app')}>Dashboard</button>
        <button onClick={() => navigate('/upgrade')}>Planos e pagamentos</button>
        <button className="sidebarFooterButton" onClick={() => navigate('/app')}>Voltar</button>
      </aside>

      <main className="saasMain">
       <header className="hero">
  <div className="badge">🏆 Painel do Torneio</div>

  <h1>Painel Torneio</h1>
  <p>Controle os jogos por status: aguardando, jogando e finalizados.</p>

  {champion && (
    <div className="championBanner">
      🏆 Campeão: {champion}
    </div>
  )}

  <div className="tournamentTopActions">
    <button onClick={() => window.open(`/telao/${id}`, '_blank')}>
      Abrir Telão
    </button>

    <button onClick={() => setPanelMode(panelMode === 'board' ? 'bracket' : 'board')}>
      {panelMode === 'board' ? 'Chaveamento' : 'Painel'}
    </button>
  </div>
</header>

        {panelMode === 'board' ? (
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
        ) : (
          <div className="proBracket">
            {rounds.map((round, roundIndex) => (
              <div key={round.round} className="proRound">
                <h2>
                  {roundIndex === rounds.length - 1
                    ? 'Final'
                    : roundIndex === rounds.length - 2
                      ? 'Semifinal'
                      : `Rodada ${round.round}`}
                </h2>

                <div className="roundMatches">
                  {round.matches.map((match: any) => renderBracketCard(match, roundIndex === rounds.length - 1))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function TelaoTV() {
  const { id } = useParams()
  const [rounds, setRounds] = useState<any[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [view, setView] = useState(0)

  const publicUrl = tournament?.publicSlug
    ? `https://www.promasterarena.com.br/public/${tournament.publicSlug}`
    : null
  const matches = rounds.flatMap(r => r.matches || [])
  const playing = matches.filter(m => m.status === 'playing')
  const pending = matches.filter(m => m.status === 'pending')
  const finished = matches.filter(m => m.status === 'finished')
  const destaque = playing[0] || pending[0]

  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner

  function loadBracket() {
    fetch(`${API}/tournaments/${id}/bracket`)
      .then(res => res.json())
      .then(data => setRounds(data.rounds || []))
  }

  useEffect(() => {
    loadBracket()

    fetch(`${API}/tournaments/${id}`)
      .then(res => res.json())
      .then(data => setTournament(data))

    document.documentElement.requestFullscreen?.().catch(() => {})

    const updateInterval = setInterval(loadBracket, 4000)

    const rotateInterval = setInterval(() => {
      setView(v => (v + 1) % (champion ? 3 : 2))
    }, 15000)

    return () => {
      clearInterval(updateInterval)
      clearInterval(rotateInterval)
    }
  }, [id, champion])

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

      {view === 0 && (
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
          </div>
        </>
      )}

      {view === 1 && (
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

      {view === 2 && champion && (
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

  function loadClientes() {
    fetch(`${API}/admin/organizations`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setOrgs(Array.isArray(data) ? data : []))
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
      <aside className="sidebar">
        <div className="sidebarLogo">👑 Admin Master</div>

        <button onClick={() => navigate('/admin')}>Dashboard</button>
        <button onClick={() => navigate('/admin/financeiro')}>Financeiro</button>
        <button onClick={() => navigate('/admin/clientes')}>Clientes</button>
        <button onClick={() => window.location.href = '/login'}>Sair</button>
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">👑 Superadmin</div>
          <h1>Clientes / Arenas</h1>
          <p>Gerencie organizações, planos, usuários e torneios.</p>
        </header>

        <div className="panel">
          <h2>Organizações cadastradas</h2>

          {orgs.map(org => (
            <div key={org.id} className="clientCard">
              <div>
                <strong>{org.name}</strong>
                <span>{org.slug}</span>
              </div>

              <div className="clientMetrics">
                <span>Plano: {org.plan}</span>
                <span>Usuários: {org.users?.length || 0}</span>
                <span>Torneios: {org.tournaments?.length || 0}</span>
              </div>

              <div className="clientActions">
                <button onClick={() => changePlan(org.id, 'trial')}>Trial</button>
                <button onClick={() => changePlan(org.id, 'free')}>Free</button>
                <button onClick={() => changePlan(org.id, 'pro')}>Pro</button>
                <button onClick={() => changePlan(org.id, 'master')}>Master</button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}

function Admin() {
  const navigate = useNavigate()

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
        }
      })
  }, [])

  return (
    <div className="saasLayout">
      <aside className="sidebar">
        <div className="sidebarLogo">👑 Admin Master</div>
        <button onClick={() => navigate('/admin')}>Dashboard</button>
        <button onClick={() => navigate('/admin/financeiro')}>Financeiro</button>
        <button onClick={() => navigate('/admin/clientes')}>Clientes</button>
        <button onClick={() => {
          localStorage.removeItem('token')
          window.location.href = '/'
        }}>
          Sair
        </button>
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">👑 Superadmin</div>
          <h1>Painel Master</h1>
          <p>Gestão da plataforma ProMaster Arena</p>
        </header>
      </main>
    </div>
  )
}
