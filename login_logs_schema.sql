-- ============================================================================
-- Panchved / Ocayur - Doctor & Patient Login Timings Audit Schema
-- Database: jewrzsmy_panchved
-- ============================================================================

-- 1. Create `login_logs` table to record all login events and timings
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `user_type` ENUM('Doctor', 'Patient', 'Admin') NOT NULL DEFAULT 'Patient',
  `user_id` INT(11) DEFAULT NULL,
  `identifier` VARCHAR(100) NOT NULL,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `email` VARCHAR(150) DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `status` ENUM('Success', 'Failed') NOT NULL DEFAULT 'Success',
  `login_time` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_login_user_type` (`user_type`),
  KEY `idx_login_user_id` (`user_id`),
  KEY `idx_login_identifier` (`identifier`),
  KEY `idx_login_time` (`login_time`),
  KEY `idx_login_phone` (`phone`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Optional: Add `last_login` column to `doctors` table (if not exists)
ALTER TABLE `doctors` ADD COLUMN IF NOT EXISTS `last_login` DATETIME DEFAULT NULL AFTER `status`;

-- 3. Optional: Add `last_login` column to `patients` table (if not exists)
ALTER TABLE `patients` ADD COLUMN IF NOT EXISTS `last_login` DATETIME DEFAULT NULL AFTER `status`;

