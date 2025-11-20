# Trusted Agent Protocol (TAP) - Developer Introduction

A clear, conceptual guide to understanding TAP for developers exploring it for the first time.

---

## What is TAP?

The Trusted Agent Protocol (TAP) is a way for AI agents to prove their identity to merchants using cryptographic signatures. It's standard public key cryptography applied to HTTP requests—agents sign their requests, merchants verify the signatures.

Think of it like SSH keys or TLS client certificates, but designed specifically for AI agents interacting with merchant APIs.

---

## The Problem It Solves

Merchants need to distinguish between:
- **Legitimate AI agents** acting on behalf of real users
- **Malicious bots** scraping data or committing fraud
- **Unauthorized automation** that violates terms of service

Without a standard, merchants face a choice: block all automated traffic (losing business) or accept the risk (fraud, abuse).

TAP provides a middle ground: cryptographically verified agent identities with granular permissions.

---

## How It Works

TAP follows a simple three-step flow:

### 1. Registration (one-time setup)

```
Agent generates keypair → Registers public key in directory → Gets unique key ID
```

The agent creates a public/private keypair and registers the public key in a central directory (or directly with merchants). The private key stays secret on the agent's side.

### 2. Request Signing (every API call)

```
Agent creates signature → Signs with private key → Attaches headers to HTTP request
```

For each request, the agent builds a signature covering:
- Domain and path (`@authority`, `@path`)
- Timestamp (prevents replay attacks)
- Nonce (prevents reuse)
- Action tag (permission level: browse vs checkout)

The signature is generated using the private key and attached as HTTP headers.

### 3. Verification (merchant side)

```
Merchant receives request → Looks up public key → Verifies signature → Accepts or rejects
```

The merchant:
1. Extracts the key ID from the signature headers
2. Looks up the corresponding public key (from registry or local storage)
3. Verifies the signature cryptographically
4. If valid, trusts the agent and processes the request

---

## Key Concepts

### Asymmetric Cryptography
- **Agent** has the private key (signs requests)
- **Merchant** has the public key (verifies signatures)
- Private key never leaves the agent
- Even if a merchant is compromised, attacker can't impersonate the agent

