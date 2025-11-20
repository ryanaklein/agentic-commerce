# Agentic Commerce

A simplified implementation of Visa's Trusted Agent Protocol (TAP) for AI agent authentication in e-commerce. Shop through Claude Desktop with cryptographic proof of agent identity.

**[What is TAP?](tap-improvements/README.md)** - Learn about the protocol concepts

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Example Usage](#example-usage)
- [API Documentation](#api-documentation)
- [MCP Tools](#mcp-tools)
- [Troubleshooting](#troubleshooting)
- [Project Structure](#project-structure)
- [Security Notes](#security-notes)

## Features

- ✅ **Full TAP Implementation** - RFC 9421 compliant HTTP Message Signatures
- ✅ **Ed25519 Cryptography** - Fast, secure asymmetric signatures
- ✅ **Conversational Shopping** - Natural language via Claude Desktop
- ✅ **Complete E-commerce Flow** - Browse → Cart → Checkout → Orders
- ✅ **Plain JavaScript** - No TypeScript, no build step
- ✅ **Simplified Architecture** - 2 services vs 5 in reference implementation

## Architecture

```
Claude Desktop (conversational UI)
    ↓ MCP Protocol
MCP Server (TAP Agent)
    ├─ RFC 9421 signature generation (Ed25519)
    ├─ Shopping tools (search, cart, checkout)
    └─ Agent registration
        ↓ HTTP + Signature Headers
Express Backend
    ├─ Signature verification middleware
    ├─ Agent registry (in-memory)
    ├─ Products, Cart, Orders APIs
    └─ SQLite database
```

**Key simplification:** No CDN proxy required. Signature verification happens directly in the backend via middleware.

## Quick Start

### 1. Install Dependencies

```bash
# Backend
cd backend
npm install

# MCP Server
cd ../mcp-server
npm install
```

### 2. Initialize Database

```bash
cd backend
npm run seed
```

This creates `commerce.db` with 20 sample products across Electronics, Clothing, and Home Goods.

### 3. Start Backend

```bash
cd backend
npm start
```

You should see:
```
🚀 Agentic Commerce Backend
📡 Server running on http://localhost:8000
🔒 RFC 9421 signature verification enabled
```

### 4. Configure Claude Desktop

**Find your Node.js path:**
```bash
which node
# Example output: /Users/yourname/.nvm/versions/node/v23.5.0/bin/node
```

**Edit your Claude Desktop config file:**

**Location:**
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

**Add this configuration (replace with YOUR paths):**

```json
{
  "mcpServers": {
    "agentic-commerce": {
      "command": "/full/path/to/your/node",
      "args": [
        "/full/path/to/agentic-commerce/mcp-server/index.js"
      ],
      "env": {
        "BACKEND_URL": "http://localhost:8000"
      }
    }
  }
}
```

**Critical:**
- Use **absolute paths**, not relative
- Use **your Node.js path** (not Claude Desktop's old Node v14)
- Replace `yourname` and paths with your actual system paths

### 5. Restart Claude Desktop

Completely quit (Cmd+Q / Alt+F4) and restart Claude Desktop.

### 6. Start Shopping!

Open Claude Desktop and try:

```
"Show me laptops under $1500"
"Add the MacBook Air to my cart"
"What's in my cart?"
"Checkout - ship to 123 Main St, San Francisco, CA 94102. Email: user@example.com"
"Show my order history for user@example.com"
```

## Installation

### Prerequisites

- **Node.js v20+** (v23.5.0 recommended)
- **Claude Desktop** - [Download here](https://claude.ai/download)
- **Git** - To clone this repository

### Detailed Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/ryanaklein/agentic-commerce.git
   cd agentic-commerce
   ```

2. **Install backend dependencies:**
   ```bash
   cd backend
   npm install
   npm run seed  # Creates database with sample products
   npm start     # Starts on port 8000
   ```

3. **Install MCP server dependencies:**
   ```bash
   cd ../mcp-server
   npm install
   ```

4. **Configure Claude Desktop** (see Quick Start step 4)

5. **Test the setup:**
   - Backend health check: `curl http://localhost:8000/health`
   - Ask Claude: "What products do you have?"

### First Run Behavior

When Claude Desktop first connects:
1. MCP server generates Ed25519 keypair
2. Registers with backend (sends public key)
3. Saves credentials to `.agent-config.json`
4. All subsequent requests are automatically signed

## Example Usage

### Search Products

```
"Show me electronics under $1000"
"Find running shoes"
"What laptops do you have?"
```

### Shopping Cart

```
"Add the iPhone 15 Pro to my cart"
"Add 2 white t-shirts"
"What's in my cart?"
"Remove the iPhone from my cart"
"Update t-shirt quantity to 3"
```

### Checkout

```
"Checkout with shipping to:
123 Main Street
San Francisco, CA 94102
Email: customer@example.com
Phone: 555-0123"
```

### Order History

```
"Show my orders for customer@example.com"
"What's the status of order #1?"
```

## API Documentation

All routes require RFC 9421 signatures except `/api/registry/register`.

### Products

- **`GET /api/products`** - List/search products
  - Query params: `q` (search), `category`, `minPrice`, `maxPrice`
  - Returns: Array of products with id, name, price, category, description

- **`GET /api/products/:id`** - Get product details
  - Returns: Single product object

### Cart

- **`POST /api/cart`** - Create new cart
  - Returns: `{ sessionId }`

- **`GET /api/cart/:sessionId`** - View cart
  - Returns: Cart with items and total

- **`POST /api/cart/:sessionId/items`** - Add item
  - Body: `{ productId, quantity }`

- **`PUT /api/cart/:sessionId/items/:productId`** - Update quantity
  - Body: `{ quantity }`

- **`DELETE /api/cart/:sessionId/items/:productId`** - Remove item

### Orders

- **`POST /api/cart/:sessionId/checkout`** - Complete purchase
  - Body: `{ shipping, email, phone, paymentMethod }`
  - Returns: Order object with orderId

- **`GET /api/orders?email=...`** - Order history

- **`GET /api/orders/:id`** - Order details

### Agent Registry

- **`POST /api/registry/register`** - Register agent (no signature required)
  - Body: `{ keyId, name, publicKey, algorithm }`

## MCP Tools

The MCP server provides these tools to Claude:

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_products` | Browse/search products | `query`, `category`, `minPrice`, `maxPrice` |
| `get_product` | Get product details | `productId` |
| `add_to_cart` | Add item to cart | `productId`, `quantity` |
| `view_cart` | See cart contents | None |
| `update_cart_item` | Change quantity | `productId`, `quantity` |
| `checkout` | Complete purchase | `shipping`, `email`, `phone` |
| `view_orders` | Order history | `email` |

All tools automatically include TAP signatures with requests.

## Troubleshooting

### "Missing signature headers"

**Cause:** MCP server not generating signatures

**Fix:**
1. Check if `.agent-config.json` exists in `mcp-server/`
2. Verify backend is running on port 8000
3. Check MCP logs: `~/Library/Logs/Claude/mcp-server-agentic-commerce.log`

### "Unknown agent" or "Agent not found in registry"

**Cause:** Agent not registered or backend restarted (in-memory registry lost)

**Fix:**
1. Delete `mcp-server/.agent-config.json`
2. Restart Claude Desktop
3. Agent will re-register automatically

### "Signature expired" or "Invalid timestamp"

**Cause:** Clock skew or old signature

**Solutions:**
- Signatures valid for 60 seconds only
- Check system clock is accurate
- Retry the request

### "Invalid signature"

**Causes:**
- Path mismatch (query params missing)
- Key mismatch (wrong keypair)
- Signature base string construction error

**Fix:**
1. Check backend logs for signature verification details
2. Verify public key matches private key
3. Delete `.agent-config.json` and re-register

### MCP Tools Not Showing in Claude

**Causes:**
- Config path is relative instead of absolute
- Node path incorrect (Claude using old Node v14)
- MCP server crashed on startup

**Fix:**
1. Use absolute paths in `claude_desktop_config.json`
2. Verify Node path: `which node`
3. Check MCP logs for startup errors
4. Completely restart Claude Desktop (quit, not just close window)

### Backend "EADDRINUSE" Error

**Cause:** Port 8000 already in use

**Fix:**
```bash
# Find process using port 8000
lsof -i :8000

# Kill it
kill -9 <PID>

# Or use different port
PORT=8001 npm start
```

## Project Structure

```
agentic-commerce/
├── backend/
│   ├── server.js          # Express app + API routes
│   ├── middleware.js      # RFC 9421 signature verification
│   ├── database.js        # SQLite setup with sql.js
│   ├── seed.js            # Sample product data
│   ├── package.json
│   └── README.md          # Backend documentation
├── mcp-server/
│   ├── index.js           # MCP server + shopping tools
│   ├── signature.js       # RFC 9421 signature generation
│   ├── package.json
│   └── README.md          # MCP server documentation
├── tap-improvements/
│   └── README.md          # TAP protocol introduction
├── .gitignore
└── README.md              # This file
```

### Generated Files (not in repo)

- `backend/commerce.db` - SQLite database (run `npm run seed`)
- `mcp-server/.agent-config.json` - Agent keypair (auto-generated)

## Security Notes

### What's Secure

- **Asymmetric cryptography** - Private key never leaves agent
- **Signature freshness** - Timestamps prevent replay attacks (60s window)
- **Unique signatures** - Nonce ensures each signature is single-use
- **Path binding** - Signatures tied to specific domain and path
- **All routes protected** - Except agent registration

### Current Limitations

- **In-memory registry** - Agent list lost on backend restart (use database for production)
- **No key rotation** - Implement keypair rotation for long-lived agents
- **Stubbed payments** - Replace with real payment processor (CyberSource, Stripe)
- **No rate limiting** - Add request throttling for production
- **Local storage only** - Private keys in `.agent-config.json` (use KMS/Vault for production)

### Production Recommendations

1. **Move agent registry to database** (PostgreSQL, MySQL)
2. **Use environment variables** for secrets
3. **Implement key rotation** (30-90 day lifecycle)
4. **Add rate limiting** (per agent)
5. **Use proper key storage** (AWS KMS, HashiCorp Vault)
6. **Enable HTTPS** (TLS certificates)
7. **Add monitoring** (signature verification failures, latency)
8. **Implement audit logging** (who did what when)

## How TAP Works

This implementation uses the **Trusted Agent Protocol (TAP)** to authenticate AI agents cryptographically.

**For full TAP concepts and protocol details:** [Read the TAP Introduction](tap-improvements/README.md)

### Quick Overview

1. **Agent Registration** (first run)
   - MCP server generates Ed25519 keypair
   - Sends public key to backend
   - Backend stores in registry

2. **Request Signing** (every API call)
   - MCP server creates signature covering: domain, path, timestamp, nonce
   - Signs with private key
   - Attaches signature headers to request

3. **Verification** (backend middleware)
   - Extracts key ID from signature
   - Looks up public key in registry
   - Verifies signature cryptographically
   - Checks timestamp validity
   - Accepts or rejects request

**Why it's secure:** Only the holder of the private key can create valid signatures. Merchants get public keys only, so compromising a merchant doesn't enable agent impersonation.

## Sample Products

The seeded database includes 20 products:

**Electronics:** MacBook Air M2 ($1,199), Dell XPS 13 ($1,099), iPhone 15 Pro ($999), Sony Headphones ($399), iPad Air ($599)

**Clothing:** T-Shirts ($25), Jeans ($69), Running Shoes ($89), Winter Jacket ($149), Sneakers ($120)

**Home Goods:** Office Chair ($299), Standing Desk ($499), Coffee Maker ($89), Bookshelf ($129), Desk Lamp ($79)

## Payment Integration

Currently uses stubbed payment:
```javascript
paymentMethod: 'cybersource_token_placeholder'
```

### To integrate real payments:

**1. Install payment SDK:**
```bash
cd backend
npm install cybersource-rest-client
```

**2. Update backend checkout route** (`backend/server.js`):
```javascript
const paymentResult = await cybersource.processPayment({
  token: paymentMethod,
  amount: total,
  currency: 'USD'
});

if (!paymentResult.success) {
  return res.status(400).json({ error: 'Payment failed' });
}
```

**3. Update MCP checkout tool** to collect payment info from user

## Debugging

### Backend Logs

```bash
cd backend
npm start
```

Shows:
- All incoming API requests
- Signature verification details
- Database queries
- Errors

### MCP Server Logs

**Location:**
- **macOS:** `~/Library/Logs/Claude/mcp-server-agentic-commerce.log`
- **Windows:** `%APPDATA%\Claude\Logs\mcp-server-agentic-commerce.log`

Shows:
- Tool invocations
- Signature generation
- API requests/responses
- Errors

### Manual Testing

**Test backend health:**
```bash
curl http://localhost:8000/health
```

**Test signature requirement (should fail with 401):**
```bash
curl http://localhost:8000/api/products
# Returns: {"error":"Missing signature headers"}
```

**View agent registry:**
The backend logs show registered agents on startup and registration.

## Next Steps

- [ ] Integrate real payment processor (CyberSource, Stripe)
- [ ] Move agent registry to database (PostgreSQL)
- [ ] Add product images and detailed descriptions
- [ ] Implement inventory management
- [ ] Add order tracking and shipping integration
- [ ] Implement key rotation
- [ ] Add rate limiting per agent
- [ ] Deploy to production (with HTTPS)
- [ ] Add monitoring and alerts
- [ ] Create admin dashboard

## Contributing

This is a reference implementation for learning and experimentation. Feel free to fork, modify, and adapt for your needs.

## License

MIT

## Credits

- [Model Context Protocol](https://modelcontextprotocol.io) by Anthropic
- [Visa Trusted Agent Protocol](https://github.com/visa/trusted-agent-protocol) specification
- [@noble/ed25519](https://github.com/paulmillr/noble-ed25519) for Ed25519 cryptography
- [sql.js](https://github.com/sql-js/sql.js) for SQLite in JavaScript
