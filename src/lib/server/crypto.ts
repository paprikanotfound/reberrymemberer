import { generateRandomString } from "@oslojs/crypto/random";
import type { RandomReader } from "@oslojs/crypto/random";
import { encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";

// Constants
const random: RandomReader = {
	read(bytes: Uint8Array): void {
		crypto.getRandomValues(bytes);
	}
};
const numbers = "0123456789";
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";


export const generateOTPSixNumbers = () => generateRandomString(random, numbers, 6)

export const generateTokenTwentyFourChars = () => generateRandomString(random, alphabet, 24)


export function generateSessionToken(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return encodeBase32LowerCaseNoPadding(bytes);
}