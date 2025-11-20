import * as ed25519 from '@noble/ed25519';
import { randomBytes, createHash } from 'crypto';

// Set up SHA-512 for ed25519
ed25519.etc.sha512Sync = (...m) => {
  return createHash('sha512').update(ed25519.etc.concatBytes(...m)).digest();
};

/**
 * Generate RFC 9421 HTTP Message Signature
 * @param {string} authority - The @authority component (e.g., "localhost:8000")
 * @param {string} path - The @path component (e.g., "/api/products")
 * @param {string} keyId - The key identifier
 * @param {Uint8Array} privateKey - Ed25519 private key
 * @returns {Object} Signature headers
 */
export async function generateSignature(authority, path, keyId, privateKey) {
  // Generate signature parameters
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 60; // Valid for 60 seconds
  const nonce = randomBytes(16).toString('hex');

  // Build signature params string
  const signatureParams = `("@authority" "@path"); created=${created}; expires=${expires}; keyid="${keyId}"; alg="ed25519"; nonce="${nonce}"; tag="agent-payer-auth"`;

  // Build signature base string per RFC 9421
  const signatureBase = [
    `"@authority": ${authority}`,
    `"@path": ${path}`,
    `"@signature-params": ${signatureParams}`
  ].join('\n');

  console.error('🔏 MCP Signing:');
  console.error('  Base:', signatureBase);
  console.error('  Private key length:', privateKey.length);

  // Sign with Ed25519 private key
  const message = new TextEncoder().encode(signatureBase);
  const signature = await ed25519.sign(message, privateKey);

  console.error('  Signature length:', signature.length);

  // Encode signature as base64
  const signatureB64 = Buffer.from(signature).toString('base64');

  // Build signature headers - MUST match signatureParams exactly
  const signatureInput = `sig1=${signatureParams}`;
  const signatureHeader = `sig1=:${signatureB64}:`;

  return {
    'Signature-Input': signatureInput,
    'Signature': signatureHeader,
    'Signature-Agent': 'claude-desktop-agent'
  };
}

/**
 * Generate Ed25519 keypair
 * @returns {Object} { privateKey, publicKey } in hex format
 */
export async function generateKeypair() {
  const privateKey = ed25519.utils.randomPrivateKey();
  const publicKey = await ed25519.getPublicKey(privateKey);

  return {
    privateKey: Buffer.from(privateKey).toString('hex'),
    publicKey: Buffer.from(publicKey).toString('hex')
  };
}
