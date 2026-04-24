const pool = require("./db");
const { getTournamentTemplateByCode } = require("./templateService");
const {
  generateStageCodes,
  buildProgressionRulesForTop2Mirror,
  buildYouTubeEmbedUrl,
} = require("./tournamentTemplateHelpers");

async function createTournamentFromTemplate({
  accountId,
  templateCode,
  tournamentTitle,
  players,
  options = {},
  createdByUserId = null,
}) {
  const template = await getTournamentTemplateByCode(templateCode);

  if (!template) {
    throw new Error("Template não encontrado.");
  }

  const config = template.config;

  if (!Array.isArray(players) || players.length !== config.total_players) {
    throw new Error(`Este template exige exatamente ${config.total_players} jogadores.`);
  }

  const classificationFormat =
    options.classification_format ||
    config.classification?.default_format ||
    config.classification?.format ||
    "double_elimination";

  const qualifiedPerGroup =
    options.qualified_per_group ||
    config.classification?.qualified_per_group ||
    2;

  const playoffTargetSize =
    options.playoff_target_size ||
    config.playoff?.default_target_size ||
    config.playoff?.target_size ||
    null;

  const endgameMode =
    options.endgame_mode ||
    config.playoff?.endgame_mode ||
    config.stages?.[0]?.endgame_mode ||
    "standard";

  const allowBye =
    typeof options.allow_bye === "boolean"
      ? options.allow_bye
      : Boolean(config.options?.allow_bye);

  const allowWo =
    typeof options.allow_wo === "boolean"
      ? options.allow_wo
      : Boolean(config.options?.allow_wo);

  const livestreamProvider =
    options.livestream_provider ||
    config.options?.livestream_provider ||
    "youtube";

  const livestreamEnabled = Boolean(options.livestream_enabled);
  const livestreamUrl = options.livestream_url || null;
  const livestreamEmbedUrl =
    livestreamProvider === "youtube"
      ? buildYouTubeEmbedUrl(livestreamUrl || options.youtube_video_id || null)
      : options.livestream_embed_url || null;

  const tournamentResult = await pool.query(
    `
      insert into public.tournaments (
        account_id,
        title,
        mode,
        status,
        is_public,
        settings,
        created_by_user_id,
        livestream_enabled,
        livestream_provider,
        livestream_url,
        livestream_embed_url,
        created_at,
        updated_at
      ) values (
        $1, $2, $3, 'draft', $4, $5::jsonb, $6, $7, $8, $9, $10, now(), now()
      )
      returning *
    `,
    [
      accountId,
      tournamentTitle,
      config.template_type.includes("mixed") ? "mixed" : "single_elimination",
      Boolean(options.public_page ?? config.options?.public_page),
      JSON.stringify({
        template_code: template.code,
        template_name: template.name,
        template_category: template.category,
      }),
      createdByUserId,
      livestreamEnabled,
      livestreamProvider,
      livestreamUrl,
      livestreamEmbedUrl,
    ]
  );

  const tournament = tournamentResult.rows[0];

  const tournamentPlayers = [];
  for (let i = 0; i < players.length; i++) {
    const player = players[i];

    const inserted = await pool.query(
      `
        insert into public.tournament_players (
          tournament_id,
          account_id,
          name,
          email,
          team_name,
          seed,
          metadata,
          created_at,
          updated_at
        ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,now(),now())
        returning *
      `,
      [
        tournament.id,
        accountId,
        player.name,
        player.email || null,
        player.team_name || null,
        player.seed || (config.options?.auto_seed ? i + 1 : null),
        JSON.stringify(player.metadata || {}),
      ]
    );

    tournamentPlayers.push(inserted.rows[0]);
  }

  if (config.template_type === "knockout" || config.template_type === "knockout_open") {
    const stageConf = config.stages[0];

    const stageResult = await pool.query(
      `
        insert into public.tournament_stages (
          tournament_id,
          name,
          stage_code,
          stage_order,
          format,
          progression_type,
          competition_goal,
          endgame_mode,
          status,
          settings,
          created_at,
          updated_at
        ) values (
          $1,$2,$3,1,$4,$5,$6,$7,'draft',$8::jsonb,now(),now()
        )
        returning *
      `,
      [
        tournament.id,
        stageConf.name,
        stageConf.stage_code || "MAIN",
        stageConf.format,
        stageConf.progression_type,
        stageConf.competition_goal,
        endgameMode,
        JSON.stringify({
          allow_bye: allowBye,
          allow_wo: allowWo,
          requires_finish_definition: config.template_type === "knockout_open",
        }),
      ]
    );

    const stage = stageResult.rows[0];

    for (let i = 0; i < tournamentPlayers.length; i++) {
      await pool.query(
        `
          insert into public.stage_players (
            stage_id,
            player_id,
            seed,
            qualified_from_previous,
            created_at,
            updated_at
          ) values ($1,$2,$3,false,now(),now())
        `,
        [stage.id, tournamentPlayers[i].id, i + 1]
      );
    }

    return {
      tournament,
      stages_created: [stage],
      tournament_players_created: tournamentPlayers.length,
      progression_rules_created: 0,
    };
  }

  if (config.template_type === "mixed" || config.template_type === "mixed_open") {
    const classification = config.classification;
    const playoff = config.playoff;
    const stageCodes = generateStageCodes(classification.group_count);
    const classificationStages = [];

    for (let i = 0; i < classification.group_count; i++) {
      const stageResult = await pool.query(
        `
          insert into public.tournament_stages (
            tournament_id,
            name,
            stage_code,
            stage_order,
            format,
            progression_type,
            competition_goal,
            qualified_count,
            endgame_mode,
            status,
            settings,
            created_at,
            updated_at
          ) values (
            $1,$2,$3,$4,$5,'qualify_players',$6,$7,'standard','draft',$8::jsonb,now(),now()
          )
          returning *
        `,
        [
          tournament.id,
          `Chave ${stageCodes[i]}`,
          stageCodes[i],
          i + 1,
          classificationFormat,
          classification.competition_goal,
          qualifiedPerGroup,
          JSON.stringify({
            players_per_group: classification.players_per_group,
            allow_wo: allowWo,
          }),
        ]
      );

      classificationStages.push(stageResult.rows[0]);
    }

    const finalStageResult = await pool.query(
      `
        insert into public.tournament_stages (
          tournament_id,
          name,
          stage_code,
          stage_order,
          format,
          progression_type,
          competition_goal,
          endgame_mode,
          status,
          settings,
          created_at,
          updated_at
        ) values (
          $1,$2,$3,$4,$5,'determine_champion','determine_champion',$6,'draft',$7::jsonb,now(),now()
        )
        returning *
      `,
      [
        tournament.id,
        `Final ${playoffTargetSize || "Aberta"}`,
        `FINAL${playoffTargetSize || "OPEN"}`,
        classification.group_count + 1,
        playoff.format,
        endgameMode,
        JSON.stringify({
          target_size: playoffTargetSize,
          target_size_options: playoff.target_size_options || [],
          cross_rule: playoff.cross_rule,
          allow_bye: allowBye,
          allow_wo: allowWo,
          requires_finish_definition: Boolean(playoff.requires_manual_finish_definition),
        }),
      ]
    );

    const finalStage = finalStageResult.rows[0];

    for (let i = 0; i < tournamentPlayers.length; i++) {
      const stageIndex = Math.floor(i / classification.players_per_group);
      const stage = classificationStages[stageIndex];
      const localSeed = (i % classification.players_per_group) + 1;

      await pool.query(
        `
          insert into public.stage_players (
            stage_id,
            player_id,
            seed,
            qualified_from_previous,
            created_at,
            updated_at
          ) values ($1,$2,$3,false,now(),now())
        `,
        [stage.id, tournamentPlayers[i].id, localSeed]
      );
    }

    const rules = buildProgressionRulesForTop2Mirror(stageCodes);

    for (const rule of rules) {
      await pool.query(
        `
          insert into public.stage_progression_rules (
            to_stage_id,
            target_seed,
            from_stage_code,
            from_position,
            created_at,
            updated_at
          ) values ($1,$2,$3,$4,now(),now())
        `,
        [
          finalStage.id,
          rule.target_seed,
          rule.from_stage_code,
          rule.from_position,
        ]
      );
    }

    return {
      tournament,
      stages_created: [...classificationStages, finalStage],
      tournament_players_created: tournamentPlayers.length,
      progression_rules_created: rules.length,
      final_stage_id: finalStage.id,
    };
  }

  throw new Error("template_type inválido.");
}

module.exports = {
  createTournamentFromTemplate,
};
