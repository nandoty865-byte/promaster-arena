const express = require("express");
const cors = require("cors");

const app = express();
const pool = require("./db");
const { listTournamentTemplates } = require("./templateService");
const { createTournamentFromTemplate } = require("./createTournamentFromTemplate");

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.json({ ok: true, service: "promaster-backend" });
});

app.get("/api", (req, res) => {
  res.json({ ok: true, route: "/api" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/tournaments", (req, res) => {
  res.json({
    tournaments: [],
    message: "Backend pronto para integração",
  });
});

app.get("/api/tournament-templates", async (req, res) => {
  try {
    const templates = await listTournamentTemplates();
    res.json(templates);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Erro ao listar templates." });
  }
});

app.post("/api/tournaments/from-template", async (req, res) => {
  try {
    const {
      account_id,
      template_code,
      tournament_title,
      players,
      options = {},
      created_by_user_id = null,
    } = req.body;

    if (!account_id || !template_code || !tournament_title || !Array.isArray(players)) {
      return res.status(400).json({
        error: "account_id, template_code, tournament_title e players são obrigatórios.",
      });
    }

    const created = await createTournamentFromTemplate({
      accountId: account_id,
      templateCode: template_code,
      tournamentTitle: tournament_title,
      players,
      options,
      createdByUserId: created_by_user_id,
    });

    res.status(201).json({
      ok: true,
      ...created,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error.message || "Erro ao criar torneio por template.",
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log("🚀 Backend rodando na porta " + PORT);
});
