-- Migration number: 0001 	 2025-07-29T21:53:18.405Z

--- authentication ---

CREATE TABLE user (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    email_verified BOOLEAN DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

CREATE TABLE session (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE verification_tokens (
  email TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE otp_attempts (
  email TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  next_allowed_at INTEGER NOT NULL DEFAULT 0
);

--- orders ---

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  stripe_checkout_id TEXT NOT NULL,
  stripe_payment_intent TEXT,
  provider_order_id TEXT,
  customer_email TEXT,
  send_date TEXT,
  sender_address TEXT,
  recipient_address TEXT NOT NULL,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);