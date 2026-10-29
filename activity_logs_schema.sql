-- ============================================================================
-- Panchved / Ocayur - Activity & Audit Logging Schema
-- Database: jewrzsmy_panchved
-- ============================================================================

-- 1. Create `activity_logs` table
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_type` ENUM('Admin', 'Doctor', 'Patient', 'System') NOT NULL DEFAULT 'System',
  `user_id` INT DEFAULT NULL,
  `user_name` VARCHAR(150) DEFAULT NULL,
  `user_identifier` VARCHAR(100) DEFAULT NULL,
  `module` VARCHAR(50) NOT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) DEFAULT NULL,
  `entity_id` INT DEFAULT NULL,
  `entity_name` VARCHAR(255) DEFAULT NULL,
  `description` VARCHAR(500) NOT NULL,
  `details` JSON DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` VARCHAR(500) DEFAULT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_activity_created_module` (`created_at`, `module`),
  KEY `idx_activity_actor` (`user_type`, `user_id`, `created_at`),
  KEY `idx_activity_entity` (`entity_type`, `entity_id`),
  KEY `idx_activity_action` (`action`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create `login_logs` table (if not exists)
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

