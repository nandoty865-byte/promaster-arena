import { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";

function parsePlayers(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, team_name] = line.split(";").map((v) => v?.trim());
      return {
        name,
        team_name: team_name || null,
      };
    })
    .filter((item) => item.name);
}

export default function TournamentTemplatesPage() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [playersText, setPlayersText] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    account_id: "11111111-1111-1111-1111-111111111111",
    tournament_title: "",
    livestream_enabled: false,
    livestream_url: "",
    public_page: true,
  });

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const result = await api.getTemplates();
        setTemplates(result.templates || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const parsedPlayers = useMemo(() => parsePlayers(playersText), [playersText]);

  const requiredPlayers = selectedTemplate?.config?.total_players || 0;
  const playersCountOk = selectedTemplate
    ? parsedPlayers.length === requiredPlayers
    : false;

  function generateTestPlayers() {
    if (!selectedTemplate) return;

    const total = selectedTemplate.config?.total_players || 0;
    const lines = [];

    for (let i = 1; i <= total; i++) {
      lines.push(`Jogador ${i};Equipe ${Math.ceil(i / 2)}`);
    }

    setPlayersText(lines.join("\n"));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!selectedTemplate) {
      setError("Selecione um template.");
      return;
    }

    if (!form.account_id.trim()) {
      setError("Informe account_id.");
      return;
    }

    if (!form.tournament_title.trim()) {
      setError("Informe o nome do torneio.");
      return;
    }

    if (!playersCountOk) {
      setError(`Este template exige exatamente ${requiredPlayers} jogadores.`);
      return;
    }

    try {
      setSubmitting(true);

      const result = await api.createTournamentFromTemplate({
        account_id: form.account_id,
        template_code: selectedTemplate.code,
        tournament_title: form.tournament_title,
        players: parsedPlayers,
        options: {
          public_page: form.public_page,
          livestream_enabled: form.livestream_enabled,
          livestream_provider: "youtube",
          livestream_url: form.livestream_url || null,
        },
      });

      setMessage(
        `Torneio criado com sucesso. ID: ${result.tournament?.id || "-"}`
      );
      setPlayersText("");
      setForm((prev) => ({
        ...prev,
        tournament_title: "",
        livestream_enabled: false,
        livestream_url: "",
      }));
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.page}>
      <h1>Templates de torneio</h1>
      <p>Selecione um modelo e crie o torneio a partir do backend real.</p>

      {loading && <div style={styles.info}>Carregando templates...</div>}
      {error && <div style={styles.error}>{error}</div>}
      {message && <div style={styles.success}>{message}</div>}

      <div style={styles.grid}>
        {templates.map((template) => (
          <button
            key={template.code}
            type="button"
            onClick={() => setSelectedTemplate(template)}
            style={{
              ...styles.card,
              border:
                selectedTemplate?.code === template.code
                  ? "2px solid #111827"
                  : "1px solid #ddd",
            }}
          >
            <div style={styles.cardTitle}>{template.name}</div>
            <div style={styles.cardDesc}>{template.description}</div>
            <div style={styles.badges}>
              <span style={styles.badge}>{template.category}</span>
              <span style={styles.badge}>
                {template.config?.total_players || 0} jogadores
              </span>
            </div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <form onSubmit={handleSubmit} style={{ ...styles.card, marginTop: 24 }}>
          <h2>{selectedTemplate.name}</h2>

          <div style={styles.formGrid}>
            <div>
              <label style={styles.label}>Account ID</label>
              <input
                style={styles.input}
                value={form.account_id}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, account_id: e.target.value }))
                }
              />
            </div>

            <div>
              <label style={styles.label}>Nome do torneio</label>
              <input
                style={styles.input}
                value={form.tournament_title}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    tournament_title: e.target.value,
                  }))
                }
                placeholder="Ex.: Open Arena 16"
              />
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <button type="button" style={styles.button} onClick={generateTestPlayers}>
              Gerar jogadores de teste
            </button>
            <button
              type="button"
              style={{ ...styles.button, marginLeft: 8, background: "#6b7280" }}
              onClick={() => setPlayersText("")}
            >
              Limpar
            </button>
          </div>

          <div style={{ marginTop: 16 }}>
            <label style={styles.label}>Jogadores (um por linha)</label>
            <textarea
              style={styles.textarea}
              value={playersText}
              onChange={(e) => setPlayersText(e.target.value)}
              placeholder={"Jogador 1;Equipe A\nJogador 2;Equipe B\nJogador 3"}
            />
            <div
              style={{
                marginTop: 8,
                color: playersCountOk ? "#166534" : "#92400e",
              }}
            >
              Total informado: {parsedPlayers.length} / {requiredPlayers}
            </div>
          </div>

          <div style={styles.formGrid}>
            <label style={styles.checkLine}>
              <input
                type="checkbox"
                checked={form.public_page}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, public_page: e.target.checked }))
                }
              />
              Página pública
            </label>

            <label style={styles.checkLine}>
              <input
                type="checkbox"
                checked={form.livestream_enabled}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    livestream_enabled: e.target.checked,
                  }))
                }
              />
              Live do YouTube
            </label>
          </div>

          {form.livestream_enabled && (
            <div style={{ marginTop: 16 }}>
              <label style={styles.label}>URL do YouTube</label>
              <input
                style={styles.input}
                value={form.livestream_url}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    livestream_url: e.target.value,
                  }))
                }
                placeholder="https://www.youtube.com/watch?v=..."
              />
            </div>
          )}

          <div style={{ marginTop: 24 }}>
            <button
              type="submit"
              style={styles.button}
              disabled={submitting || !playersCountOk}
            >
              {submitting ? "Criando..." : "Criar torneio"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

const styles = {
  page: {
    maxWidth: 1200,
    margin: "0 auto",
    padding: 24,
    fontFamily: "Arial, sans-serif",
  },
  grid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    marginTop: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 14,
    padding: 16,
    textAlign: "left",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 700,
  },
  cardDesc: {
    marginTop: 8,
    color: "#666",
  },
  badges: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    marginTop: 12,
  },
  badge: {
    padding: "4px 8px",
    borderRadius: 999,
    background: "#f3f4f6",
    fontSize: 12,
    fontWeight: 600,
  },
  formGrid: {
    display: "grid",
    gap: 16,
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    marginTop: 16,
  },
  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 14,
    color: "#374151",
  },
  input: {
    width: "100%",
    padding: 10,
    borderRadius: 8,
    border: "1px solid #ccc",
  },
  textarea: {
    width: "100%",
    minHeight: 220,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #ccc",
    resize: "vertical",
  },
  checkLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    paddingTop: 30,
  },
  button: {
    padding: "12px 18px",
    borderRadius: 10,
    border: "none",
    background: "#111827",
    color: "#fff",
    cursor: "pointer",
  },
  info: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: "#eff6ff",
    color: "#1d4ed8",
  },
  error: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: "#fee2e2",
    color: "#991b1b",
  },
  success: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    background: "#dcfce7",
    color: "#166534",
  },
};
