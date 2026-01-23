<script lang="ts">
  import { CreateCheckout } from "$lib/checkout.remote";
  import countries from '$lib/supported_countries_200.json';

  type Fields = typeof CreateCheckout.fields;

  interface Props {
    fields: Fields;
  }
  
  let { fields=$bindable() }: Props = $props()

  // Track if the selected country is US or KR
  let isUSAddress = $derived(CreateCheckout.fields.country.value() === 'US');
  let isKRAddress = $derived(CreateCheckout.fields.country.value() === 'KR');


  // Daum Postcode API for Korean addresses
  function openPostcode() {
    if (typeof window !== 'undefined' && (window as any).daum) {
      new (window as any).daum.Postcode({
        oncomplete: function(data: any) {
          CreateCheckout.fields.postalCode.set(data.zonecode); // postal_code: "06018"
          CreateCheckout.fields.address.set(data.roadAddress); // primary_line: "테헤란로 123"
          CreateCheckout.fields.city.set(data.sigungu); // city: "강남구"
          CreateCheckout.fields.state.set(data.sido); // state: "서울특별시"
          // secondary_line (addressLine2) remains empty for user to fill in manually "삼성아파트 101동 1203호"
        }
      }).open();
    }
  }

</script>

<svelte:head>
  {#if isKRAddress}
    <script src="https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"></script>
  {/if}
</svelte:head>

<div id="address" class="flex flex-col gap-2">
  {#if isKRAddress}
    <!-- Korean Address Layout -->
    <label>
      국가*:
      <select {...CreateCheckout.fields.country.as('select')} required>
        <option value="">국가 선택</option>
        {#each countries as ctr }
          <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>
        {/each}
      </select>
    </label>

    <label>
      이름*:
      <input {...CreateCheckout.fields.name.as('text')} maxlength="40" required />
    </label>
    
    <label>
      우편번호*:
      <div class="flex gap-2">
        <input
          {...CreateCheckout.fields.postalCode.as('text')}
          maxlength="5"
          placeholder="06018"
          required
          class="flex-1"
        />
        <button type="button" onclick={openPostcode} class="primary">
          우편번호 찾기
        </button>
      </div>
    </label>

    <label>
      도로명 주소*:
      <input
        {...CreateCheckout.fields.address.as('text')}
        maxlength="200"
        placeholder="테헤란로 123"
        required
      />
    </label>

    <label>
      상세 주소:
      <input
        {...CreateCheckout.fields.addressLine2.as('text')}
        id="address_line_2"
        maxlength="200"
        placeholder="삼성아파트 101동 1203호"
      />
    </label>

    <label>
      시/군/구:
      <input
        {...CreateCheckout.fields.city.as('text')}
        maxlength="200"
        placeholder="강남구"
      />
    </label>

    <label>
      시/도:
      <input
        {...CreateCheckout.fields.state.as('text')}
        maxlength="200"
        placeholder="서울특별시"
      />
    </label>
  {:else if isUSAddress}
    <!-- US Address Layout -->
    <label>
      Country*:
      <select {...CreateCheckout.fields.country.as('select')} required>
        <option value="">Select country</option>
        {#each countries as ctr }
          <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>
        {/each}
      </select>
    </label>

    <label>
      Name*:
      <input {...CreateCheckout.fields.name.as('text')} maxlength="40" required />
    </label>

    <label>
      Address*:
      <input
        {...CreateCheckout.fields.address.as('text')}
        maxlength="64"
        required
        placeholder="Street address"
      />
    </label>

    <label>
      Address Line 2:
      <input {...CreateCheckout.fields.addressLine2.as('text')} />
    </label>

    <label>
      City*:
      <input {...CreateCheckout.fields.city.as('text')} maxlength="200" required />
    </label>

    <label>
      State*:
      <input
        {...CreateCheckout.fields.state.as('text')}
        maxlength="2"
        pattern="[a-zA-Z]{2}"
        placeholder="CA"
        required
      />
    </label>

    <label>
      ZIP Code*:
      <input
        {...CreateCheckout.fields.postalCode.as('text')}
        pattern="\d{5}(-\d{4})?"
        placeholder="12345 or 12345-1234"
        required
      />
    </label>
  {:else}
    <!-- Default International Address Layout -->

    <label>
      Country*:
      <select {...CreateCheckout.fields.country.as('select')} required>
        <option value="">Select country</option>
        {#each countries as ctr }
          <option value="{ctr.iso31661Alpha2}">{ctr.englishName}</option>
        {/each}
      </select>
    </label>

    <label>
      Name*:
      <input {...CreateCheckout.fields.name.as('text')} maxlength="40" required />
    </label>

    <label>
      Address*:
      <input
        {...CreateCheckout.fields.address.as('text')}
        maxlength="200"
        required
        placeholder="Primary address line"
      />
    </label>

    <label>
      Address Line 2:
      <input {...CreateCheckout.fields.addressLine2.as('text')} />
    </label>

    <label>
      City:
      <input {...CreateCheckout.fields.city.as('text')} />
    </label>

    <label>
      Postal Code*:
      <input {...CreateCheckout.fields.postalCode.as('text')} maxlength="40" />
    </label>
  {/if}
</div>