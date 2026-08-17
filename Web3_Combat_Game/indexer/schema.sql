-- ============================================================
-- Schéma de persistance de l'indexeur blockchain (APP2)
-- Tables requises par le module d'indexation robuste & idempotent.
--
-- 1. blockchain_sync_states      : état de synchronisation par contrat
-- 2. processed_blockchain_events  : anti-doublons strict (tx_hash, log_index)
--
-- Ces tables sont créées automatiquement au démarrage de l'indexer
-- (initSchema dans db.js) via CREATE TABLE IF NOT EXISTS. Ce fichier
-- sert de référence / migration manuelle si besoin.
-- ============================================================

-- ------------------------------------------------------------
-- 1. État de synchronisation (Block Tracker)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `blockchain_sync_states` (
    `contract_address`     VARCHAR(42)  NOT NULL COMMENT 'Adresse du contrat (0x..., lowercase)',
    `last_processed_block` BIGINT UNSIGNED NOT NULL DEFAULT 0 COMMENT 'Dernier bloc traité (inclus)',
    `updated_at`           TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
                                       ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`contract_address`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ------------------------------------------------------------
-- 2. Anti-doublons strict (idempotence)
--    Clé unique composite (tx_hash, log_index) : un log ne peut
--    être traité qu'une seule fois, même en cas de re-polling
--    ou de reorg partiel.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `processed_blockchain_events` (
    `id`           BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    `tx_hash`      VARCHAR(66)  NOT NULL COMMENT 'Hash de transaction (0x...)',
    `log_index`    INT UNSIGNED NOT NULL COMMENT 'Index du log dans la transaction',
    `event_name`   VARCHAR(128) NOT NULL COMMENT 'Nom de l''événement (ex: PoolClaimed)',
    `block_number` BIGINT UNSIGNED NOT NULL COMMENT 'Bloc contenant le log',
    `status`       ENUM('pending','processed') NOT NULL DEFAULT 'pending'
                   COMMENT 'pending = claimé mais handler non terminé (crash-safe)',
    `created_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at`   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                   ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uq_tx_log` (`tx_hash`, `log_index`),
    KEY `idx_block_number` (`block_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
