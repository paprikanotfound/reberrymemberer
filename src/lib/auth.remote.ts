import { command, form, getRequestEvent } from '$app/server';
import z from 'zod'
import { initLucia, type LuciaAdapter, type SessionRow, type UserRow } from './server/lucia';
import { redirect } from '@sveltejs/kit';
import { ROUTES } from '$lib';
import { initResend } from './server/resend';
import { generateOTPSixNumbers, generateTokenTwentyFourChars } from './server/crypto';
import { dev } from '$app/environment';

// Constants
const EMAIL_SEND_LOCAL = false;
const RATE_LIMIT_IP_MAX_ATTEMPTS = 10;
const RATE_LIMIT_USER_MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_BACKOFF_SECONDS = 600; // 10 minutes
const MAGIC_LINK_EXPIRY_MS = 1000 * 60 * 60 * 24; // 24 hours


async function rateLimitIp(lucia: LuciaAdapter) {
  const { request } = getRequestEvent();
  
  const ip = request.headers.get("cf-connecting-ip");
  return lucia.rateLimit.checkLimit({
    key: `ip:${ip}`,
    limit: RATE_LIMIT_IP_MAX_ATTEMPTS,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS
  });
}

async function sendVerificationCode(user: UserRow) {
  const { platform } = getRequestEvent();
  const lucia = initLucia(platform!.env.DB);

  // Rate limit by user ID
  const rateLimitUser = await lucia.rateLimit.checkLimit({
    key: `user:${user.id}`,
    limit: RATE_LIMIT_USER_MAX_ATTEMPTS,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS
  });
  if (!rateLimitUser && !dev) 
    return { ok: false, message: "Too many attempts, please wait before retrying." }

	// Generate new OTP token
	const code = generateOTPSixNumbers();
  await lucia.otp.invalidateAll(user.email);
  const otp = await lucia.otp.storeOTPHash(code, user.email);

  if (!otp.success) return { ok: false, message: "Error creating verification code." }

  // Send token
	if (dev && !EMAIL_SEND_LOCAL) {
		console.log('token: ', code); // skip email for convenience
	} else {
    await initResend(platform!.env.RESEND_API).sendOtpToEmail(user.email, code);
	}

  return redirect(300, `?view=otp&email=${user.email}`)
}

async function sendMagicLink(userId: string, email: string) {
  const { platform, url } = getRequestEvent();
  const lucia = initLucia(platform!.env.DB);

  // Rate limit by user ID
  const rateLimitUser = await lucia.rateLimit.checkLimit({
    key: `user:${userId}`,
    limit: RATE_LIMIT_USER_MAX_ATTEMPTS,
    windowSeconds: RATE_LIMIT_WINDOW_SECONDS
  });

  if (!rateLimitUser && !dev) {
    return { ok: false, message: "Too many attempts, please wait before retrying." }
  }

  // Generate new OTP token
  const code = generateTokenTwentyFourChars();
  await lucia.otp.invalidateAll(email);
  const otp = await lucia.otp.storeOTPHash(code, email, MAGIC_LINK_EXPIRY_MS);

  if (!otp.success) return { ok: false, message: "Error generating verification token." };

  // Send magic link
  const link = new URL(`${url.origin}${ROUTES.magic_link}`);
  link.searchParams.set('token', code);

  if (dev) {
    // skip email for testing
    console.log('verification link: ', link.toString());
  } else {
    await initResend(platform!.env.RESEND_API).sendMagicLinkEmail(email, link.toString());
  }

  return { ok: true }
}

async function createNewAuthSession(email: string): Promise<{ user?: UserRow, session?: SessionRow }> {
  const { platform, cookies } = getRequestEvent();
  const lucia = initLucia(platform!.env.DB);

	// Create a new auth session
  const user = await lucia.auth.getUserByEmail(email);
  if (!user) return {}

  const token = generateOTPSixNumbers();
  await lucia.session.invalidateAllSessions(user.id);
  const session = await lucia.session.createSession(token, user.id);
	lucia.cookies.setSessionCookie(cookies, token, new Date(session.expires_at));

  return { user, session }
}


export const signOut = form(async () => {
  const { locals, platform, cookies } = getRequestEvent();

  if(locals.session) {
    // Invalidate current session & delete session cookies
    const lucia = initLucia(platform!.env.DB);
    await lucia.session.invalidateSession(locals.session.id);
    lucia.cookies.deleteSessionCookie(cookies);
  }
  
  redirect(301, '/');
});


const EmailSchema = z.object({
  email: z.email(),
});

