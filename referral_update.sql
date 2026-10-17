-- ============================================================================
-- Ocayur Ayurveda Lifestyle - Referral System Update SQL
-- Database: jewrzsmy_panchved
-- ============================================================================
-- NOTE: Please execute these queries in your phpMyAdmin or MySQL client.
-- This aligns the referral flow so that patients are the referral targets,
-- doctors have their own referral codes, and social media campaigns are supported.
-- ============================================================================

-- 1. Add `referral_code` column to `patients` table (tracks referral source for patient registration)
ALTER TABLE `patients`
ADD COLUMN `referral_code` VARCHAR(50) NULL DEFAULT NULL AFTER `package_name`,
ADD INDEX `idx_patient_referral_code` (`referral_code`);

-- 2. Create `social_media_referrals` table for tracking social media campaigns
CREATE TABLE IF NOT EXISTS `social_media_referrals` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `campaign_id` VARCHAR(50) DEFAULT NULL,
  `platform` VARCHAR(100) NOT NULL,
  `campaign_name` VARCHAR(150) NOT NULL,
  `referral_code` VARCHAR(50) NOT NULL,
  `target_url` VARCHAR(255) DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `status` ENUM('Active', 'Inactive') NOT NULL DEFAULT 'Active',
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_sm_code` (`referral_code`),
  KEY `idx_sm_platform` (`platform`),
  KEY `idx_sm_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. (Optional) Sample Social Media Referral Campaigns
INSERT INTO `social_media_referrals` (`campaign_id`, `platform`, `campaign_name`, `referral_code`, `target_url`, `notes`, `status`) VALUES
('SOC0001', 'Instagram', 'Instagram Summer Wellness Reel', 'SOC-INSTA-SUMMER', 'https://instagram.com/reel/example', 'Reel collab with yoga wellness creator', 'Active'),
('SOC0002', 'YouTube', 'Ayurveda Dinacharya Routine Video', 'SOC-YT-DINA24', 'https://youtube.com/watch?v=example', 'Long form morning routine video description link', 'Active'),
('SOC0003', 'Facebook', 'Holistic Health Community Ad', 'SOC-FB-COMM01', 'https://facebook.com/ocayur', 'Sponsored post in health community group', 'Active')
ON DUPLICATE KEY UPDATE `campaign_name` = VALUES(`campaign_name`);

-- 4. (Optional) Initialize doctor referral IDs for existing doctors who have empty or old partner codes
UPDATE `doctors`
SET `referral_code` = CONCAT('DOC-', UPPER(SUBSTRING(REPLACE(REPLACE(full_name, 'Dr. ', ''), ' ', ''), 1, 3)), id)
WHERE `referral_code` IS NULL OR `referral_code` = '' OR `referral_code` LIKE 'REF-%';
