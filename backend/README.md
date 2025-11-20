# Agentic Commerce Backend

Express.js server providing e-commerce APIs with RFC 9421 signature verification for agent authentication.

## Features

- **RFC 9421 Signature Verification** - Validates Ed25519 signatures on all protected routes
- **Agent Registry** - In-memory storage of agent public keys
- **E-commerce APIs** - Products, cart, orders, checkout
- **SQLite Database** - Lightweight, file-based storage with sql.js
- **No Build Step** - Plain JavaScript, runs directly with Node.js

## Quick Start

```bash
npm install
npm run seed  # Creates database with 20 sample products
npm start     # Runs on http://localhost:8000
```

## File Structure

```
backend/
├── server.js          # Express app + API routes
├── middleware.js      # RFC 9421 signature verification + agent registry
├── database.js        # SQLite schema and helpers (sql.js)
├── seed.js            # Sample product data
├── package.json
├── commerce.db        # Generated SQLite database
└── README.md          # This file
```

## API Routes

### Products

- `GET /api/products` - List/search products (requires signature)
  - Query params: `q`, `category`, `minPrice`, `maxPrice`
- `GET /api/products/:id` - Get product details (requires signature)

### Cart

- `POST /api/cart` - Create cart (requires signature)
- `GET /api/cart/:sessionId` - View cart (requires signature)
- `POST /api/cart/:sessionId/items` - Add item (requires signature)
- `PUT /api/cart/:sessionId/items/:productId` - Update quantity (requires signature)
- `DELETE /api/cart/:sessionId/items/:productId` - Remove item (requires signature)

### Orders

- `POST /api/cart/:sessionId/checkout` - Complete purchase (requires signature)
- `GET /api/orders` - Order history (requires signature, query: `email`)
- `GET /api/orders/:id` - Order details (requires signature)

### Agent Registry

- `POST /api/registry/register` - Register agent (**no signature required**)

### Health

- `GET /health` - Health check (no signature required)

## Signature Verification

All routes except `/health` and `/api/registry/register` require valid RFC 9421 signatures.

### How It Works

1. **Extract headers** - `Signature`, `Signature-Input`, `Signature-Agent`
2. **Parse parameters** - Extract keyId, created, expires, nonce from `Signature-Input`
3. **Lookup agent** - Fetch public key from in-memory registry
4. **Build signature base** - Construct RFC 9421 signature base string
5. **Verify** - Use Ed25519 to verify signature with public key
6. **Check timestamp** - Ensure signature not expired (60s window)

### Signature Base String Format

```
"@authority": localhost:8000
"@path": /api/products?q=laptop
"@signature-params": ("@authority" "@path"); created=1234567890; expires=1234567950; keyid="agent-123"; alg="ed25519"; nonce="abc123"; tag="agent-payer-auth"
```

See `middleware.js:buildSignatureBase()` for implementation.

## Agent Registry

The agent registry is an in-memory `Map` storing agent public keys.

**Structure:**
```javascript
{
  keyId: {
    name: "agent-name",
    publicKey: "hex-encoded-public-key",
    algorithm: "ed25519",
    registeredAt: "2025-01-01T00:00:00.000Z"
  }
}
```

**Limitations:**
- Lost on server restart (use database for production)
- No persistence across deployments
- No multi-instance support

**Production:** Replace with PostgreSQL/MySQL table or Redis.

## Database

Uses **sql.js** (pure JavaScript SQLite) for zero native dependencies.

### Schema

**Products:**
```sql
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price REAL NOT NULL,
  category TEXT,
  stock INTEGER DEFAULT 0
)
```

**Carts:**
```sql
CREATE TABLE carts (
  id TEXT PRIMARY KEY,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
```

**Cart Items:**
```sql
CREATE TABLE cart_items (
  id INTEGER PRIMARY KEY,
  cartId TEXT,
  productId INTEGER,
  quantity INTEGER,
  FOREIGN KEY (cartId) REFERENCES carts(id),
  FOREIGN KEY (productId) REFERENCES products(id)
)
```

**Orders:**
```sql
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  shippingAddress TEXT,
  total REAL NOT NULL,
  paymentMethod TEXT,
  status TEXT DEFAULT 'pending',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
)
```

**Order Items:**
```sql
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  orderId INTEGER,
  productId INTEGER,
  quantity INTEGER,
  price REAL,
  FOREIGN KEY (orderId) REFERENCES orders(id),
  FOREIGN KEY (productId) REFERENCES products(id)
)
```

## Environment Variables

No `.env` file needed. Defaults:

- `PORT` - Server port (default: 8000)

## Logging

The server logs:
- Incoming requests (method, path)
- Signature verification details (base string, public key, result)
- Database queries
- Errors with stack traces

Example log output:
```
🚀 Agentic Commerce Backend
📡 Server running on http://localhost:8000
🔒 RFC 9421 signature verification enabled

2025-01-20T12:00:00.000Z - GET /api/products?q=laptop
🔍 Signature verification:
  Base: "@authority": localhost:8000
"@path": /api/products?q=laptop
"@signature-params": ("@authority" "@path"); created=1234567890; ...
  Public key: 730d26d8cb387fde1e29776ed24aadecdcea7f9aa1612c38cb7cf8ad38716cc6
  Valid: true
```

## Security

### What's Protected

- All product queries
- Cart operations
- Checkout
- Order history

### What's Not Protected

- Health check
- Agent registration (first-time setup)

### Signature Requirements

- Must include `@authority` and `@path` components
- Must include `created` timestamp (not older than 60s)
- Must include `expires` timestamp
- Must include unique `nonce`
- Must be signed with registered agent's private key

## Production Considerations

1. **Move agent registry to database**
   ```javascript
   // Instead of Map, use:
   const agent = await db.query('SELECT * FROM agents WHERE keyId = ?', [keyId]);
   ```

2. **Add rate limiting**
   ```javascript
   const rateLimit = require('express-rate-limit');
   app.use(rateLimit({ windowMs: 60000, max: 100 }));
   ```

3. **Enable HTTPS**
   ```javascript
   const https = require('https');
   https.createServer(credentials, app).listen(443);
   ```

4. **Use environment variables**
   ```javascript
   const dbPath = process.env.DATABASE_URL;
   const port = process.env.PORT || 8000;
   ```

5. **Add monitoring**
   - Track signature verification failures
   - Monitor API latency
   - Alert on errors

## Testing

### Manual Testing

**Test health check:**
```bash
curl http://localhost:8000/health
# {"status":"ok"}
```

**Test signature requirement:**
```bash
curl http://localhost:8000/api/products
# {"error":"Missing signature headers"}
```

**Test with valid signature:** Use the MCP server to make authenticated requests.

### Troubleshooting

**Database errors:**
- Delete `commerce.db` and run `npm run seed` again

**"Unknown agent" errors:**
- Check if agent registered: Look for "Agent registered" in logs
- Restart both backend and MCP server

**Signature verification failing:**
- Check backend logs for signature base string
- Verify public key matches private key
- Ensure timestamps within 60s window

## Dependencies

- **express** - Web framework
- **cors** - Cross-origin support
- **sql.js** - SQLite in JavaScript (no native compilation)
- **@noble/ed25519** - Ed25519 signature verification

## License

MIT
