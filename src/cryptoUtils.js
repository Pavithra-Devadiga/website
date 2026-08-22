// cryptoUtils.js
// Standard Web Crypto API encryption helpers for local browser vault storage

export function generateRandomBytes(len = 16) {
  const bytes = new Uint8Array(len);
  window.crypto.getRandomValues(bytes);
  return bytes;
}

export function bytesToHex(bytes) {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

// SHA-256 password salting and hashing verifier
export async function hashPassword(password, saltHex) {
  const encoder = new TextEncoder();
  const passwordBytes = encoder.encode(password);
  const saltBytes = hexToBytes(saltHex);
  
  const combined = new Uint8Array(passwordBytes.length + saltBytes.length);
  combined.set(passwordBytes);
  combined.set(saltBytes, passwordBytes.length);
  
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', combined);
  return bytesToHex(new Uint8Array(hashBuffer));
}

// PBKDF2 symmetric key derivation function
async function deriveKey(password, saltBytes) {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  
  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt profile settings payload with AES-GCM
export async function encryptPayload(payloadObj, password, saltHex) {
  const encoder = new TextEncoder();
  const saltBytes = hexToBytes(saltHex);
  const iv = generateRandomBytes(12); // Standard AES-GCM IV is 12 bytes
  
  const key = await deriveKey(password, saltBytes);
  const dataBytes = encoder.encode(JSON.stringify(payloadObj));
  
  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    dataBytes
  );
  
  return {
    ciphertext: bytesToHex(new Uint8Array(ciphertextBuffer)),
    iv: bytesToHex(iv)
  };
}

// Decrypt profile settings payload with AES-GCM
export async function decryptPayload(ciphertextHex, ivHex, password, saltHex) {
  const saltBytes = hexToBytes(saltHex);
  const ivBytes = hexToBytes(ivHex);
  const ciphertextBytes = hexToBytes(ciphertextHex);
  
  const key = await deriveKey(password, saltBytes);
  
  const decryptedBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    key,
    ciphertextBytes
  );
  
  const decoder = new TextDecoder();
  return JSON.parse(decoder.decode(decryptedBuffer));
}
