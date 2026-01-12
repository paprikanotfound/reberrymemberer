import type { RemoteForm, RemoteFormInput } from "@sveltejs/kit";

/**
 * Initializes a remote form with values from a getter function, handling hydration to prevent
 * unnecessary updates during the initial client-side hydration phase.
 *
 * @template T - The form input type extending RemoteFormInput
 * @template R - The response type (defaults to unknown)
 * @param form - The remote form object (without the "for" property)
 * @param getter - A function that returns the initial form field values
 *
 * @see {@link https://dev.to/jdgamble555/sveltekit-remote-functions-workaround-helpers-4k8c}
 */
export function initForm<T extends RemoteFormInput, R = unknown>(
  form: Omit<RemoteForm<T, R>, "for">,
  getter: () => Parameters<typeof form.fields.set>[0]
) {

  let hydrated = false;

  form.fields.set(getter());

  $effect(() => {

    const values = getter();
    
    if (!hydrated) {
      hydrated = true;
      return;
    }
    
    form.fields.set(values);
  });
};