### RFC 9421 HTTP Message Signatures
TAP uses the [RFC 9421](https://datatracker.ietf.org/doc/html/rfc9421) standard for signing HTTP messages. This defines how to construct signature base strings and format signature headers.

### Action Tags
Signatures include an "action tag" indicating intent:
- `"agent-browser-auth"` - Browsing/viewing products
- `"agent-payer-auth"` - Making purchases/checkout

This enables permission-based access control. The tag is part of the signed message, so it can't be tampered with.

### Agent Registry
A directory mapping key IDs to public keys. Can be:
- **Centralized** (e.g., Visa-hosted) - Shared trust anchor
- **Decentralized** - Each merchant maintains their own
- **Hybrid** - Mix of both approaches

The registry is conceptually just a key-value store: `keyId → publicKey`. It doesn't need to be complex.

---

## Quick Example

### Agent Side (Signing)

```javascript
import { sign } from '@noble/ed25519';

// Build signature base string (RFC 9421)
const signatureBase = [
  '"@authority": merchant.com',
  '"@path": /api/products',
  '"@signature-params": ("@authority" "@path"); created=1234567890; keyid="agent-123"; alg="ed25519"'
].join('\n');

// Sign with private key
const signature = await sign(signatureBase, privateKey);

// Attach headers to request
const headers = {
  'Signature-Input': 'sig1=("@authority" "@path"); created=1234567890; keyid="agent-123"; alg="ed25519"',
  'Signature': `sig1=:${base64(signature)}:`
};
```

### Merchant Side (Verifying)

```javascript
import { verify } from '@noble/ed25519';

// Extract key ID from signature headers
const keyId = extractKeyId(req.headers['signature-input']);

// Look up public key
const publicKey = await registry.getPublicKey(keyId);

// Rebuild signature base string from request
const signatureBase = buildSignatureBase(req);

// Verify signature
const isValid = await verify(signature, signatureBase, publicKey);

if (isValid) {
  // Process request
} else {
  // Reject with 401
}
```

---

## What You Need

### If You're Building an Agent

- [ ] Generate Ed25519 or RSA keypair
- [ ] Register public key (with Visa registry or directly with merchants)
- [ ] Store private key securely
- [ ] Implement RFC 9421 signature generation
- [ ] Include appropriate action tags based on operation
- [ ] Attach signature headers to all requests

### If You're a Merchant

- [ ] Decide on registry approach (use Visa's, self-host, or manual)
- [ ] Implement RFC 9421 signature verification
- [ ] Set up middleware to verify signatures on protected routes
- [ ] Define action tag policies (what agents can do what)
- [ ] Handle verification errors (401 responses)
- [ ] Optional: Implement agent allowlist/blocklist

---

## Try It Out

### Simplified Demo

We've built a minimal implementation showing TAP in action:

```bash
# In this repo
cd ../backend
npm install
npm start

# In another terminal
cd ../mcp-server
npm install
node index.js
```

This runs a working TAP flow with:
- Agent signing requests with Ed25519
- Merchant verifying signatures via middleware
- In-memory agent registry (no database needed)

**Total code:** ~300 lines vs 2,000+ in the reference implementation.

---

## Protocol Details

### Signature Components (RFC 9421)

TAP signatures cover these HTTP message components:
- `@authority` - The host/domain
- `@path` - The request path (including query params)
- `@signature-params` - Metadata about the signature itself

Additional signature parameters:
- `created` - Unix timestamp when signature was created
- `expires` - Unix timestamp when signature expires
- `nonce` - Random value for single-use
- `keyid` - Agent's public key identifier
- `alg` - Signature algorithm (ed25519 or rsa-pss-sha256)
- `tag` - Action tag for permission control

### Supported Algorithms

- **Ed25519** (recommended) - Fast elliptic curve signatures, 256-bit keys
- **RSA-PSS-SHA256** - Traditional RSA with PSS padding, 2048-bit keys

Ed25519 is preferred for performance and smaller key sizes.

### Security Properties

- **Non-repudiation** - Only holder of private key can create signatures
- **Integrity** - Any modification invalidates the signature
- **Replay protection** - Timestamps and nonces prevent reuse
- **Context binding** - Signatures tied to specific domain and path
- **Freshness** - Expiration timestamps limit validity window

---

## Going Deeper

### Specifications
- [RFC 9421: HTTP Message Signatures](https://datatracker.ietf.org/doc/html/rfc9421)
- [Visa TAP Documentation](https://github.com/visa/trusted-agent-protocol)

### Reference Implementation
- [Visa TAP GitHub](https://github.com/visa/trusted-agent-protocol) - Full multi-service architecture

### Libraries
- [@noble/ed25519](https://github.com/paulmillr/noble-ed25519) - Ed25519 for JavaScript
- [cryptography](https://cryptography.io/) - Python cryptography library

### Related Concepts
- **SSH Public Key Authentication** - Same pattern, different protocol
- **TLS Client Certificates** - Browser-to-server authentication
- **AWS Signature V4** - API request signing
- **DKIM** - Email authentication via signatures

---

## FAQ

**Q: Is TAP novel cryptography?**
A: No, it's standard asymmetric key authentication applied to AI agent commerce. The value is in standardization, not cryptographic innovation.

**Q: Do I need to use Visa's registry?**
A: No. The registry is just `keyId → publicKey` storage. You can self-host, use Visa's, or manage keys manually.

**Q: Why not just use OAuth or API keys?**
A: TAP provides non-repudiation (can't deny making a request) and doesn't require pre-shared secrets. It's designed for agent-to-merchant interactions where trust needs to scale across many parties.

**Q: What if my private key is compromised?**
A: Revoke the key in the registry and generate a new keypair. All future signature verifications for that key will fail.

**Q: Can I use TAP with existing APIs?**
A: Yes. TAP is just additional HTTP headers. Your existing API logic doesn't change—you add signature verification as middleware.

---

## Next Steps

1. **Explore the simplified demo** in this repo (`../backend` and `../mcp-server`)
2. **Read RFC 9421** to understand signature construction
3. **Choose a crypto library** for your language (Ed25519 recommended)
4. **Prototype signature generation** for a simple request
5. **Prototype verification** using a test public key

Questions or feedback? Open an issue or discussion in this repo.
