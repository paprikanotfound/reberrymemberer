<script lang="ts">
  import { createCheckout } from "$lib/checkout.remote";
  import { GetAddressLink } from "$lib/link.remote";
  import countries from '$lib/supported_countries_200.json';
	import { initForm } from "$lib/utils/forms.svelte";
	import { getCountryFromTimezone } from "$lib/utils/timezone";
	import { tick } from "svelte";

  let { data } = $props();

  initForm(GetAddressLink, () => {
    return {
      country: data.prefillAddress ? data.prefillAddress.address_country : getCountryFromTimezone(),
      name: data.prefillAddress ? data.prefillAddress.name : undefined,
      address: data.prefillAddress ? data.prefillAddress.address_line1 : undefined,
      addressLine2: data.prefillAddress ? data.prefillAddress.address_line2 : undefined,
      postalCode: data.prefillAddress ? data.prefillAddress.address_zip : undefined,
      state: data.prefillAddress ? data.prefillAddress.address_state : undefined,
      city: data.prefillAddress ? data.prefillAddress.address_city : undefined,
    }
  });

  // Track if the selected country is US
  let isUSAddress = $derived(GetAddressLink.fields.country.value() === 'US');

  // State for generated link
  let generatedLink = $state<string>('');
  let copySuccess = $state(false);

  function copyToClipboard() {
    try {
      navigator.clipboard.writeText(generatedLink).then(() => {
        copySuccess = true;
        setTimeout(() => copySuccess = false, 2000);
      });
    } catch (error) {
      console.error(error)
    }
  }
</script>

<div class="flex flex-col items-start justify-center gap-8 sm:gap-12 p-3 leading-tight">
  <div class="flex flex-col gap-4">
    <span>(<a href="/">Back</a>)</span>
    <span>
      ✉︎ Address Link → A private link that pre-fills your address.
      Anyone with the link can see the address, so treat it like sharing your address directly.
      We don’t store any address information.
    </span>
  </div>
  <hr>
   <div id="form-details" class="w-full flex flex-col gap-6 md:grid  md:grid-cols-2 mb-4">
    <div class="flex gap-4">
      <span></span>
    </div>
    <form {...GetAddressLink.enhance(async ({submit}) => {
      await submit();
      if (GetAddressLink.result) {
        generatedLink = GetAddressLink.result.link;
        await tick();
        copyToClipboard();
      }
    })} class="flex flex-col gap-6">
      <div id="address" class="flex flex-col gap-2">
        <label>
          Country*:
          <select {...GetAddressLink.fields.country.as('select')} required>
            <option value="">Select country</option>
            {#each countries as ctr }
              <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>
            {/each}
          </select>
        </label>

        <label>
          Name*:
          <input {...GetAddressLink.fields.name.as('text')} maxlength="40" required />
        </label>

        <label>
          Address*:
          <input
            {...GetAddressLink.fields.address.as('text')}
            maxlength={isUSAddress ? 64 : 200}
            required
            placeholder={isUSAddress ? "Street address" : "Primary address line"}
          />
        </label>

        <label>
          Address Line 2:
          <input {...GetAddressLink.fields.addressLine2.as('text')} />
        </label>

        {#if isUSAddress}
          <label>
            City*:
            <input {...GetAddressLink.fields.city.as('text')} maxlength="200" required />
          </label>

          <label>
            State*:
            <input
              {...GetAddressLink.fields.state.as('text')}
              maxlength="2"
              pattern="[a-zA-Z]{2}"
              placeholder="CA"
              required
            />
          </label>

          <label>
            ZIP Code*:
            <input
              {...GetAddressLink.fields.postalCode.as('text')}
              pattern="\d{5}(-\d{4})?"
              placeholder="12345 or 12345-1234"
              required
            />
          </label>
        {:else}
          <label>
            City:
            <input {...GetAddressLink.fields.city.as('text')} />
          </label>

          <label>
            Postal Code*:
            <input {...GetAddressLink.fields.postalCode.as('text')} maxlength="40" />
          </label>
        {/if}
      </div>   
      <div id="issues">
        {#each createCheckout.fields.allIssues() as issue}
          <p class="form-issue">{issue.message}</p>
        {/each}
      </div>
      <div id="action">
        <button type="submit" class="primary flex gap-1" disabled={!!GetAddressLink.pending}>
          {#if !!GetAddressLink.pending}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
          {/if}
          <span>Generate link</span>
        </button>
      </div>

      <!-- Display generated link -->
      {#if generatedLink}
        <div class="flex flex-col items-start gap-2">
          <p class="">Your address link is ready!</p>
          <div class="flex gap-1 w-full">
            <input
              type="text"
              readonly
              value={generatedLink}
              class="flex-1"
              onclick={(e) => e.currentTarget.select()}
            />
            <button type="button" onclick={copyToClipboard} class="primary">
              {copySuccess ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      {/if}
    </form>
  </div>
</div>