<script lang="ts">
	import { page } from "$app/state";
	import { resendOTP, signInWithOTP, signOut, verifyOTP } from "$lib/auth.remote";
	import { initForm } from "$lib/utils/forms.svelte";
	import { onMount, untrack } from "svelte";
	import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  
  let view = $derived(page.url.searchParams.get("view") as "otp" | null)
  let currentEmail: string|null = $derived(page.url.searchParams.get("email"));
  let isResendCodeAllowed = $state(false);
  let countdown = $state(0);
  let timer: any = null;

  function resetResendOTPCountdown(seconds = 60) {
    isResendCodeAllowed = false;
    countdown = seconds;

    timer && clearInterval(timer);
    timer = setInterval(() => {
      countdown -= 1;
      if (countdown <= 0) {
        clearInterval(timer);
        isResendCodeAllowed = true;
      }
    }, 1000);
  }

	$effect(() => {
		if (view == "otp") {
			untrack(() => {
				resetResendOTPCountdown();
			})
		}
	});

	onMount(() => {
		if (currentEmail) {
			initForm(signInWithOTP, () => ({ email: currentEmail }));
		}
	});
</script>

<div class="p-4 flex flex-col gap-4">
  <div class="flex flex-col gap-4">
    <span>(<a href="/">Back</a>)</span>
    <span>✉︎ Address Book → Add people to your address book to send postcards without having to type their address.</span>
  </div>

  {#if data.user}
    <form {...signOut}>
      <button class="primary flex gap-1">
        {#if !!signOut.pending}
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
        {/if}
        <span>Sign-out</span>
      </button>
    </form>

    <div id="" class="w-full flex flex-col gap-6 md:grid  md:grid-cols-2 mb-4">
      <div class="flex gap-4">
        <span>001</span>
        <span>Profile</span>
      </div>
    </div>
    <div id="" class="w-full flex flex-col gap-6 md:grid  md:grid-cols-2 mb-4">
      <div class="flex gap-4">
        <span>002</span>
        <span>Address Book</span>
      </div>
    </div>
    <div id="" class="w-full flex flex-col gap-6 md:grid  md:grid-cols-2 mb-4">
      <div class="flex gap-4">
        <span>003</span>
        <span>Contacts</span>
      </div>
    </div>
  {:else}
    {#if view == "otp"}
      <div class="flex flex-col gap-2">
        <div class="">
          <p>Check your email — We just sent a code to <span class="underline">{currentEmail ? currentEmail : "your inbox"}</span>.</p>
          <p>Please enter the code in the email to sign in.</p>
        </div>
  
        <form {...verifyOTP} class="flex flex-col items-start gap-1">
          <input hidden {...verifyOTP.fields.email.as("email")} bind:value={currentEmail} />
          <input {...verifyOTP.fields.code.as("text")} placeholder="Enter code" class="" />
          <div id="issues">
            {#each verifyOTP.fields.allIssues() as issue}
              <p class="form-issue">{issue.message}</p>
            {/each}
          </div>
          <button type="submit" class="primary flex gap-1">
            {#if !!verifyOTP.pending}
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
            {/if}
            <span>Continue</span>
          </button>
        </form>
  
        <div class="mt-2 flex flex-col italic">
          <p>Didn't receive the code?</p> 
  
          {#if isResendCodeAllowed}
            <form {...resendOTP.enhance(async ({submit}) => { 
              await submit();
              resetResendOTPCountdown();
            })} class="flex flex-col items-start">
              <input hidden {...resendOTP.fields.email.as("email")} bind:value={currentEmail} />
              <div id="issues">
                {#each resendOTP.fields.allIssues() as issue}
                  <p class="form-issue">{issue.message}</p>
                {/each}
              </div>
              <button type="submit" class="">
                {#if !!resendOTP.pending}
                  Sending...
                {:else}
                  Resend email
                {/if} 
              </button>
            </form>
          {:else}
            <p class="text-muted-foreground">You can request to resend in {countdown}s.</p>
          {/if}
        </div>
      </div>
      <div>(<a href="?" class="mt-4">Back to sign in</a>)</div>
    {:else}
      <form {...signInWithOTP} class="flex flex-col items-start gap-2">
        <p class="">Enter your email to sign in:</p>
        <label for="email">
          <input id="email" required {...signInWithOTP.fields.email.as("email")} placeholder="name@example.com" class="" />
        </label>
        <div id="issues">
          {#each signInWithOTP.fields.allIssues() as issue}
            <p class="form-issue">{issue.message}</p>
          {/each}
        </div>
        <button type="submit" class="primary flex gap-1">
          {#if !!signInWithOTP.pending}
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="animate-spin lucide lucide-loader-icon lucide-loader"><path d="M12 2v4"/><path d="m16.2 7.8 2.9-2.9"/><path d="M18 12h4"/><path d="m16.2 16.2 2.9 2.9"/><path d="M12 18v4"/><path d="m4.9 19.1 2.9-2.9"/><path d="M2 12h4"/><path d="m4.9 4.9 2.9 2.9"/></svg>
          {/if}
          <span>Continue</span>
        </button>
      </form>
    {/if}	
  {/if}
</div>