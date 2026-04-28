import { useEffect, useState } from 'react'
import { QRCodeCanvas } from 'qrcode.react'
import './App.css'

type Template = { id: number; name: string }
type Tournament = { id: number; name: string; playerCount: number; status: string; publicSlug?: string }
type Match = {
  id: number
  playerA: string
  playerB: string
  playerAId: number
  playerBId: number
  winner: string
  table: number
  status: string
}
type Round = { round: number; matches: Match[] }
type RankingItem = { playerId: number; name: string; wins: number; losses: number; played: number; winRate: number }

const API = '/api'

function App() {
  const pathParts = window.location.pathname.split('/')
  const isLogin = pathParts[1] === 'login'
  const isDashboard = pathParts[1] === 'dashboard'
  const isTelao = pathParts[1] === 'telao'
  const isPublic = pathParts[1] === 'public'

  const telaoTournamentId = pathParts[2] ? Number(pathParts[2]) : 1
  const publicSlug = pathParts[2]
  const publicTelaoUrl = `https://www.promasterarena.com.br/telao/${telaoTournamentId}`

  const [templates, setTemplates] = useState<Template[]>([])
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [ranking, setRanking] = useState<RankingItem[]>([])
  const [selectedTournament, setSelectedTournament] = useState<number | null>(null)

  const [user, setUser] = useState<any>(null)
  const [email, setEmail] = useState('cliente4@teste.com')
  const [password, setPassword] = useState('123456')

  const [name, setName] = useState('Novo Torneio')
  const [templateId, setTemplateId] = useState(1)
  const [tableCount, setTableCount] = useState(4)

  const token = localStorage.getItem('token')

  function authHeaders() {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token') || ''}`,
    }
  }

  function login() {
    fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(res => res.json())
      .then(data => {
        if (!data.token) {
          alert(data.error || 'Erro ao entrar')
          return
        }

        localStorage.setItem('token', data.token)
        window.location.href = '/dashboard'
      })
  }

  function logout() {
    localStorage.removeItem('token')
    window.location.href = '/login'
  }

  function loadMe() {
    fetch(`${API}/me`, { headers: authHeaders() })
      .then(res => res.json())
      .then(data => setUser(data.user))
  }

  function loadMyTournaments() {
    fetch(`${API}/me/tournaments`, { headers: authHeaders() })
      .then(res => res.json())
      .then(setTournaments)
  }

  function loadAdmin() {
    fetch(`${API}/templates`).then(res => res.json()).then(setTemplates)
    fetch(`${API}/tournaments`).then(res => res.json()).then(setTournaments)
  }

  function loadRanking(id: number) {
    fetch(`${API}/tournaments/${id}/ranking`)
      .then(res => res.json())
      .then(setRanking)
  }

  function loadBracket(id: number) {
    setSelectedTournament(id)

    fetch(`${API}/tournaments/${id}/bracket`)
      .then(res => res.json())
      .then(data => {
        setRounds(data.rounds || [])
        loadRanking(id)
      })
  }

  function loadPublicTournament(slug: string) {
    fetch(`${API}/public/${slug}`)
      .then(res => res.json())
      .then(data => {
        setRounds(data.rounds || [])
        if (data.tournament?.id) loadRanking(data.tournament.id)
      })
  }

  function createTournament() {
    const organizationId = user?.organizationId

    if (!organizationId) {
      alert('Usuário sem organização')
      return
    }

    fetch(`${API}/organizations/${organizationId}/tournaments/create`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, templateId, tableCount }),
    })
      .then(res => res.json())
      .then(data => {
        loadMyTournaments()
        loadBracket(data.tournament.id)
      })
  }

  function startMatch(matchId: number) {
    fetch(`${API}/matches/${matchId}/start`, { method: 'POST' })
      .then(() => selectedTournament && loadBracket(selectedTournament))
  }

  function finishMatch(matchId: number, winnerId: number) {
    fetch(`${API}/matches/${matchId}/result`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ winnerId }),
    })
      .then(() => selectedTournament && loadBracket(selectedTournament))
  }

  useEffect(() => {
    if (isDashboard) {
      if (!token) {
        window.location.href = '/login'
        return
      }

      loadMe()
      loadMyTournaments()
      fetch(`${API}/templates`).then(res => res.json()).then(setTemplates)
    }

    if (!isDashboard && !isLogin && !isTelao && !isPublic) {
      loadAdmin()
    }

    if (isTelao) loadBracket(telaoTournamentId)
    if (isPublic && publicSlug) loadPublicTournament(publicSlug)
  }, [])

  useEffect(() => {
    if (!selectedTournament) return

    const interval = setInterval(() => {
      loadBracket(selectedTournament)
    }, 3000)

    return () => clearInterval(interval)
  }, [selectedTournament])

  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner

  if (isLogin) {
    return (
      <div className="app">
        <div className="panel" style={{ maxWidth: 420, margin: '80px auto' }}>
          <h1>Login</h1>
          <p>ProMaster Arena</p>

          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="E-mail" />
          <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Senha" type="password" />

          <button className="primaryButton" onClick={login}>Entrar</button>
        </div>
      </div>
    )
  }

  if (isTelao || isPublic) {
    const allMatches = rounds.flatMap(r => r.matches)
    const playingMatches = allMatches.filter(m => m.status === 'playing')
    const pendingMatches = allMatches.filter(m => m.status === 'pending')
    const featuredMatch = playingMatches[0] || pendingMatches[0]

    return (
      <div className="telaoPro">
        <h1>🎱 ProMaster Arena</h1>

        {!isPublic && (
          <div className="qrBox">
            <QRCodeCanvas value={publicTelaoUrl} size={120} />
            <span>Escaneie</span>
          </div>
        )}

        {champion && <div className="telaoChampionPro">🏆 {champion}</div>}

        {featuredMatch && (
          <div className="featuredMatch">
            <h2>{featuredMatch.status === 'playing' ? 'AO VIVO' : 'PRÓXIMO'}</h2>
            <div className="versus">
              <span>{featuredMatch.playerA}</span>
              <strong>VS</strong>
              <span>{featuredMatch.playerB}</span>
            </div>
            <p>Mesa {featuredMatch.table}</p>
          </div>
        )}

        <div className="telaoGrid">
          <div>
            <h3>Jogando</h3>
            {playingMatches.map(m => <div key={m.id}>{m.playerA} x {m.playerB}</div>)}
          </div>

          <div>
            <h3>Próximos</h3>
            {pendingMatches.slice(0, 6).map(m => <div key={m.id}>{m.playerA} x {m.playerB}</div>)}
          </div>
        </div>

        <section className="rankingBox">
          <h2>Ranking</h2>
          {ranking.slice(0, 8).map((item, index) => (
            <div className="rankingRow" key={item.playerId}>
              <strong>{index + 1}º {item.name}</strong>
              <span>{item.wins}V / {item.losses}D · {item.winRate}%</span>
            </div>
          ))}
        </section>
      </div>
    )
  }

  if (isDashboard) {
    return (
      <div className="app">
        <header className="hero">
          <div className="badge">🎱 ProMaster Arena</div>
          <h1>Dashboard Cliente</h1>
          <p>{user?.organization?.name || 'Carregando organização...'}</p>
          <button onClick={logout}>Sair</button>
        </header>

        <div className="adminGrid">
          <div className="panel">
            <h2>Criar Torneio</h2>

            <input value={name} onChange={e => setName(e.target.value)} />

            <select value={templateId} onChange={e => setTemplateId(Number(e.target.value))}>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>

            <input type="number" value={tableCount} onChange={e => setTableCount(Number(e.target.value))} />

            <button className="primaryButton" onClick={createTournament}>Criar torneio</button>
          </div>

          <div className="panel">
            <h2>Meus Torneios</h2>

            {tournaments.map(t => (
              <button key={t.id} className="tournament" onClick={() => loadBracket(t.id)}>
                <strong>{t.name}</strong>
                <span>{t.playerCount} jogadores · {t.status}</span>
                {t.publicSlug && <small> /public/{t.publicSlug}</small>}
              </button>
            ))}
          </div>
        </div>

        <div className="bracket">
          {rounds.map(r => (
            <div key={r.round} className="round">
              <h2>Rodada {r.round}</h2>

              {r.matches.map(match => (
                <div key={match.id} className="match">
                  <div className="matchTop">
                    <span>Jogo #{match.id}</span>
                    <span>Mesa {match.table}</span>
                  </div>

                  <div className={match.winner === match.playerA ? 'player winner' : 'player'}>
                    <span>{match.playerA}</span>
                    {match.status !== 'finished' && (
                      <button onClick={() => finishMatch(match.id, match.playerAId)}>Venceu</button>
                    )}
                  </div>

                  <div className={match.winner === match.playerB ? 'player winner' : 'player'}>
                    <span>{match.playerB}</span>
                    {match.status !== 'finished' && (
                      <button onClick={() => finishMatch(match.id, match.playerBId)}>Venceu</button>
                    )}
                  </div>

                  {match.status === 'pending' && (
                    <button className="startButton" onClick={() => startMatch(match.id)}>Iniciar jogo</button>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="app">
      <h1>ProMaster Arena</h1>
      <p>Acesse <a href="/login">/login</a> ou <a href="/dashboard">/dashboard</a></p>
    </div>
  )
}

export default App
