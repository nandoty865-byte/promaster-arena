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

export default function App() {
  const [user, setUser] = useState<any>(null)
  const [loadingUser, setLoadingUser] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const path = window.location.pathname

    if (!token) {
  setLoadingUser(false)

  if (path !== '/login') {
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

  if (loadingUser && window.location.pathname !== '/login') {
    return <div className="app">Carregando sistema...</div>
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<Dashboard user={user} />} />
      <Route path="/upgrade" element={<Upgrade />} />
      <Route path="/criar-torneio" element={<CreateTournament user={user} />} />
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

        alert('Cadastro criado! Verifique seu e-mail para ativar a conta.')
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
  const [email, setEmail] = useState('cliente4@teste.com')
  const [password, setPassword] = useState('123456')

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

  if (data.user?.role === 'superadmin') {
    window.location.href = '/admin'
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
      </div>
    </div>
  )
}

function Dashboard({ user }: any) {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<any[]>([])
  const [qrUrl, setQrUrl] = useState<string | null>(null)

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
        <button onClick={() => navigate('/upgrade')}>Planos</button>
        <button onClick={logout}>Sair</button>
        <button onClick={() => navigate('/app/usuarios')}>Usuários</button>
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

          <h1>Dashboard Cliente</h1>
          <p>{user?.organization?.name}</p>

          <p className="planBadge">
            Plano atual: {user?.organization?.plan?.toUpperCase() || 'FREE'}
          </p>

          {user?.organization?.planExpiresAt && (
            <p>
              Vence em: {new Date(user.organization.planExpiresAt).toLocaleDateString()}
            </p>
          )}

          <button className="primaryButton" onClick={() => navigate('/criar-torneio')}>
            + Criar Torneio
          </button>

          {user?.organization?.plan !== 'pro' && user?.organization?.plan !== 'master' && (
            <button className="upgradeButton" onClick={() => navigate('/upgrade')}>
              Fazer upgrade
            </button>
          )}
        </header>

        <div className="panel">
          <h2>Meus Torneios</h2>

          {tournaments.length === 0 && <p>Nenhum torneio encontrado.</p>}

          {tournaments.map(t => {
            const publicUrl = `https://www.promasterarena.com.br/public/${t.publicSlug}`

            return (
              <div key={t.id} className="tournamentCard">
                <div className="tournamentHeader">
                  <strong>{t.name}</strong>
                  <span className={`statusBadge ${t.status}`}>{t.status}</span>
                </div>

                <p>{t.playerCount} jogadores</p>

                <div className="eventInfo">
                  {t.location && <span>📍 {t.location}</span>}
                  {t.eventDate && (
                    <span>📅 {new Date(t.eventDate).toLocaleDateString()}</span>
                  )}
                  {t.eventTime && <span>⏰ {t.eventTime}</span>}
                  {t.prize && <span>🏆 Premiação: {t.prize}</span>}
                  {t.rules && <span>📋 Regras: {t.rules}</span>}
                </div>

                <div className="tournamentActions">
                  <button onClick={() => navigate(`/tournament/${t.id}`)}>
                    Ver chave
                  </button>

                  <button onClick={() => window.open(`/telao/${t.id}`, '_blank')}>
                    Telão
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
      </main>
    </div>
  )
}

function Upgrade() {
  const [pixData, setPixData] = useState<any>(null)
  const [pixLoading, setPixLoading] = useState(false)

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
    if (!pixData?.paymentId) return

    const interval = setInterval(() => {
      fetch(`${API}/billing/payment/${pixData.paymentId}/status`, {
        headers: authHeaders(),
      })
        .then(res => res.json())
        .then(data => {
          if (data.status === 'approved') {
            alert('Pagamento aprovado! Plano ativado.')
            window.location.href = '/'
          }
        })
    }, 5000)

    return () => clearInterval(interval)
  }, [pixData?.paymentId])

  return (
    <div className="app">
      <header className="hero">
        <div className="badge">💳 ProMaster Arena</div>
        <h1>Upgrade de Plano</h1>
        <p>Escolha seu plano e pague via Pix</p>
      </header>

      <div className="adminGrid">
        <div className="panel">
          <h2>PRO</h2>
          <p>R$ 29,90/mês</p>
          <p>Torneios ilimitados até 64 jogadores.</p>
          <button className="primaryButton" onClick={() => createPix('pro')}>
            Gerar Pix PRO
          </button>
        </div>

        <div className="panel">
          <h2>MASTER</h2>
          <p>R$ 59,90/mês</p>
          <p>Até 128 jogadores ou 32 times.</p>
          <button className="upgradeButton" onClick={() => createPix('master')}>
            Gerar Pix MASTER
          </button>
        </div>

        <div className="panel">
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
    </div>
  )
}

function Financeiro() {
  const [finance, setFinance] = useState<any>(null)
  const [monthlyRevenue, setMonthlyRevenue] = useState<any[]>([])
  
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
          <a className="landingButton" href="/login">Começar grátis</a>
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
        <button onClick={() => navigate('/financeiro')}>Financeiro</button>
        <button onClick={() => navigate('/upgrade')}>Planos</button>
      </aside>

      <main className="saasMain">
        <header className="hero">
          <div className="badge">🏆 Novo Torneio</div>
          <h1>Criar Torneio</h1>
          <p>Configure as informações do evento e cole a lista de jogadores.</p>
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
          </div>

          <div className="panel">
            <h2>Jogadores</h2>

            <p>Cole 1 jogador por linha.</p>

            <textarea
              className="playersTextarea"
              value={playersText}
              onChange={e => setPlayersText(e.target.value)}
              placeholder={`João\nCarlos\nMarcos\nPedro`}
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

  return (
    <div className="saasLayout">
      <aside className="sidebar">
        <div className="sidebarLogo">🎱 ProMaster</div>
        <button onClick={() => navigate('/app')}>Dashboard</button>
        <button onClick={() => navigate('/financeiro')}>Financeiro</button>
        <button onClick={() => navigate('/upgrade')}>Planos</button>
      </aside>

      <main className="saasMain">
       <header className="hero">
  <div className="badge">🏆 Chave do Torneio</div>

  <h1>Chave Visual</h1>
  <p>Atualização automática em tempo real</p>

  <div className="tournamentTopActions">
    <button onClick={() => navigate('/app')}>
      Voltar ao Dashboard
    </button>

    <button onClick={() => window.open(`/telao/${id}`, '_blank')}>
      Abrir Telão
    </button>
  </div>
</header>

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
                {round.matches.map((match: any) => (
                 <div
                   key={match.id}
                   className={`proMatch ${match.status} ${match.winner ? 'hasWinner' : ''}`}
                   >
                    <div className="matchMeta">
                      <span>Jogo #{match.id}</span>
                      <span>Mesa {match.table}</span>
                    </div>

                    <div className="matchStatus">
                    {match.winner && (
              <div className="advanceLine">
                    {match.winner} avançou para a próxima fase
              </div>
            )}
                      {match.status === 'playing'
                        ? 'AO VIVO'
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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
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
      setView(v => (v + 1) % 2)
    }, 15000)

    return () => {
      clearInterval(updateInterval)
      clearInterval(rotateInterval)
    }
  }, [id])

  const matches = rounds.flatMap(r => r.matches || [])
  const playing = matches.filter(m => m.status === 'playing')
  const pending = matches.filter(m => m.status === 'pending')
  const finished = matches.filter(m => m.status === 'finished')
  const destaque = playing[0] || pending[0]

  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner

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
                  <span>{m.playerA} x {m.playerB}</span>
                  <strong>🏆 {m.winner}</strong>
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
              <div key={round.round} className="tvBracketRound">
                <h3>
                  {roundIndex === rounds.length - 1
                    ? 'Final'
                    : roundIndex === rounds.length - 2
                      ? 'Semifinal'
                      : `Rodada ${round.round}`}
                </h3>

                {round.matches.map((match: any) => (
                  <div key={match.id} className={`tvBracketMatch ${match.status}`}>
                    <div className="matchMeta">
                      <span>Jogo #{match.id}</span>
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
            ))}
          </div>
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
