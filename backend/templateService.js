const pool = require("./db");

async function getTournamentTemplateByCode(code) {
  const result = await pool.query(
    `
      select *
      from public.tournament_templates
      where code = $1
        and is_active = true
      limit 1
    `,
    [code]
  );

  return result.rows[0] || null;
}

async function listTournamentTemplates() {
  const result = await pool.query(
    `
      select
        id,
        code,
        name,
        category,
        description,
        config,
        is_active,
        created_at,
        updated_at
      from public.tournament_templates
      where is_active = true
      order by category asc, name asc
    `
  );

  return result.rows;
}

module.exports = {
  getTournamentTemplateByCode,
  listTournamentTemplates,
};
