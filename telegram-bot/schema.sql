-- ساختار دیتابیس ربات شکارگاه (Cloudflare D1 / SQLite)
-- اجرا (نصب تازه):
--   لوکال:  npx wrangler d1 execute shekargah-bot-db --local  --file=./schema.sql
--   ریموت:  npx wrangler d1 execute shekargah-bot-db --remote --file=./schema.sql

-- کاربران ربات (برای آمار و ارسال پیام)
CREATE TABLE IF NOT EXISTS users (
    user_id            INTEGER PRIMARY KEY,
    username           TEXT,
    first_name         TEXT,
    joined_at          TEXT NOT NULL DEFAULT (datetime('now')),
    -- ۱ = اعلان محصولات تازه را در چت خصوصی می‌خواهد
    wants_new_products INTEGER NOT NULL DEFAULT 0,
    blocked_at         TEXT
);

-- اتصال هر کاربر تلگرام به حساب شکارگاه
CREATE TABLE IF NOT EXISTS telegram_users (
    telegram_id      INTEGER PRIMARY KEY,
    supabase_user_id TEXT NOT NULL,
    email            TEXT NOT NULL,
    linked_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- کدهای یکبارمصرف ورود به سایت (فقط هش ذخیره می‌شود)
CREATE TABLE IF NOT EXISTS login_codes (
    code_hash   TEXT PRIMARY KEY,
    telegram_id INTEGER NOT NULL,
    expires_at  TEXT NOT NULL,
    used_at     TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- وضعیت‌های فرم پنل ادمین
CREATE TABLE IF NOT EXISTS sessions (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- کلید/مقدارهای سراسری ربات (watermark، تعلیق اعلان خودکار و…)
CREATE TABLE IF NOT EXISTS bot_state (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- محصولاتی که در کانال معرفی شده‌اند (خودکار یا دستی)
CREATE TABLE IF NOT EXISTS announcements (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   TEXT NOT NULL,
    product_slug TEXT NOT NULL,
    product_name TEXT NOT NULL,
    -- auto | manual
    source       TEXT NOT NULL DEFAULT 'auto',
    -- posted | scheduled | skipped
    status       TEXT NOT NULL DEFAULT 'posted',
    scheduled_at TEXT,
    posted_at    TEXT,
    message_id   INTEGER,
    post_count   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- پست‌های عادی کانال با دکمه‌های دلخواه (مستقل از محصولات سایت)
CREATE TABLE IF NOT EXISTS channel_posts (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    kind         TEXT NOT NULL,
    content      TEXT,
    file_id      TEXT,
    caption      TEXT,
    -- [{"text":"...","url":"..."}]
    buttons      TEXT NOT NULL DEFAULT '[]',
    -- posted | scheduled
    status       TEXT NOT NULL DEFAULT 'posted',
    scheduled_at TEXT,
    posted_at    TEXT,
    post_count   INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- آمار: هر بار که کاربری محصولی را در ربات می‌بیند
CREATE TABLE IF NOT EXISTS product_views (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id   TEXT NOT NULL,
    user_id      INTEGER NOT NULL,
    viewed_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_login_codes_expiry   ON login_codes (expires_at);
CREATE INDEX IF NOT EXISTS idx_announcements_product ON announcements (product_id);
CREATE INDEX IF NOT EXISTS idx_announcements_due     ON announcements (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_channel_posts_due     ON channel_posts (status, scheduled_at);
CREATE INDEX IF NOT EXISTS idx_product_views_product ON product_views (product_id);