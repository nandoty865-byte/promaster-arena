import { useEffect, useState } from 'react'
import './App.css'

type Match = {
  id: number
  playerA: string
  playerB: string
  winner: string
  table: number
status: string
}

type Round = {
  round: number
  matches: Match[]
}

function startMatch(matchId: number) {
  fetch(`http://187.77.238.247:3000/matches/${matchId}/start`, {
    method: 'POST',
  })
    .then(res => res.json())
    .then(() => window.location.reload())
}

function App() {
  const [rounds, setRounds] = useState<Round[]>([])

  useEffect(() => {
  const fetchData = () => {
    fetch('http://187.77.238.247:3000/tournaments/1/bracket')
      .then(res => res.json())
      .then(data => setRounds(data.rounds))
  }

  fetchData()

  const interval = setInterval(fetchData, 3000)

  return () => clearInterval(interval)
}, [])

  const finalRound = rounds[rounds.length - 1]
  const champion = finalRound?.matches?.[0]?.winner

  return (
    <div className="app">
      <header className="hero">
        <div className="badge">🎱 ProMaster Arena</div>
        <h1>Chave do Torneio</h1>
        <p>Torneio de sinuca em tempo real</p>

        {champion && (
          <div className="champion">
            <span>🏆 Campeão</span>
            <strong>{champion}</strong>
          </div>
        )}
      </header>

      <main className="bracket">
        {rounds.map((round) => (
          <section className="round" key={round.round}>
            <h2>
              {round.round === rounds.length
                ? 'Final'
                : round.round === rounds.length - 1
                  ? 'Semifinal'
                  : `Rodada ${round.round}`}
            </h2>

            <div className="roundMatches">
              {round.matches.map((match) => (
                <div className="match" key={match.id}>
                  <div className="matchTop">
<span className={`status ${match.status}`}>
  {match.status === 'playing' ? 'Jogando' : match.status === 'finished' ? 'Finalizado' : 'Aguardando'}
</span>
                    <span>Jogo #{match.id}</span>
                    <span>Mesa {match.table}</span>
                  </div>

                  <div className={match.winner === match.playerA ? 'player winner' : 'player'}>
                    <span>{match.playerA}</span>
                    {match.winner === match.playerA && <b>Venceu</b>}
                  </div>

                  <div className={match.winner === match.playerB ? 'player winner' : 'player'}>
                    <span>{match.playerB}</span>
                    {match.winner === match.playerB && <b>Venceu</b>}
                  </div>

<div className="matchTop">
  <span>Jogo #{match.id}</span>
  <span>Mesa {match.table}</span>
</div>

<div className={match.winner === match.playerA ? 'player winner' : 'player'}>
  <span>{match.playerA}</span>
</div>

<div className={match.winner === match.playerB ? 'player winner' : 'player'}>
  <span>{match.playerB}</span>
</div>

{/* 👇 COLE AQUI */}
{match.status !== 'finished' && (
  <button
    className="startButton"
    onClick={() => startMatch(match.id)}
  >
    Iniciar jogo
  </button>
)}
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}

export default App
