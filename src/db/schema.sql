-- ═══════════════════════════════════════════════════════════════
-- Super Agent — Database Schema
-- ═══════════════════════════════════════════════════════════════

-- ─── System-wide configuration (OAuth credentials, etc.) ─────
CREATE TABLE IF NOT EXISTS system_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    config_key VARCHAR(255) NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─── Users (GitHub OAuth accounts) ───────────────────────────
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    github_id INT NOT NULL UNIQUE,
    github_login VARCHAR(255) NOT NULL,
    github_avatar_url VARCHAR(512),
    github_access_token TEXT NOT NULL,
    email VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_github_login (github_login),
    INDEX idx_email (email)
);

-- ─── Per-user configuration (API keys, preferences) ──────────
CREATE TABLE IF NOT EXISTS user_configs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    config_value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_config (user_id, config_key),
    INDEX idx_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ─── Processed issues (per-issue tracking) ───────────────────
CREATE TABLE IF NOT EXISTS processed_issues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    repo_owner VARCHAR(255) NOT NULL,
    repo_name VARCHAR(255) NOT NULL,
    issue_number INT NOT NULL,
    issue_title VARCHAR(512) NOT NULL,
    issue_url VARCHAR(512),
    status ENUM('processing', 'success', 'failed') NOT NULL DEFAULT 'processing',
    branch_name VARCHAR(255),
    pr_number INT,
    pr_url VARCHAR(512),
    review_approved BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_repo (user_id, repo_owner, repo_name),
    INDEX idx_status (status),
    INDEX idx_issue_number (repo_owner, repo_name, issue_number),
    INDEX idx_created_at (created_at)
);
