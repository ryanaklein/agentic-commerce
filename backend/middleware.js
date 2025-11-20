import * as ed25519 from '@noble/ed25519';
import { createHash } from 'crypto';

// Set up SHA-512 for ed25519
ed25519.etc.sha512Sync = (...m) => {
  return createHash('sha512').update(ed25519.etc.concatBytes(...m)).digest();
};

// In-memory agent registry (would be database in production)
export const agentRegistry = new Map();

// Helper to parse signature headers
function parseSignatureInput(signatureInput) {
  const match = signatureInput.match(/sig1=\((.*?)\);(.+)/);
  if (!match) {
    throw new Error('Invalid Signature-Input format');
  }

  const components = match[1]
    .split(' ')
    .map(c => c.replace(/"/g, ''));

  const params = {};
  const paramString = match[2];

  // Parse parameters - handle both quoted strings and numbers
  const paramMatches = paramString.matchAll(/(\w+)=("[^"]+"|[^;]+)/g);
  for (const [, key, value] of paramMatches) {
    // Remove quotes if present
    params[key] = value.replace(/"/g, '').trim();
  }

  return { components, ...params };
}

// Helper to extract signature value
function parseSignature(signatureHeader) {
  const match = signatureHeader.match(/sig1=:([^:]+):/);
  if (!match) {
    throw new Error('Invalid Signature format');
  }
  return match[1];
}

// Build signature base string per RFC 9421
function buildSignatureBase(req, components, params, signatureInput) {
  const lines = [];

  for (const component of components) {
    if (component === '@authority') {
      lines.push(`"@authority": ${req.get('host') || 'localhost:8000'}`);
    } else if (component === '@path') {
      // Include query string in path
      const fullPath = req.originalUrl || req.url;
      lines.push(`"@path": ${fullPath}`);
    }
  }

  // Add @signature-params as the last component
  const signatureParams = signatureInput.match(/sig1=(.+)/)[1];
  lines.push(`"@signature-params": ${signatureParams}`);

  return lines.join('\n');
}

// Verify Ed25519 signature
async function verifyEd25519Signature(signatureBase, signatureB64, publicKeyHex) {
  try {
    const signature = Buffer.from(signatureB64, 'base64');
    const message = new TextEncoder().encode(signatureBase);
    const publicKey = Buffer.from(publicKeyHex, 'hex');

    return await ed25519.verify(signature, message, publicKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Main signature verification middleware
export async function verifySignature(req, res, next) {
  try {
    // Skip verification for registration endpoint
    if (req.path === '/api/registry/register' && req.method === 'POST') {
      return next();
    }

    // Extract headers
    const signatureInput = req.get('Signature-Input');
    const signature = req.get('Signature');
    const signatureAgent = req.get('Signature-Agent');

    if (!signatureInput || !signature) {
      return res.status(401).json({
        error: 'Missing signature headers',
        message: 'Signature-Input and Signature headers are required'
      });
    }

    // Parse signature components
    const params = parseSignatureInput(signatureInput);
    const signatureValue = parseSignature(signature);

    // Get agent from registry
    const agent = agentRegistry.get(params.keyid);
    if (!agent) {
      return res.status(401).json({
        error: 'Unknown agent',
        message: `Agent with keyid "${params.keyid}" not found in registry`
      });
    }

    // Validate timestamp
    const now = Math.floor(Date.now() / 1000);

    // Extract created and expires from the parsed params
    const created = parseInt(params.created);
    const expires = parseInt(params.expires);

    if (!created || !expires || isNaN(created) || isNaN(expires)) {
      return res.status(401).json({
        error: 'Invalid timestamp',
        message: 'Signature must include created and expires parameters',
        debug: { created: params.created, expires: params.expires, params }
      });
    }

    if (created > now + 60) {
      return res.status(401).json({
        error: 'Signature from future',
        message: 'Signature created timestamp is in the future'
      });
    }

    if (expires < now) {
      return res.status(401).json({
        error: 'Signature expired',
        message: 'Signature has expired'
      });
    }

    if (expires - created > 300) {
      return res.status(401).json({
        error: 'Signature validity too long',
        message: 'Signature validity period exceeds 5 minutes'
      });
    }

    // Build signature base
    const signatureBase = buildSignatureBase(req, params.components, params, signatureInput);

    console.log('🔍 Signature verification:');
    console.log('  Base:', signatureBase);
    console.log('  Public key:', agent.publicKey);

    // Verify signature
    const isValid = await verifyEd25519Signature(
      signatureBase,
      signatureValue,
      agent.publicKey
    );

    console.log('  Valid:', isValid);

    if (!isValid) {
      return res.status(401).json({
        error: 'Invalid signature',
        message: 'Signature verification failed'
      });
    }

    // Attach agent info to request
    req.agent = {
      id: params.keyid,
      name: agent.name
    };

    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    return res.status(401).json({
      error: 'Signature verification failed',
      message: error.message
    });
  }
}

// Register a new agent
export function registerAgent(keyid, name, publicKey, algorithm = 'ed25519') {
  agentRegistry.set(keyid, {
    name,
    publicKey,
    algorithm,
    registeredAt: new Date().toISOString()
  });
  console.log(`✅ Agent registered: ${name} (${keyid})`);
  return { keyid, name };
}
