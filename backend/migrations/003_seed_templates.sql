BEGIN;

insert into public.tournament_templates (code, name, category, description, config, is_active)
values
(
  'knockout_16',
  'Mata-mata 16',
  'knockout',
  'Mata-mata direto com 16 jogadores.',
  '{
    "template_type": "knockout",
    "total_players": 16,
    "stages": [
      {
        "name": "Mata-mata 16",
        "stage_code": "MAIN",
        "format": "single_elimination",
        "progression_type": "determine_champion",
        "competition_goal": "determine_champion",
        "endgame_mode": "standard"
      }
    ],
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'knockout_32',
  'Mata-mata 32',
  'knockout',
  'Mata-mata direto com 32 jogadores.',
  '{
    "template_type": "knockout",
    "total_players": 32,
    "stages": [
      {
        "name": "Mata-mata 32",
        "stage_code": "MAIN",
        "format": "single_elimination",
        "progression_type": "determine_champion",
        "competition_goal": "determine_champion",
        "endgame_mode": "standard"
      }
    ],
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'knockout_64',
  'Mata-mata 64',
  'knockout',
  'Mata-mata direto com 64 jogadores.',
  '{
    "template_type": "knockout",
    "total_players": 64,
    "stages": [
      {
        "name": "Mata-mata 64",
        "stage_code": "MAIN",
        "format": "single_elimination",
        "progression_type": "determine_champion",
        "competition_goal": "determine_champion",
        "endgame_mode": "standard"
      }
    ],
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'knockout_128',
  'Mata-mata 128',
  'knockout',
  'Mata-mata direto com 128 jogadores.',
  '{
    "template_type": "knockout",
    "total_players": 128,
    "stages": [
      {
        "name": "Mata-mata 128",
        "stage_code": "MAIN",
        "format": "single_elimination",
        "progression_type": "determine_champion",
        "competition_goal": "determine_champion",
        "endgame_mode": "standard"
      }
    ],
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'knockout_48_open',
  'Mata-mata 48 · aberto',
  'knockout',
  'Estrutura inicial para 48 jogadores com fechamento configurável.',
  '{
    "template_type": "knockout_open",
    "total_players": 48,
    "stages": [
      {
        "name": "Mata-mata 48",
        "stage_code": "MAIN",
        "format": "single_elimination",
        "progression_type": "determine_champion",
        "competition_goal": "determine_champion",
        "endgame_mode": "standard"
      }
    ],
    "options": {
      "allow_bye": true,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'knockout_96_open',
  'Mata-mata 96 · aberto',
  'knockout',
  'Estrutura inicial para 96 jogadores com fechamento configurável.',
  '{
    "template_type": "knockout_open",
    "total_players": 96,
    "stages": [
      {
        "name": "Mata-mata 96",
        "stage_code": "MAIN",
        "format": "single_elimination",
        "progression_type": "determine_champion",
        "competition_goal": "determine_champion",
        "endgame_mode": "standard"
      }
    ],
    "options": {
      "allow_bye": true,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'mixed_16_4x4_to_8',
  '16 jogadores · 4 chaves de 4 · final 8',
  'mixed',
  '4 chaves classificatórias de 4, classificando 2 por chave para final 8.',
  '{
    "template_type": "mixed",
    "total_players": 16,
    "classification": {
      "format": "double_elimination",
      "group_count": 4,
      "players_per_group": 4,
      "competition_goal": "qualify_top_2",
      "qualified_per_group": 2
    },
    "playoff": {
      "format": "single_elimination",
      "target_size": 8,
      "cross_rule": "group_1_vs_group_last",
      "endgame_mode": "standard"
    },
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'mixed_32_8x4_to_16',
  '32 jogadores · 8 chaves de 4 · final 16',
  'mixed',
  '8 chaves classificatórias de 4, classificando 2 por chave para final 16.',
  '{
    "template_type": "mixed",
    "total_players": 32,
    "classification": {
      "format": "double_elimination",
      "group_count": 8,
      "players_per_group": 4,
      "competition_goal": "qualify_top_2",
      "qualified_per_group": 2
    },
    "playoff": {
      "format": "single_elimination",
      "target_size": 16,
      "cross_rule": "group_1_vs_group_last",
      "endgame_mode": "standard"
    },
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'mixed_64_16x4_to_32',
  '64 jogadores · 16 chaves de 4 · final 32',
  'mixed',
  '16 chaves classificatórias de 4, classificando 2 por chave para final 32.',
  '{
    "template_type": "mixed",
    "total_players": 64,
    "classification": {
      "format": "double_elimination",
      "group_count": 16,
      "players_per_group": 4,
      "competition_goal": "qualify_top_2",
      "qualified_per_group": 2
    },
    "playoff": {
      "format": "single_elimination",
      "target_size": 32,
      "cross_rule": "group_1_vs_group_last",
      "endgame_mode": "standard"
    },
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'mixed_128_32x4_to_64',
  '128 jogadores · 32 chaves de 4 · final 64',
  'mixed',
  '32 chaves classificatórias de 4, classificando 2 por chave para final 64.',
  '{
    "template_type": "mixed",
    "total_players": 128,
    "classification": {
      "format": "double_elimination",
      "group_count": 32,
      "players_per_group": 4,
      "competition_goal": "qualify_top_2",
      "qualified_per_group": 2
    },
    "playoff": {
      "format": "single_elimination",
      "target_size": 64,
      "cross_rule": "group_1_vs_group_last",
      "endgame_mode": "standard"
    },
    "options": {
      "allow_bye": false,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'mixed_48_open',
  '48 jogadores · template aberto',
  'mixed',
  '12 chaves de 4 e fase final configurável posteriormente.',
  '{
    "template_type": "mixed_open",
    "total_players": 48,
    "classification": {
      "format_options": ["double_elimination", "groups"],
      "default_format": "double_elimination",
      "group_count": 12,
      "players_per_group": 4,
      "competition_goal": "qualify_top_2",
      "qualified_per_group": 2
    },
    "playoff": {
      "format": "single_elimination",
      "target_size_options": [24, 32],
      "default_target_size": 24,
      "cross_rule": "group_1_vs_group_last",
      "requires_manual_finish_definition": true
    },
    "options": {
      "allow_bye": true,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
),
(
  'mixed_96_open',
  '96 jogadores · template aberto',
  'mixed',
  '24 chaves de 4 e fase final configurável posteriormente.',
  '{
    "template_type": "mixed_open",
    "total_players": 96,
    "classification": {
      "format_options": ["double_elimination", "groups"],
      "default_format": "double_elimination",
      "group_count": 24,
      "players_per_group": 4,
      "competition_goal": "qualify_top_2",
      "qualified_per_group": 2
    },
    "playoff": {
      "format": "single_elimination",
      "target_size_options": [48, 64],
      "default_target_size": 48,
      "cross_rule": "group_1_vs_group_last",
      "requires_manual_finish_definition": true
    },
    "options": {
      "allow_bye": true,
      "allow_wo": true,
      "auto_seed": true,
      "public_page": true,
      "livestream_enabled": true,
      "livestream_provider": "youtube"
    }
  }'::jsonb,
  true
)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  config = excluded.config,
  is_active = excluded.is_active,
  updated_at = now();

COMMIT;
