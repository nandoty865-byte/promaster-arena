BEGIN;

-- =========================================================
-- ProMaster Arena - Core Schema
-- Migration: 002_promaster_core.sql
-- Compatível com a migration inicial 001_init.sql
-- =========================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================
-- 1) UPGRADE DA TABELA tournaments (já existe em 001_init.sql)
-- =========================================================

ALTER TABLE public.tournaments
  ADD COLUMN IF NOT EXISTS account_id uuid,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS mode text DEFAULT 'single_elimination',
  ADD COLUMN IF NOT EXISTS tournament_type text NOT NULL DEFAULT 'single_stage',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_slug text,
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS champion_player_id uuid,
  ADD COLUMN IF NOT EXISTS created_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS finished_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS livestream_provider text,
  ADD COLUMN IF NOT EXISTS livestream_url text,
  ADD COLUMN IF NOT EXISTS livestream_embed_url text,
  ADD COLUMN IF NOT EXISTS livestream_enabled boolean NOT NULL DEFAULT false;

-- copiar name -> title se title estiver vazio
UPDATE public.tournaments
SET title = name
WHERE title IS NULL AND name IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournaments_public_slug
  ON public.tournaments(public_slug)
  WHERE public_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tournaments_account_id
  ON public.tournaments(account_id);

CREATE INDEX IF NOT EXISTS idx_tournaments_status
  ON public.tournaments(status);

CREATE INDEX IF NOT EXISTS idx_tournaments_mode
  ON public.tournaments(mode);

-- =========================================================
-- 2) JOGADORES DO TORNEIO
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tournament_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id integer NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  account_id uuid,
  name text NOT NULL,
  email text,
  team_name text,
  seed integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_players_tournament_id
  ON public.tournament_players(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_players_account_id
  ON public.tournament_players(account_id);

CREATE INDEX IF NOT EXISTS idx_tournament_players_seed
  ON public.tournament_players(tournament_id, seed);

-- =========================================================
-- 3) FASES DO TORNEIO
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tournament_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id integer NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  stage_code text,
  stage_order integer NOT NULL,
  format text NOT NULL, -- single_elimination, double_elimination, groups
  progression_type text NOT NULL DEFAULT 'determine_champion', -- determine_champion, qualify_players
  competition_goal text NOT NULL DEFAULT 'determine_champion', -- determine_champion, qualify_top_2, qualify_top_n
  qualified_count integer,
  next_stage_id uuid NULL,
  status text NOT NULL DEFAULT 'draft', -- draft, active, finished, archived
  endgame_mode text NOT NULL DEFAULT 'standard', -- standard, draw_when_three_remain
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_tournament_stages_order UNIQUE (tournament_id, stage_order)
);

CREATE INDEX IF NOT EXISTS idx_tournament_stages_tournament_id
  ON public.tournament_stages(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_stages_stage_code
  ON public.tournament_stages(stage_code);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_stages_code_per_tournament
  ON public.tournament_stages(tournament_id, stage_code)
  WHERE stage_code IS NOT NULL;

-- adiciona FK next_stage_id depois da criação da tabela
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tournament_stages_next_stage'
      AND table_name = 'tournament_stages'
  ) THEN
    ALTER TABLE public.tournament_stages
      ADD CONSTRAINT fk_tournament_stages_next_stage
      FOREIGN KEY (next_stage_id)
      REFERENCES public.tournament_stages(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- =========================================================
-- 4) JOGADORES POR FASE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.stage_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  seed integer,
  source_stage_id uuid NULL REFERENCES public.tournament_stages(id) ON DELETE SET NULL,
  source_position integer,
  qualified_from_previous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stage_players UNIQUE (stage_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_players_stage_id
  ON public.stage_players(stage_id);

CREATE INDEX IF NOT EXISTS idx_stage_players_player_id
  ON public.stage_players(player_id);

CREATE INDEX IF NOT EXISTS idx_stage_players_seed
  ON public.stage_players(stage_id, seed);

-- =========================================================
-- 5) PARTIDAS DO TORNEIO / FASE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tournament_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid,
  tournament_id integer NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  stage_id uuid NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,

  round_number integer NOT NULL,
  match_number integer NOT NULL,

  bracket_type text NOT NULL DEFAULT 'main', -- main, winners, losers, final
  match_role text NOT NULL DEFAULT 'standard', -- standard, winners_final, losers_round, qualification_match, grand_final, reset_final, special_semi, special_final
  stage text NOT NULL DEFAULT 'main', -- main, winners_final, losers_final, grand_final, grand_final_reset

  player1_id uuid NULL REFERENCES public.tournament_players(id) ON DELETE SET NULL,
  player2_id uuid NULL REFERENCES public.tournament_players(id) ON DELETE SET NULL,
  winner_player_id uuid NULL REFERENCES public.tournament_players(id) ON DELETE SET NULL,

  player1_score integer NOT NULL DEFAULT 0,
  player2_score integer NOT NULL DEFAULT 0,

  result_type text NOT NULL DEFAULT 'normal', -- normal, bye, wo
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  next_match_id uuid NULL,
  next_match_slot integer NULL,
  loser_next_match_id uuid NULL,
  loser_next_match_slot integer NULL,

  status text NOT NULL DEFAULT 'pending', -- pending, ready, finished, cancelled
  finished_at timestamptz,
  finished_by_user_id uuid,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT uq_tournament_matches_round_match UNIQUE (stage_id, round_number, match_number)
);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id
  ON public.tournament_matches(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_stage_id
  ON public.tournament_matches(stage_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_status
  ON public.tournament_matches(status);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_round
  ON public.tournament_matches(stage_id, round_number, match_number);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_next_match_id
  ON public.tournament_matches(next_match_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_loser_next_match_id
  ON public.tournament_matches(loser_next_match_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tournament_matches_next_match'
      AND table_name = 'tournament_matches'
  ) THEN
    ALTER TABLE public.tournament_matches
      ADD CONSTRAINT fk_tournament_matches_next_match
      FOREIGN KEY (next_match_id)
      REFERENCES public.tournament_matches(id)
      ON DELETE SET NULL;
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_tournament_matches_loser_next_match'
      AND table_name = 'tournament_matches'
  ) THEN
    ALTER TABLE public.tournament_matches
      ADD CONSTRAINT fk_tournament_matches_loser_next_match
      FOREIGN KEY (loser_next_match_id)
      REFERENCES public.tournament_matches(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- =========================================================
-- 6) RANKING FINAL DA FASE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.stage_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  final_position integer NOT NULL,
  qualified boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stage_rankings_player UNIQUE (stage_id, player_id),
  CONSTRAINT uq_stage_rankings_position UNIQUE (stage_id, final_position)
);

CREATE INDEX IF NOT EXISTS idx_stage_rankings_stage_id
  ON public.stage_rankings(stage_id);

CREATE INDEX IF NOT EXISTS idx_stage_rankings_player_id
  ON public.stage_rankings(player_id);

-- =========================================================
-- 7) STATUS DO JOGADOR NA FASE
-- =========================================================

