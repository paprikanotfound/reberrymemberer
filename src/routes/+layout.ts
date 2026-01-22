import { redirect } from '@sveltejs/kit';
import { ROUTES } from '$lib';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async (event) => {
  // if (event.url.pathname.startsWith(ROUTES.auth) && event.data.user) {
  //   throw redirect(303, ROUTES.profile)
  // }
  // if (event.url.pathname.startsWith(ROUTES.profile) && !event.data.user) {
  //   throw redirect(303, ROUTES.auth)
  // }
  return event.data
};