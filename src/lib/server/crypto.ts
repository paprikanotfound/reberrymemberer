import { generateRandomString } from "@oslojs/crypto/random";
import type { RandomReader } from "@oslojs/crypto/random";
import { decodeBase64urlIgnorePadding, encodeBase32LowerCaseNoPadding } from "@oslojs/encoding";
import { encodeBase64urlNoPadding } from "@oslojs/encoding";
import type { LobAddress } from "./lob";

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


/**
 * Encrypts address data using AES-256-GCM
 * @param data - Address data to encrypt
 * @param key - 256-bit encryption key (32 bytes)
 * @returns Base64url encoded encrypted data
 */
export async function encryptAddressData(data: LobAddress, key: string): Promise<string> {
  // Convert key string to CryptoKey
  const keyBytes = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32));
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  // Generate random IV (12 bytes for GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Convert data to JSON string then to bytes
  const dataStr = JSON.stringify(data);
  const dataBytes = new TextEncoder().encode(dataStr);

  // Encrypt the data
  const encryptedData = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    dataBytes
  );

  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);

  // Encode as base64url
  const encoded = encodeBase64urlNoPadding(combined);
  return encoded;
}

/**
 * Decrypts address data encrypted with encryptAddressData
 * @param encryptedData - Base64url encoded encrypted data
 * @param key - 256-bit encryption key (32 bytes)
 * @returns Decrypted address data
 */
export async function decryptAddressData(encryptedData: string, key: string): Promise<LobAddress> {
  try {
    // Decode from base64url (trim any whitespace)
    const combined = decodeBase64urlIgnorePadding(encryptedData);

    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);

    // Convert key string to CryptoKey
    const keyBytes = new TextEncoder().encode(key.padEnd(32, '0').slice(0, 32));
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBytes,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    // Decrypt the data
    const decryptedData = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      cryptoKey,
      encrypted
    );

    // Convert bytes to string and parse JSON
    const dataStr = new TextDecoder().decode(decryptedData);
    return JSON.parse(dataStr) as LobAddress;
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt address data. The link may be invalid or corrupted.');
  }
}

/**
 * Generates a shareable link with encrypted address data
 * @param baseUrl - Base URL (e.g., https://example.com/write)
 * @param data - Address data to encrypt
 * @param key - Encryption key
 * @returns Full URL with encrypted data
 */
export async function generateAddressLink(
  baseUrl: string,
  data: LobAddress,
  key: string
): Promise<string> {
  const encrypted = await encryptAddressData(data, key);
  const url = new URL(baseUrl);
  url.searchParams.set('addr', encrypted);
  return url.toString();
}

/**
 * Extracts and decrypts address data from URL
 * @param url - URL containing encrypted address data
 * @param key - Decryption key
 * @returns Decrypted address data or null if not present
 */
export async function extractAddressFromURL(url: string, key: string): Promise<LobAddress | null> {
  try {
    const urlObj = new URL(url);
    const encrypted = urlObj.searchParams.get('addr');
    if (!encrypted) return null;
    console.log("extractAddressFromURL", encrypted)

    return await decryptAddressData(encrypted, key);
  } catch (error) {
    console.error('Failed to extract address from URL:', error);
    return null;
  }
}