CREATE TABLE IF NOT EXISTS public.stage_player_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.tournament_players(id) ON DELETE CASCADE,
  losses integer NOT NULL DEFAULT 0,
  eliminated boolean NOT NULL DEFAULT false,
  elimination_position integer,
  qualified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stage_player_status UNIQUE (stage_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_player_status_stage_id
  ON public.stage_player_status(stage_id);

CREATE INDEX IF NOT EXISTS idx_stage_player_status_player_id
  ON public.stage_player_status(player_id);

CREATE INDEX IF NOT EXISTS idx_stage_player_status_alive
  ON public.stage_player_status(stage_id, eliminated, qualified);

-- =========================================================
-- 8) REGRAS DE PROGRESSÃO ENTRE FASES
-- =========================================================

CREATE TABLE IF NOT EXISTS public.stage_progression_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  to_stage_id uuid NOT NULL REFERENCES public.tournament_stages(id) ON DELETE CASCADE,
  target_seed integer NOT NULL,
  from_stage_code text NOT NULL,
  from_position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_stage_progression_target_seed UNIQUE (to_stage_id, target_seed),
  CONSTRAINT uq_stage_progression_from_code_pos UNIQUE (to_stage_id, from_stage_code, from_position)
);

CREATE INDEX IF NOT EXISTS idx_stage_progression_rules_to_stage_id
  ON public.stage_progression_rules(to_stage_id);

-- =========================================================
-- 9) TEMPLATES CUSTOMIZADOS DA CONTA
-- =========================================================

CREATE TABLE IF NOT EXISTS public.account_tournament_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  base_template_code text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_by_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_account_tournament_templates_account_id
  ON public.account_tournament_templates(account_id);

CREATE INDEX IF NOT EXISTS idx_account_tournament_templates_active
  ON public.account_tournament_templates(account_id, is_active);

-- =========================================================
-- 10) TEMPLATES GLOBAIS DE TORNEIO
-- =========================================================

CREATE TABLE IF NOT EXISTS public.tournament_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  category text NOT NULL,
  description text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- =========================================================
-- 11) TRIGGERS AUTOMÁTICOS updated_at
-- =========================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tournaments_updated_at') THEN
    CREATE TRIGGER trg_tournaments_updated_at
    BEFORE UPDATE ON public.tournaments
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tournament_players_updated_at') THEN
    CREATE TRIGGER trg_tournament_players_updated_at
    BEFORE UPDATE ON public.tournament_players
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tournament_stages_updated_at') THEN
    CREATE TRIGGER trg_tournament_stages_updated_at
    BEFORE UPDATE ON public.tournament_stages
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stage_players_updated_at') THEN
    CREATE TRIGGER trg_stage_players_updated_at
    BEFORE UPDATE ON public.stage_players
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tournament_matches_updated_at') THEN
    CREATE TRIGGER trg_tournament_matches_updated_at
    BEFORE UPDATE ON public.tournament_matches
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stage_rankings_updated_at') THEN
    CREATE TRIGGER trg_stage_rankings_updated_at
    BEFORE UPDATE ON public.stage_rankings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stage_player_status_updated_at') THEN
    CREATE TRIGGER trg_stage_player_status_updated_at
    BEFORE UPDATE ON public.stage_player_status
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_stage_progression_rules_updated_at') THEN
    CREATE TRIGGER trg_stage_progression_rules_updated_at
    BEFORE UPDATE ON public.stage_progression_rules
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_account_tournament_templates_updated_at') THEN
    CREATE TRIGGER trg_account_tournament_templates_updated_at
    BEFORE UPDATE ON public.account_tournament_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_tournament_templates_updated_at') THEN
    CREATE TRIGGER trg_tournament_templates_updated_at
    BEFORE UPDATE ON public.tournament_templates
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END$$;

COMMIT;
