// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { SessionRow, UserRow } from "$lib/server/lucia";

declare global {
	namespace App {
        interface Platform {
            env: Env & {
                R2: R2Bucket;
                DB: D1Database;
                ENV: "production"|"development";
                DEFAULT_SEND_ADR_ID: string;
                RESEND_API: string;
                LOB_API_PUB: string;
                LOB_API_SECRET: string;
                STRIPE_API_PUB_KEY: string;
                STRIPE_API_SECRET: string;
                STRIPE_API_SIGN_SECRET: string;
                R2_DELIVER_URL: string;
                R2_ACCESS_KEY_ID: string;
                R2_SECRET_ACCESS_KEY: string;
                R2_ENDPOINT: string;
                R2_BUCKET: string;
                // PRINT_ONE_API: string;
                // PRINT_ONE_API_URL: string;
                // PRINT_ONE_TEMPLATE_ID: string;
            }
            cf: CfProperties
            ctx: ExecutionContext
        }
        interface Locals {
            user: UserRow | null;
            session: SessionRow | null;
        }
    }
}

export {};