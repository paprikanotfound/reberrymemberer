import { encodeHexLowerCase } from "@oslojs/encoding";
import { sha256 } from "@oslojs/crypto/sha2";
import type { Cookies, Handle } from "@sveltejs/kit";
import type { D1Database } from '@cloudflare/workers-types';

// Constants
const SESSION_COOKIE = "s___id";

export const initLucia = (db: D1Database) => ({
  auth: {
    deleteUserAccount: (id: UserRow['id']) => {
      return db.prepare(`DELETE FROM user WHERE id = ?1;`)
        .bind(id)
        .run();
    },
    getUserByEmail: (email: UserRow['email']) => {
      return db.prepare(`SELECT * FROM user WHERE email = ?1 LIMIT 1;`)
      .bind(email)
      .first<UserRow>();
    },
    registerUser: (email: UserRow['email']) => {
      return db.prepare(`
        INSERT INTO user (id, email, created_at, updated_at) 
        VALUES (?1, ?2, strftime('%s', 'now'), strftime('%s', 'now')) 
        ON CONFLICT(email) DO NOTHING
        RETURNING *;
      `)
      .bind(crypto.randomUUID(), email)
      .first<UserRow>();
    },
    setEmailVerified: (email: UserRow['email']) => {
      return db.prepare(`
        UPDATE user
        SET email_verified = 1
        WHERE email = ?1;
      `)
      .bind(email)
      .run();
    }
  },
  session: {
    createSession: async (token: string, userId: string): Promise<SessionRow> => {
      const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const session: SessionRow = {
        id: sessionId,
        user_id: userId,
        expires_at: Date.now() + 1000 * 60 * 60 * 24 * 30,
      };
      await db
        .prepare("INSERT INTO session (id, user_id, expires_at) VALUES (?, ?, ?)")
        .bind(
          session.id,
          session.user_id,
          Math.floor(session.expires_at / 1000)
        )
        .run();
      return session;
    },
    validateSessionToken: async (token: string) => {
      const sessionId = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const now = Date.now();
      const row = await db
        .prepare(`
          SELECT * FROM session 
          INNER JOIN user ON user.id = session.user_id 
          WHERE session.id = ?
        `)
        .bind(sessionId)
        .first<SessionRow & UserRow>();

      if (!row) {
        return { session: null, user: null };
      }

      const session: SessionRow = {
        id: row.id,
        user_id: row.user_id,
        expires_at: row.expires_at * 1000,
      };
      // check if session is expired
      if (now >= session.expires_at) {
        await db.prepare("DELETE FROM session WHERE id = ?").bind(session.id).run();
        return { session: null, user: null };
      }
      // update expiration date
      if (now >= session.expires_at - 1000 * 60 * 60 * 24 * 15) {
        session.expires_at = now + 1000 * 60 * 60 * 24 * 30;
        await db
          .prepare("UPDATE session SET expires_at = ? WHERE id = ?")
          .bind(Math.floor(session.expires_at / 1000), session.id)
          .run();
      }

      const user: UserRow = { ...row };

      return { session, user };
    },
    invalidateSession: (sessionId: string) => {
      return db.prepare("DELETE FROM session WHERE id = ?")
        .bind(sessionId)
        .run();
    },
    invalidateAllSessions: (userId: string) => {
      return db.prepare("DELETE FROM session WHERE user_id = ?")
        .bind(userId)
        .run();
    }
  },
  otp: {
    invalidateAll: (userId: string) => {
      return db.prepare("DELETE FROM verification_tokens WHERE email = ?")
        .bind(userId)
        .run();
    },
    storeOTPHash: (token: string, email: string, expiresIn: number = 1000 * 60 * 10) => {
      const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const session: VerificationTokenRow = {
        token_hash: tokenHash,
        email: email,
        expires_at: Date.now() + expiresIn,
      };
      return db
        .prepare(`
          INSERT INTO verification_tokens (token_hash, email, expires_at) 
          VALUES (?, ?, ?);
        `)
        .bind(
          session.token_hash,
          session.email,
          Math.floor(session.expires_at / 1000)
        )
        .run();
    },
    validateOTP: async (token: string, email: string) => {
      const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const now = Date.now();

      // retrieve & delete token
      const session = await db
        .prepare(`
          DELETE FROM verification_tokens 
          WHERE token_hash = ?1 AND email = ?2
          RETURNING *;
        `)
        .bind(tokenHash, email)
        .first<VerificationTokenRow>();

      if (!session) {
        return { isValid: false, reason: "Email or hash does not match" };
      }

      // check if session is expired
      if (now >= session.expires_at * 1000) {
        return { isValid: false, reason: "OTP is expired" };
      }

      return { isValid: true };
    },
    validateToken: async (token: string): Promise<{ 
      session?: VerificationTokenRow | null;
      reason?: "invalid" | "expired" | undefined;
    }> => {
      const tokenHash = encodeHexLowerCase(sha256(new TextEncoder().encode(token)));
      const now = Date.now();

      // retrieve & delete token
      const session = await db
        .prepare(`
          DELETE FROM verification_tokens 
          WHERE token_hash = ?1
          RETURNING *;
        `)
        .bind(tokenHash)
        .first<VerificationTokenRow>();

      if (!session) {
        return { reason: "invalid" };
      }

      // check if session is expired
      if (now >= session.expires_at * 1000) {
        return { session, reason: "expired" };
      }

      return { session };
    },
    checkAttempThrotling: (email: string) => {
      return db
        .prepare(`
          SELECT fail_count, next_allowed_at
          FROM otp_attempts 
          WHERE email = ?
        `)
        .bind(email)
        .first<Omit<OtpAttempsRow,"email">>();
    },
    backOff: (email: string, failCount: number, nextAllowedAt: number) => {
      return db
        .prepare(`
          INSERT INTO otp_attempts (email, fail_count, next_allowed_at)
          VALUES (?, ?, ?)
          ON CONFLICT(email) DO UPDATE SET
            fail_count = excluded.fail_count,
            next_allowed_at = excluded.next_allowed_at
        `)
        .bind(email, failCount, nextAllowedAt)
        .run();
    },
    resetAttemps: (email: string) => {
      return db
        .prepare(`DELETE FROM otp_attempts WHERE email = ?`)
        .bind(email)
        .run();
    }
  },
  rateLimit: {
    checkLimit: async ({ key, limit, windowSeconds }: { key: string, limit: number, windowSeconds: number }) => {
      const now = Math.floor(Date.now() / 1000);
      const windowEnd = now + windowSeconds;

      const result = await db
        .prepare(`SELECT count, expires_at FROM rate_limits WHERE key = ?`)
        .bind(key)
        .first<RateLimitsRow>();

      if (result) {
        if (result.expires_at < now) {
          // Window expired, reset
          await db.prepare(
            `UPDATE rate_limits SET count = 1, expires_at = ? WHERE key = ?`
          ).bind(windowEnd, key).run();
          return true;
        }
        if (result.count >= limit) {
          return false; // rate limit exceeded
        }
        // increase count
        await db.prepare(
          `UPDATE rate_limits SET count = count + 1 WHERE key = ?`
        ).bind(key).run();
        return true;
      }
      // No entry yet
      await db.prepare(
        `INSERT INTO rate_limits (key, count, expires_at) VALUES (?, 1, ?)`
      ).bind(key, windowEnd).run();

      return true;
    }
  },
  cookies: {
    setSessionCookie(cookies: Cookies, token: string, expiresAt: Date): void {
      cookies.set(SESSION_COOKIE, token, {
        httpOnly: true,
        sameSite: "lax",
        expires: expiresAt,
        path: "/",
        secure: false
      });
    },
    deleteSessionCookie(cookies: Cookies): void {
      cookies.set(SESSION_COOKIE, "", {
        httpOnly: true,
        sameSite: "lax",
        maxAge: 0,
        path: "/",
        secure: false
      });
    },
    getSession: (cookies: Cookies) => {
      return cookies.get(SESSION_COOKIE) ?? null
    }
  }
});

export type LuciaAdapter = ReturnType<typeof initLucia>;

// --- Utils ---

export const handleAuth: Handle = async ({ event, resolve }) => {
	const { locals, platform, cookies } = event;
	const lucia = initLucia(platform!.env.DB);
	const token = lucia.cookies.getSession(cookies);
	// Clear locals
	if (token === null) {
		locals.user = null;
		locals.session = null;
		return resolve(event);
	}
	// Validate token
	const { session, user } = await lucia.session.validateSessionToken(token);
	if (session == null) {
		lucia.cookies.deleteSessionCookie(cookies);
	}
  // Update locals
	locals.session = session;
	locals.user = user;
	return resolve(event);
}

// --- Types ---

export type UserRow = {
  id: string;
  email: string;
  email_verified: boolean;
  created_at: number;
  updated_at: number;
};

export type SessionRow = {
  id: string;
  expires_at: number;
  user_id: string;
};

export type VerificationTokenRow = {
  token_hash: string;
  expires_at: number;
  email: string;
};

export type RateLimitsRow = {
  key: string;
  count: number;
  expires_at: number;
};

export type OtpAttempsRow = {
  email: string;
  fail_count: number;
  next_allowed_at: number;
};