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

function publicTournamentUrl(slug?: string) {
  if (!slug) return ''
  return `${window.location.origin}/public/${slug}`
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
      <Route path="/planos" element={<PlansComparison />} />
      <Route path="/app" element={<Dashboard user={user} />} />
      <Route path="/app/perfil" element={<ProfilePage />} />
      <Route path="/upgrade" element={<Upgrade />} />
      <Route path="/campeonatos" element={<SeasonsPage user={user} />} />
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
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [logoUploading, setLogoUploading] = useState(false)

  function loadProfile() {
    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => {
        setUser(data.user)
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
        })
      })
  }

  function updateField(field: string, value: string) {
    setForm((current: any) => ({ ...current, [field]: value }))
  }

  function updatePasswordField(field: string, value: string) {
    setPasswordForm(current => ({ ...current, [field]: value }))
  }

  function saveProfile() {
    fetch(`${API}/me/profile`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify(form),
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

  function uploadLogo(file?: File) {
    if (!file) return

    const data = new FormData()
    data.append('logo', file)
    setLogoUploading(true)

    fetch(`${API}/me/logo`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`,
      },
      body: data,
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }

        loadProfile()
      })
      .finally(() => setLogoUploading(false))
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
              {logoUploading ? 'Enviando...' : 'Enviar logo'}
              <input
                type="file"
                accept="image/*"
                onChange={e => uploadLogo(e.target.files?.[0])}
                disabled={logoUploading}
              />
            </label>
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

function Dashboard({ user }: any) {
  const navigate = useNavigate()
  const [tournaments, setTournaments] = useState<any[]>([])
  const [qrUrl, setQrUrl] = useState<string | null>(null)
  const [detailsTournament, setDetailsTournament] = useState<any>(null)
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

          {tournaments.map(t => {
            const publicUrl = publicTournamentUrl(t.publicSlug)

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
      <ClientSidebar />

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
          <h2>Pix integrado</h2>
          <p>Venda planos, torneios avulsos e acompanhe o financeiro.</p>
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
      href: '/register',
      features: ['1 torneio', 'Até 16 jogadores', 'Chave e painel do torneio', 'Página pública', 'Login após expirar'],
    },
    {
      name: 'Pro',
      price: 'R$ 59,90',
      detail: 'por mês',
      description: 'Para arenas e organizadores com torneios recorrentes.',
      featured: true,
      cta: 'Escolher Pro',
      href: '/register',
      features: ['Torneios ilimitados', 'Até 64 jogadores', 'Telão e página pública', 'Ranking e histórico', 'Recursos principais'],
    },
    {
      name: 'Master',
      price: 'R$ 89,90',
      detail: 'por mês',
      description: 'Para operações maiores, equipe e torneios acima de 64 jogadores.',
      featured: false,
      cta: 'Escolher Master',
      href: '/register',
      features: ['Torneios acima de 64 jogadores', 'Usuários/equipe', 'Recursos avançados', 'Gestão ampliada', 'Acesso completo'],
    },
    {
      name: 'Avulso',
      price: 'R$ 21,90',
      detail: 'por torneio',
      description: 'Para quem precisa organizar apenas um evento pontual.',
      featured: false,
      cta: 'Comprar avulso',
      href: '/register',
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
          <a className="landingButton" href="/register">Começar grátis</a>
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
  const [bingoBuyer, setBingoBuyer] = useState({ name: '', email: '', whatsapp: '', quantity: 1 })
  const [bingoMessage, setBingoMessage] = useState('')

  useEffect(() => {
    setError('')
    setData(null)
    fetch(`${API}/public/${slug}`)
      .then(async res => {
        const result = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(result?.error || 'Erro ao carregar pagina publica')
        }
        return result
      })
      .then(setData)
      .catch(err => setError(err.message || 'Erro ao carregar pagina publica'))
  }, [slug])

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

  const { tournament, rounds, bingo } = data
  const isBingo = tournament.format === 'bingo' || tournament.sport?.slug === 'bingo'
  const bingoNumbers = bingo?.drawnNumbers || []
  const bingoWinners = bingo?.winners || []
  const bingoCards = bingo?.cards || []
  const canBuyBingoCards = isBingo && ['virtual', 'mixed'].includes(tournament.bingoCardMode || 'physical')
  const bingoCardLimit = Math.max(Number(tournament.bingoCardsPerParticipant || 1), 1)
  const matches = (rounds || []).flatMap((round: any) =>
    (round.matches || []).map((match: any) => ({ ...match, round: round.round }))
  )
  const pending = matches.filter((match: any) => match.status === 'pending')
  const playing = matches.filter((match: any) => match.status === 'playing')
  const finished = matches.filter((match: any) => match.status === 'finished')
  const finalRound = rounds?.[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner
  const embedUrl = youtubeEmbedUrl(tournament.youtubeUrl)
  const prizeLines = tournament.prize
    ? String(tournament.prize).split(/\n|,/).map((line: string) => line.trim()).filter(Boolean)
    : []
  const ruleLines = tournament.rules
    ? String(tournament.rules).split(/\n|,/).map((line: string) => line.trim()).filter(Boolean)
    : []

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

  return (
    <div className="publicPage">
      <header className="publicHero">
        <span>AO VIVO • ProMaster Arena</span>
      </header>

      <main>
        <section className="publicTopGrid">
          <div className="publicCard publicTitleCard">
            <span className="publicCardLabel">Torneio</span>
            <h1>{tournament.name}</h1>
            {champion && <div className="publicChampion">🏆 Campeão: {champion}</div>}
          </div>

          <div className="publicCard publicMiniInfoCard">
            <span className="publicCardLabel">Status</span>
            <strong>{tournament.status}</strong>
            <p>{tournament.location || 'Local não informado'}</p>
            <p>
              {tournament.eventDate ? new Date(tournament.eventDate).toLocaleDateString() : 'Data não informada'}
              {tournament.eventTime ? ` • ${tournament.eventTime}` : ''}
            </p>
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
                  {bingoMessage && <p>{bingoMessage}</p>}
                </div>
              )}
            </div>
          </section>
        )}

        {!isBingo && (
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
            {finished.slice(-5).reverse().map((match: any) => (
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
                    <span>{tournament.status} • {tournament.playerCount} jogadores</span>
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
  const [templateId, setTemplateId] = useState(1)
  const [sportSlug, setSportSlug] = useState('sinuca')
  const [sportSelectionDone, setSportSelectionDone] = useState(false)
  const [seasonId, setSeasonId] = useState('')
  const [tableCount, setTableCount] = useState(4)

  const [location, setLocation] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [prize, setPrize] = useState('')
  const [rules, setRules] = useState('')
  const [hasYoutube, setHasYoutube] = useState(false)
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [playersText, setPlayersText] = useState('')
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
  const isBingo = selectedTemplate?.format === 'bingo' || selectedTemplate?.sport?.slug === 'bingo'
  const selectedSport = sports.find((sport: any) => sport.slug === sportSlug)

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

  if (!isBingo && !playersText.trim()) {
    alert('Adicione jogadores')
    return
  }

  const players = playersText
    .split('\n')
    .map(p => p.trim())
    .filter(Boolean)

  if (!isBingo && players.length < 2) {
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
      tableCount: isBingo ? 1 : tableCount,
      location,
      eventDate,
      eventTime,
      prize,
      rules,
      youtubeUrl: hasYoutube ? youtubeUrl : '',
      seasonId: seasonId || null,
      bingoMode,
      bingoDrawMode,
      bingoCardMode,
      bingoMaxNumber,
      bingoCardPrice,
      bingoCardsPerParticipant,
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
          <p>Configure o evento e informe os participantes do torneio.</p>
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
              <select value={templateId} onChange={e => setTemplateId(Number(e.target.value))}>
                {filteredTemplates.map(t => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
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

          {!isBingo && (
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
  {seasonId && <p>Vinculado ao campeonato</p>}
</div>

            <button className="primaryButton" onClick={createTournament}>
              Criar torneio e gerar chave
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

  const [rounds, setRounds] = useState<any[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [bingoState, setBingoState] = useState<any>(null)
  const [physicalNumber, setPhysicalNumber] = useState('')
  const [winnerName, setWinnerName] = useState('')
  const [winnerPrize, setWinnerPrize] = useState('')
  const [panelMode, setPanelMode] = useState<'board' | 'bracket'>('board')
  const matches = rounds.flatMap(round =>
    (round.matches || []).map((match: any) => ({ ...match, round: round.round }))
  )
  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner
  const pendingMatches = matches.filter((match: any) => match.status === 'pending')
  const playingMatches = matches.filter((match: any) => match.status === 'playing')
  const finishedMatches = matches.filter((match: any) => match.status === 'finished')
  const isBingo = tournament?.format === 'bingo' || tournament?.sport?.slug === 'bingo'
  const bingoNumbers = bingoState?.drawnNumbers || []
  const latestBingoNumber = bingoNumbers[bingoNumbers.length - 1]
  const bingoWinners = bingoState?.winners || []
  const bingoCards = bingoState?.cards || []

  function loadBracket() {
    fetch(`${API}/tournaments/${id}/bracket`, {
      headers: authHeaders(),
    })
      .then(res => res.json())
      .then(data => setRounds(data.rounds || []))
  }

  function loadTournament() {
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
        loadBingo()
      })
  }

  function registerPhysicalNumber() {
    fetch(`${API}/tournaments/${id}/bingo/draw`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ source: 'physical', number: Number(physicalNumber) }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        setPhysicalNumber('')
        loadBingo()
      })
  }

  function registerBingoWinner() {
    fetch(`${API}/tournaments/${id}/bingo/winners`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ winnerName, prize: winnerPrize }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.error) {
          alert(data.error)
          return
        }
        setWinnerName('')
        setWinnerPrize('')
        loadBingo()
      })
  }

  useEffect(() => {
    loadBracket()
    loadTournament()
    loadBingo()

    const interval = setInterval(() => {
      loadBracket()
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
      <ClientSidebar />

      <main className="saasMain">
       <header className="hero">
  <div className="badge">🏆 Painel do Torneio</div>

  <h1>{isBingo ? 'Painel Bingo' : 'Painel Torneio'}</h1>
  <p>
    {isBingo
      ? 'Controle números sorteados, cartelas e ganhadores das rodadas.'
      : 'Controle os jogos por status: aguardando, jogando e finalizados.'}
  </p>

  {champion && (
    <div className="championBanner">
      🏆 Campeão: {champion}
    </div>
  )}

  <div className="tournamentTopActions">
    <button onClick={() => window.open(`/telao/${id}`, '_blank')}>
      Abrir Telão
    </button>

    {!isBingo && (
      <button onClick={() => setPanelMode(panelMode === 'board' ? 'bracket' : 'board')}>
        {panelMode === 'board' ? 'Chaveamento' : 'Painel'}
      </button>
    )}
  </div>
</header>

        {isBingo && (
          <div className="bingoControlGrid">
            <section className="panel bingoControlPanel">
              <h2>Controle do Bingo</h2>
              <div className="bingoCurrentNumber">
                <span>Último número</span>
                <strong>{latestBingoNumber || '--'}</strong>
              </div>

              <div className="bingoActionRow">
                <button onClick={drawVirtualNumber}>Sortear virtual</button>
                <input
                  value={physicalNumber}
                  onChange={e => setPhysicalNumber(e.target.value)}
                  placeholder="Número físico"
                />
                <button onClick={registerPhysicalNumber}>Registrar bolinha</button>
              </div>

              <div className="bingoNumbers">
                {bingoNumbers.length === 0 && <p>Nenhum número sorteado.</p>}
                {bingoNumbers.map((number: number) => (
                  <span key={number}>{number}</span>
                ))}
              </div>
            </section>

            <section className="panel bingoControlPanel">
              <h2>Ganhadores</h2>
              <div className="bingoActionRow">
                <input
                  value={winnerName}
                  onChange={e => setWinnerName(e.target.value)}
                  placeholder="Nome do ganhador"
                />
                <input
                  value={winnerPrize}
                  onChange={e => setWinnerPrize(e.target.value)}
                  placeholder="Rodada/prêmio"
                />
                <button onClick={registerBingoWinner}>Registrar ganhador</button>
              </div>

              {bingoWinners.length === 0 && <p>Nenhum ganhador registrado.</p>}
              {bingoWinners.map((winner: any) => (
                <div key={winner.id} className="bingoWinnerRow">
                  <strong>{winner.winnerName}</strong>
                  <span>{winner.prize || winner.roundName || 'Rodada'}</span>
                </div>
              ))}
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
        ) : null}
      </main>
    </div>
  )
}

function TelaoTV() {
  const { id } = useParams()
  const [rounds, setRounds] = useState<any[]>([])
  const [tournament, setTournament] = useState<any>(null)
  const [bingoState, setBingoState] = useState<any>(null)
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

  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner

  function loadBracket() {
    fetch(`${API}/tournaments/${id}/bracket`)
      .then(res => res.json())
      .then(data => setRounds(data.rounds || []))
  }

  function loadBingo() {
    fetch(`${API}/tournaments/${id}/bingo`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data) setBingoState(data)
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
          <section className="bingoTvFeatured">
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
                      <span>{tournament.status} • {tournament.playerCount} jogadores</span>
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