export const signInWithOTP = form(EmailSchema, async (req) => {
  const { platform } = getRequestEvent();
  const lucia = initLucia(platform!.env.DB);

  // Rate limit IP address.
  if (!(await rateLimitIp(lucia))) {
    return { ok: false, message: "Too many attempts, please wait before retrying." }
  }

  // Check if user exists
  let user = await lucia.auth.getUserByEmail(req.email);
  
  // Insert new used if sign-up is allowed
  if (!user) {
    user = await lucia.auth.registerUser(req.email);
  }

   // Return false positive to prevent email probing?
  if (!user) return { ok: false, message: "Email address is not associated with any user." }

  return sendVerificationCode(user);
});

export const resendOTP = form(EmailSchema, async (req) => {
  const { platform } = getRequestEvent();
  const lucia = initLucia(platform!.env.DB);

  // Rate limit IP address.
  if (!(await rateLimitIp(lucia))) {
    return { ok: false, message: "Too many attempts, please wait before retrying." }
  }

  // Check if user exists
  let user = await lucia.auth.getUserByEmail(req.email);

  if (!user) return { ok: true } // Return false positive to prevent email probing

  return sendVerificationCode(user);
});


const CodeSchema = z.object({
	code: z.string().regex(/^[A-Za-z0-9]{6}$/, "Code must be exactly 6 letters or numbers"),
  email: z.email(),
});

export const verifyOTP = form(CodeSchema, async (req) => {
  const { platform } = getRequestEvent();
  const now = Math.floor(Date.now() / 1000);
  const lucia = initLucia(platform!.env.DB);

  // 1️⃣ Check throttling state
  const attempt = await lucia.otp.checkAttempThrotling(req.email);
  if (attempt && attempt.next_allowed_at > now) {
    const waitSec = attempt.next_allowed_at - now;
    return { ok: false, message: `Too many attempts. Try again in ${waitSec}s.` };
  }

  // Verify OTP
  const { isValid } = await lucia.otp.validateOTP(req.code, req.email);
	if (!isValid) {
    // ❌ Wrong code → update attempt count + backoff
    const failCount = (attempt?.fail_count ?? 0) + 1;
    const backoffSeconds = Math.min(2 ** failCount, MAX_BACKOFF_SECONDS);
    const nextAllowedAt = now + backoffSeconds;
    await lucia.otp.backOff(req.email, failCount, nextAllowedAt);

    return { ok: false, message: "The code is invalid or expired" };
	}
  // ✅ Correct token → reset attempts, sign in user
  await lucia.otp.resetAttemps(req.email);

	// Create a new session
  const { user, session } = await createNewAuthSession(req.email);
  if (!user || !session) return { ok: false, message: "Authentication failed" };

  // Set email as verified
  if (!user.email_verified) {
    await lucia.auth.setEmailVerified(user.email);
  }

  // redirect(300, ROUTES.dashboard);
})


const DeleteAccountSchema = z.object({
  confirmation: z.literal("DELETE", {
    error: () => ({ message: "Word does not match." })
  }),
});

export const deleteAccount = form(DeleteAccountSchema, async (request) => {
  const { locals, platform, cookies } = getRequestEvent();

  if (!locals.session || !locals.user) {
    redirect(301, '/');
  }

  const lucia = initLucia(platform!.env.DB)
  
  // Delete account permanently
  const resultDel = await lucia.auth.deleteUserAccount(locals.user.id);
  if (!resultDel.success) {
    return { ok: false, message: "Action could not be done at this time." }
  }

  // Invalidate current session & delete session cookies
  await lucia.session.invalidateSession(locals.session.id);
  lucia.cookies.deleteSessionCookie(cookies);

  redirect(301, '/');
});


const VerifyMagicLinkSchema = z.object({
  token: z.string(),
});

const verifyMagicLink = command(VerifyMagicLinkSchema, async (request) => {
	const { platform } = getRequestEvent();
  const lucia = initLucia(platform!.env.DB);

  // Verify magiclink token
  const { session: sessionToken, reason } = await lucia.otp.validateToken(request.token);
	if (reason || !sessionToken) {
    return { ok: false, message: "The code is invalid or expired" };
	}
  // ✅ Correct token → reset attempts, sign in user
  await lucia.otp.resetAttemps(sessionToken.email);

  // create auth session
  const { user, session } = await createNewAuthSession(sessionToken.email);
  if (!user || !session) return { ok: false, message: "Authentication failed" };

  // Set email as verified
  if (!user.email_verified) {
    await lucia.auth.setEmailVerified(sessionToken.email);
  }
  
  return { ok: true };
});

const resendVerificationLink = command("unchecked", async () => {
	const { locals } = getRequestEvent();

  if (!locals.user) return { ok: false, message: "Please sign-in." }

  return sendMagicLink(locals.user.id, locals.user.email);
});