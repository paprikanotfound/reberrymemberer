-- Migration number: 0001 	 2025-07-29T21:53:18.405Z

CREATE TABLE user (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE
);

CREATE TABLE session (
    id TEXT NOT NULL PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    user_id TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE orders (
  id TEXT PRIMARY KEY,
  stripe_checkout_id TEXT NOT NULL,
  stripe_payment_intent TEXT,
  provider_order_id TEXT,
  customer_email TEXT,
  send_date TEXT,
  sender_address TEXT,
  recipient_address TEXT,
  front_image_url TEXT NOT NULL,
  back_image_url TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  reason TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);