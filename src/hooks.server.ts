import { handleAuth } from "$lib/server/lucia";
import { type Handle } from "@sveltejs/kit";
import { sequence } from "@sveltejs/kit/hooks";

export const handle: Handle = sequence(handleAuth)
