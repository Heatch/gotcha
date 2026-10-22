-- MySQL 8.4 LTS / InnoDB. Apply once to an approved, empty database.
-- DDL commits implicitly. No CREATE DATABASE, deployment or cleanup scheduler.
SET time_zone = '+00:00';

CREATE TABLE mission_packs (
    id BINARY(16) NOT NULL,
    kind ENUM('builtin', 'game_draft', 'private_saved') NOT NULL,
    catalog_key VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
    title VARCHAR(120) NOT NULL,
    description VARCHAR(2000) NOT NULL DEFAULT '',
    ownership_secret_hash BINARY(32) NULL,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_pack_catalog (catalog_key),
    UNIQUE KEY uq_pack_secret (ownership_secret_hash),
    CONSTRAINT ck_pack_title CHECK (CHAR_LENGTH(TRIM(title)) > 0),
    CONSTRAINT ck_pack_revision CHECK (revision >= 1),
    CONSTRAINT ck_pack_ownership CHECK (
        (kind = 'builtin' AND catalog_key IS NOT NULL AND ownership_secret_hash IS NULL)
        OR (kind = 'game_draft' AND catalog_key IS NULL AND ownership_secret_hash IS NULL)
        OR (kind = 'private_saved' AND catalog_key IS NULL AND ownership_secret_hash IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE missions (
    id BINARY(16) NOT NULL,
    pack_id BINARY(16) NOT NULL,
    position INT UNSIGNED NOT NULL,
    mission_text VARCHAR(1000) NOT NULL,
    allows_group BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_mission_position (pack_id, position),
    CONSTRAINT fk_mission_pack FOREIGN KEY (pack_id) REFERENCES mission_packs (id),
    CONSTRAINT ck_mission_position CHECK (position >= 1),
    CONSTRAINT ck_mission_text CHECK (CHAR_LENGTH(TRIM(mission_text)) > 0),
    CONSTRAINT ck_mission_group CHECK (allows_group IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE games (
    id BINARY(16) NOT NULL,
    join_code VARCHAR(12) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    draft_pack_id BINARY(16) NOT NULL,
    state ENUM('lobby', 'active', 'ended') NOT NULL DEFAULT 'lobby',
    frozen_pack_title VARCHAR(120) NULL,
    frozen_pack_description VARCHAR(2000) NULL,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    started_at DATETIME(3) NULL,
    scheduled_end_at DATETIME(3) NULL,
    ended_at DATETIME(3) NULL,
    end_reason ENUM('host', 'time_limit', 'score_target') NULL,
    last_activity_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    expires_at DATETIME(3) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_game_code (join_code),
    UNIQUE KEY uq_game_draft (draft_pack_id),
    KEY ix_game_expiry (state, expires_at, id),
    KEY ix_game_scheduled_end (state, scheduled_end_at, id),
    CONSTRAINT fk_game_draft FOREIGN KEY (draft_pack_id) REFERENCES mission_packs (id),
    CONSTRAINT ck_game_code CHECK (CHAR_LENGTH(join_code) BETWEEN 8 AND 12),
    CONSTRAINT ck_game_revision CHECK (revision >= 1),
    CONSTRAINT ck_game_lifecycle CHECK (
        (state = 'lobby' AND started_at IS NULL AND ended_at IS NULL AND end_reason IS NULL
            AND scheduled_end_at IS NULL
            AND frozen_pack_title IS NULL AND frozen_pack_description IS NULL)
        OR (state = 'active' AND started_at IS NOT NULL AND ended_at IS NULL AND end_reason IS NULL
            AND frozen_pack_title IS NOT NULL AND frozen_pack_description IS NOT NULL)
        OR (state = 'ended' AND started_at IS NOT NULL AND ended_at IS NOT NULL AND end_reason IS NOT NULL
            AND frozen_pack_title IS NOT NULL AND frozen_pack_description IS NOT NULL)
    ),
    CONSTRAINT ck_game_time_limit_end CHECK (
        end_reason IS NULL OR end_reason <> 'time_limit' OR scheduled_end_at IS NOT NULL
    ),
    CONSTRAINT ck_game_schedule CHECK (scheduled_end_at IS NULL OR scheduled_end_at > started_at),
    CONSTRAINT ck_game_start_time CHECK (started_at IS NULL OR started_at >= created_at),
    CONSTRAINT ck_game_end_time CHECK (ended_at IS NULL OR ended_at >= started_at),
    CONSTRAINT ck_game_activity CHECK (last_activity_at >= created_at),
    CONSTRAINT ck_game_expiry CHECK (expires_at > last_activity_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

-- Host-chosen rules, one row per game. Defaults reproduce the original fixed rules.
CREATE TABLE game_settings (
    game_id BINARY(16) NOT NULL,
    slot_count TINYINT UNSIGNED NOT NULL DEFAULT 5,
    offer_size TINYINT UNSIGNED NOT NULL DEFAULT 2,
    rerolls_per_player TINYINT UNSIGNED NOT NULL DEFAULT 0,
    cooldown_base_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    cooldown_scaling ENUM('fixed', 'multiply', 'add') NOT NULL DEFAULT 'multiply',
    cooldown_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.00,
    cooldown_step_minutes SMALLINT UNSIGNED NOT NULL DEFAULT 5,
    cooldown_cap_minutes SMALLINT UNSIGNED NULL DEFAULT 360,
    cooldown_counts_failures BOOLEAN NOT NULL DEFAULT TRUE,
    target_rule ENUM('cycle_all', 'distinct_blocks', 'distinct_sliding', 'unrestricted') NOT NULL DEFAULT 'cycle_all',
    target_distinct_count TINYINT UNSIGNED NULL,
    failure_points TINYINT NOT NULL DEFAULT 0,
    allow_negative_score BOOLEAN NOT NULL DEFAULT FALSE,
    time_limit_minutes INT UNSIGNED NULL,
    win_score_target SMALLINT UNSIGNED NULL,
    win_ends_game BOOLEAN NOT NULL DEFAULT TRUE,
    leaderboard_mode ENUM('off', 'anonymous', 'nicknames') NOT NULL DEFAULT 'anonymous',
    chat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    result_posts ENUM('full', 'generic', 'off') NOT NULL DEFAULT 'full',
    result_names_when_board_off ENUM('alias', 'nickname') NOT NULL DEFAULT 'alias',
    allow_late_join BOOLEAN NOT NULL DEFAULT TRUE,
    max_players SMALLINT UNSIGNED NULL,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (game_id),
    CONSTRAINT fk_settings_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT ck_settings_wallet CHECK (
        slot_count BETWEEN 1 AND 10 AND offer_size BETWEEN 1 AND 3
        AND rerolls_per_player BETWEEN 0 AND 10
    ),
    CONSTRAINT ck_settings_cooldown CHECK (
        cooldown_base_minutes <= 1440
        AND cooldown_multiplier BETWEEN 1.10 AND 5.00
        AND cooldown_step_minutes BETWEEN 1 AND 1440
        AND (cooldown_cap_minutes IS NULL OR cooldown_cap_minutes BETWEEN 1 AND 10080)
    ),
    CONSTRAINT ck_settings_targets CHECK (
        (target_rule IN ('cycle_all', 'unrestricted') AND target_distinct_count IS NULL)
        OR (target_rule IN ('distinct_blocks', 'distinct_sliding')
            AND target_distinct_count IS NOT NULL AND target_distinct_count BETWEEN 1 AND 99)
    ),
    CONSTRAINT ck_settings_scoring CHECK (failure_points IN (0, -1)),
    CONSTRAINT ck_settings_ending CHECK (
        (time_limit_minutes IS NULL OR time_limit_minutes BETWEEN 10 AND 43200)
        AND (win_score_target IS NULL OR win_score_target BETWEEN 1 AND 999)
    ),
    CONSTRAINT ck_settings_joining CHECK (max_players IS NULL OR max_players BETWEEN 2 AND 200),
    CONSTRAINT ck_settings_flags CHECK (
        cooldown_counts_failures IN (0, 1) AND allow_negative_score IN (0, 1)
        AND win_ends_game IN (0, 1) AND chat_enabled IN (0, 1) AND allow_late_join IN (0, 1)
    ),
    CONSTRAINT ck_settings_revision CHECK (revision >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE game_players (
    id BINARY(16) NOT NULL,
    game_id BINARY(16) NOT NULL,
    nickname VARCHAR(32) COLLATE utf8mb4_0900_as_ci NOT NULL,
    nickname_key VARCHAR(32) COLLATE utf8mb4_0900_as_ci
        GENERATED ALWAYS AS (LOWER(TRIM(nickname))) STORED,
    leaderboard_alias VARCHAR(48) COLLATE utf8mb4_0900_as_ci NOT NULL,
    membership_secret_hash BINARY(32) NOT NULL,
    role ENUM('host', 'player') NOT NULL DEFAULT 'player',
    host_game_id BINARY(16)
        GENERATED ALWAYS AS (CASE WHEN role = 'host' THEN game_id ELSE NULL END) STORED,
    selection_complete BOOLEAN NOT NULL DEFAULT FALSE,
    cooldown_level BIGINT UNSIGNED NOT NULL DEFAULT 0,
    score INT NOT NULL DEFAULT 0,
    rerolls_used TINYINT UNSIGNED NOT NULL DEFAULT 0,
    score_target_reached_at DATETIME(3) NULL,
    target_cycle BIGINT UNSIGNED NOT NULL DEFAULT 1,
    joined_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_player_scope (game_id, id),
    UNIQUE KEY uq_player_nickname (game_id, nickname_key),
    UNIQUE KEY uq_player_alias (game_id, leaderboard_alias),
    UNIQUE KEY uq_player_secret (membership_secret_hash),
    UNIQUE KEY uq_game_host (host_game_id),
    KEY ix_player_score (game_id, score),
    CONSTRAINT fk_player_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT ck_player_nickname CHECK (
        CHAR_LENGTH(TRIM(nickname)) > 0
        AND OCTET_LENGTH(nickname) = OCTET_LENGTH(TRIM(nickname))
    ),
    CONSTRAINT ck_player_alias CHECK (CHAR_LENGTH(TRIM(leaderboard_alias)) > 0),
    CONSTRAINT ck_player_selection CHECK (selection_complete IN (0, 1)),
    CONSTRAINT ck_player_cycle CHECK (target_cycle >= 1),
    CONSTRAINT ck_player_rerolls CHECK (rerolls_used <= 10),
    CONSTRAINT ck_player_target_time CHECK (
        score_target_reached_at IS NULL OR score_target_reached_at >= joined_at
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE game_missions (
    id BINARY(16) NOT NULL,
    game_id BINARY(16) NOT NULL,
    position INT UNSIGNED NOT NULL,
    mission_text VARCHAR(1000) NOT NULL,
    allows_group BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (id),
    UNIQUE KEY uq_game_mission_scope (game_id, id),
    UNIQUE KEY uq_game_mission_position (game_id, position),
    CONSTRAINT fk_game_mission_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT ck_game_mission_position CHECK (position >= 1),
    CONSTRAINT ck_game_mission_text CHECK (CHAR_LENGTH(TRIM(mission_text)) > 0),
    CONSTRAINT ck_game_mission_group CHECK (allows_group IN (0, 1))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE player_slots (
    game_id BINARY(16) NOT NULL,
    player_id BINARY(16) NOT NULL,
    slot_number TINYINT UNSIGNED NOT NULL,
    cooldown_until DATETIME(3) NULL,
    PRIMARY KEY (game_id, player_id, slot_number),
    CONSTRAINT fk_slot_player FOREIGN KEY (game_id, player_id)
        REFERENCES game_players (game_id, id),
    CONSTRAINT ck_slot_number CHECK (slot_number BETWEEN 1 AND 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE mission_assignments (
    id BINARY(16) NOT NULL,
    game_id BINARY(16) NOT NULL,
    game_mission_id BINARY(16) NOT NULL,
    player_id BINARY(16) NOT NULL,
    slot_number TINYINT UNSIGNED NOT NULL,
    status ENUM('open', 'completed', 'failed') NOT NULL DEFAULT 'open',
    open_slot_number TINYINT UNSIGNED
        GENERATED ALWAYS AS (CASE WHEN status = 'open' THEN slot_number ELSE NULL END) STORED,
    assigned_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    resolved_at DATETIME(3) NULL,
    target_kind ENUM('player', 'group') NULL,
    target_player_id BINARY(16) NULL,
    target_cycle BIGINT UNSIGNED NULL,
    comments VARCHAR(2000) NOT NULL DEFAULT '',
    PRIMARY KEY (id),
    UNIQUE KEY uq_assignment_scope (game_id, id),
    UNIQUE KEY uq_assignment_slot_scope (game_id, id, player_id, slot_number),
    UNIQUE KEY uq_assignment_target_scope (game_id, id, player_id, target_player_id, target_cycle),
    UNIQUE KEY uq_assignment_claim (game_id, game_mission_id),
    UNIQUE KEY uq_assignment_open_slot (game_id, player_id, open_slot_number),
    KEY ix_assignment_history (game_id, player_id, status, resolved_at, id),
    KEY ix_assignment_slot (game_id, player_id, slot_number),
    KEY ix_assignment_target (game_id, target_player_id),
    CONSTRAINT fk_assignment_mission FOREIGN KEY (game_id, game_mission_id)
        REFERENCES game_missions (game_id, id),
    CONSTRAINT fk_assignment_slot FOREIGN KEY (game_id, player_id, slot_number)
        REFERENCES player_slots (game_id, player_id, slot_number),
    CONSTRAINT fk_assignment_target FOREIGN KEY (game_id, target_player_id)
        REFERENCES game_players (game_id, id),
    CONSTRAINT ck_assignment_resolution CHECK (
        (status = 'open' AND resolved_at IS NULL AND target_kind IS NULL
            AND target_player_id IS NULL AND target_cycle IS NULL AND comments = '')
        OR (status = 'failed' AND resolved_at IS NOT NULL AND target_kind IS NULL
            AND target_player_id IS NULL AND target_cycle IS NULL AND comments = '')
        OR (status = 'completed' AND resolved_at IS NOT NULL AND target_kind IS NOT NULL
            AND (
                (target_kind = 'group' AND target_player_id IS NULL AND target_cycle IS NULL)
                OR (target_kind = 'player' AND target_player_id IS NOT NULL
                    AND target_cycle IS NOT NULL AND target_cycle >= 1
                    AND target_player_id <> player_id)
            ))
    ),
    CONSTRAINT ck_assignment_time CHECK (resolved_at IS NULL OR resolved_at >= assigned_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE selection_offers (
    id BINARY(16) NOT NULL,
    game_id BINARY(16) NOT NULL,
    player_id BINARY(16) NOT NULL,
    slot_number TINYINT UNSIGNED NOT NULL,
    phase ENUM('initial', 'refill') NOT NULL,
    state ENUM('current', 'consumed', 'superseded', 'rerolled') NOT NULL DEFAULT 'current',
    current_player_id BINARY(16)
        GENERATED ALWAYS AS (CASE WHEN state = 'current' THEN player_id ELSE NULL END) STORED,
    revision BIGINT UNSIGNED NOT NULL DEFAULT 1,
    consumed_assignment_id BINARY(16) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    closed_at DATETIME(3) NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uq_offer_scope (game_id, id),
    UNIQUE KEY uq_offer_current (game_id, current_player_id),
    KEY ix_offer_slot (game_id, player_id, slot_number),
    KEY ix_offer_assignment (game_id, consumed_assignment_id, player_id, slot_number),
    CONSTRAINT fk_offer_slot FOREIGN KEY (game_id, player_id, slot_number)
        REFERENCES player_slots (game_id, player_id, slot_number),
    CONSTRAINT fk_offer_assignment FOREIGN KEY (game_id, consumed_assignment_id, player_id, slot_number)
        REFERENCES mission_assignments (game_id, id, player_id, slot_number),
    CONSTRAINT ck_offer_revision CHECK (revision >= 1),
    CONSTRAINT ck_offer_state CHECK (
        (state = 'current' AND consumed_assignment_id IS NULL AND closed_at IS NULL)
        OR (state = 'consumed' AND consumed_assignment_id IS NOT NULL AND closed_at IS NOT NULL)
        OR (state IN ('superseded', 'rerolled') AND consumed_assignment_id IS NULL AND closed_at IS NOT NULL)
    ),
    CONSTRAINT ck_offer_time CHECK (closed_at IS NULL OR closed_at >= created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE selection_offer_items (
    game_id BINARY(16) NOT NULL,
    offer_id BINARY(16) NOT NULL,
    position TINYINT UNSIGNED NOT NULL,
    game_mission_id BINARY(16) NOT NULL,
    PRIMARY KEY (game_id, offer_id, position),
    UNIQUE KEY uq_offer_candidate (game_id, offer_id, game_mission_id),
    KEY ix_offer_item_mission (game_id, game_mission_id),
    CONSTRAINT fk_offer_item_offer FOREIGN KEY (game_id, offer_id)
        REFERENCES selection_offers (game_id, id),
    CONSTRAINT fk_offer_item_mission FOREIGN KEY (game_id, game_mission_id)
        REFERENCES game_missions (game_id, id),
    CONSTRAINT ck_offer_item_position CHECK (position BETWEEN 1 AND 3)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE player_target_hits (
    game_id BINARY(16) NOT NULL,
    actor_player_id BINARY(16) NOT NULL,
    target_player_id BINARY(16) NOT NULL,
    cycle_number BIGINT UNSIGNED NOT NULL,
    assignment_id BINARY(16) NOT NULL,
    PRIMARY KEY (game_id, actor_player_id, target_player_id, cycle_number),
    UNIQUE KEY uq_target_hit_assignment (game_id, assignment_id),
    KEY ix_hit_cycle (game_id, actor_player_id, cycle_number, target_player_id),
    KEY ix_hit_assignment_scope (game_id, assignment_id, actor_player_id, target_player_id, cycle_number),
    KEY ix_hit_target (game_id, target_player_id),
    CONSTRAINT fk_hit_actor FOREIGN KEY (game_id, actor_player_id)
        REFERENCES game_players (game_id, id),
    CONSTRAINT fk_hit_target FOREIGN KEY (game_id, target_player_id)
        REFERENCES game_players (game_id, id),
    CONSTRAINT fk_hit_assignment FOREIGN KEY (game_id, assignment_id, actor_player_id, target_player_id, cycle_number)
        REFERENCES mission_assignments (game_id, id, player_id, target_player_id, target_cycle),
    CONSTRAINT ck_hit_players CHECK (actor_player_id <> target_player_id),
    CONSTRAINT ck_hit_cycle CHECK (cycle_number >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE game_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    game_id BINARY(16) NOT NULL,
    sender_player_id BINARY(16) NULL,
    kind ENUM('chat', 'mission_completed', 'mission_failed', 'settings_changed') NOT NULL,
    message_text VARCHAR(2000) NULL,
    assignment_id BINARY(16) NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    UNIQUE KEY uq_message_result (game_id, assignment_id),
    KEY ix_message_cursor (game_id, id),
    KEY ix_message_sender (game_id, sender_player_id),
    CONSTRAINT fk_message_game FOREIGN KEY (game_id) REFERENCES games (id),
    CONSTRAINT fk_message_sender FOREIGN KEY (game_id, sender_player_id)
        REFERENCES game_players (game_id, id),
    CONSTRAINT fk_message_assignment FOREIGN KEY (game_id, assignment_id)
        REFERENCES mission_assignments (game_id, id),
    CONSTRAINT ck_message_kind CHECK (
        (kind = 'chat' AND sender_player_id IS NOT NULL AND assignment_id IS NULL
            AND message_text IS NOT NULL AND CHAR_LENGTH(TRIM(message_text)) > 0)
        OR (kind = 'settings_changed' AND sender_player_id IS NULL AND assignment_id IS NULL
            AND message_text IS NOT NULL AND CHAR_LENGTH(TRIM(message_text)) > 0)
        OR (kind IN ('mission_completed', 'mission_failed')
            AND sender_player_id IS NULL AND assignment_id IS NOT NULL AND message_text IS NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;

CREATE TABLE mutation_receipts (
    game_id BINARY(16) NOT NULL,
    player_id BINARY(16) NOT NULL,
    request_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    action ENUM('claim', 'resolve', 'reroll', 'update_settings', 'save_pack') NOT NULL,
    request_fingerprint BINARY(32) NOT NULL,
    result_resource_id BINARY(16) NOT NULL,
    result_revision BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (game_id, player_id, request_id),
    CONSTRAINT fk_receipt_player FOREIGN KEY (game_id, player_id)
        REFERENCES game_players (game_id, id),
    CONSTRAINT ck_receipt_request CHECK (CHAR_LENGTH(TRIM(request_id)) > 0),
    CONSTRAINT ck_receipt_revision CHECK (result_revision >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_as_cs;
