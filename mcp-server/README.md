# Agentic Commerce MCP Server

Model Context Protocol server that provides shopping tools to Claude Desktop with automatic RFC 9421 signature generation for agent authentication.

## Features

- **7 Shopping Tools** - Search, cart, checkout, orders
- **Automatic TAP Signatures** - RFC 9421 compliant, Ed25519 signed requests
- **Agent Registration** - Self-registers on first run
- **Session Management** - Maintains cart state across conversation
- **Plain JavaScript** - No build step required

## Quick Start

```bash
npm install
node index.js
```

**Note:** This server is designed to run via Claude Desktop, not standalone. See root README for Claude Desktop configuration.

## File Structure

```
mcp-server/
├── index.js           # MCP server + 7 shopping tools
├── signature.js       # RFC 9421 signature generation
├── package.json
├── .agent-config.json # Generated on first run (contains keypair)
└── README.md          # This file
```

## Tools Provided

### 1. search_products

Search and filter products.

**Parameters:**
- `query` (optional) - Text search
- `category` (optional) - Filter by category
- `minPrice` (optional) - Minimum price
- `maxPrice` (optional) - Maximum price

**Example:**
```
"Show me laptops under $1500"
→ search_products({ query: "laptop", maxPrice: 1500 })
```

### 2. get_product

Get detailed information about a specific product.

**Parameters:**
- `productId` (required) - Product ID

**Example:**
```
"Tell me more about product 3"
→ get_product({ productId: 3 })
```

### 3. add_to_cart

Add item to shopping cart (creates cart if needed).

**Parameters:**
- `productId` (required) - Product to add
- `quantity` (optional, default: 1) - Number of items

**Example:**
```
"Add 2 MacBook Airs to my cart"
→ add_to_cart({ productId: 1, quantity: 2 })
```

### 4. view_cart

View current cart contents and total.

**Parameters:** None

**Example:**
```
"What's in my cart?"
→ view_cart({})
```

### 5. update_cart_item

Change quantity or remove item from cart.

**Parameters:**
- `productId` (required) - Item to update
- `quantity` (required) - New quantity (0 to remove)

**Example:**
```
"Remove the iPhone from my cart"
→ update_cart_item({ productId: 3, quantity: 0 })

"Change t-shirt quantity to 3"
→ update_cart_item({ productId: 6, quantity: 3 })
```

### 6. checkout

Complete purchase and create order.

**Parameters:**
- `shipping` (required) - Shipping address object
  - `address`, `city`, `state`, `zip`
- `email` (required) - Customer email
- `phone` (optional) - Customer phone

**Example:**
```
"Checkout - ship to 123 Main St, San Francisco, CA 94102. Email: user@example.com"
→ checkout({
  shipping: { address: "123 Main St", city: "San Francisco", state: "CA", zip: "94102" },
  email: "user@example.com"
})
```

### 7. view_orders

View order history by email.

**Parameters:**
- `email` (required) - Customer email

**Example:**
```
"Show my orders for user@example.com"
→ view_orders({ email: "user@example.com" })
```

## How It Works

### First Run

1. **Generate keypair** - Creates Ed25519 private/public key
2. **Register with backend** - Sends public key to `/api/registry/register`
3. **Save config** - Stores credentials in `.agent-config.json`

### Subsequent Runs

1. **Load config** - Reads `.agent-config.json`
2. **Ready** - All tools available, requests automatically signed

### Request Flow

```
Claude invokes tool
    ↓
MCP server prepares request
    ↓
signature.js generates RFC 9421 signature
    ↓
Attaches headers: Signature, Signature-Input, Signature-Agent
    ↓
HTTP request to backend
    ↓
Backend verifies signature
    ↓
Response returned to Claude
```

## Signature Generation

All API requests include these headers:

```
Signature-Input: sig1=("@authority" "@path"); created=1234567890; expires=1234567950; keyid="agent-123"; alg="ed25519"; nonce="abc123"; tag="agent-payer-auth"
Signature: sig1=:BASE64_ED25519_SIGNATURE:
Signature-Agent: claude-desktop-agent
```

**Components signed:**
- `@authority` - Backend domain (localhost:8000)
- `@path` - Request path with query params
- `@signature-params` - Metadata (created, expires, keyid, etc.)

See `signature.js:generateSignature()` for implementation.

## Agent Configuration

The `.agent-config.json` file is auto-generated and contains:

```json
{
  "keyId": "agent-1234567890",
  "agentName": "claude-desktop-agent",
  "privateKey": "hex-encoded-ed25519-private-key",
  "publicKey": "hex-encoded-ed25519-public-key",
  "registeredAt": "2025-01-20T12:00:00.000Z"
}
```

**Security:**
- File is `.gitignore`d
- Private key never leaves this file
- Public key sent to backend during registration

**To reset:**
```bash
rm .agent-config.json
# Restart Claude Desktop - will re-register with new keypair
```

## Session Management

The MCP server maintains:
- `currentCartSessionId` - Active cart session
- Created on first `add_to_cart` call
- Cleared after successful `checkout`

## Environment Variables

Optional `.env` file:

```
BACKEND_URL=http://localhost:8000
```

Defaults to `http://localhost:8000` if not set.

## Logging

Logs are written by Claude Desktop to:
- **macOS:** `~/Library/Logs/Claude/mcp-server-agentic-commerce.log`
- **Windows:** `%APPDATA%\Claude\Logs\mcp-server-agentic-commerce.log`

**Log contents:**
- Tool invocations
- Signature generation
- HTTP requests and responses
- Errors

## Debugging

### Check if server is running

Look for "MCP server initialized" in Claude Desktop logs.

### Check agent registration

Backend logs should show:
```
Agent registered: claude-desktop-agent
```

### Test signature generation

The signature.js module logs signature components when generating.

### Common Issues

**"Backend not available":**
- Ensure backend is running: `curl http://localhost:8000/health`
- Check `BACKEND_URL` environment variable

**"Unknown agent" errors:**
- Delete `.agent-config.json`
- Restart Claude Desktop
- Check backend logs for new registration

**Tools not appearing in Claude:**
- Check Claude Desktop config has absolute paths
- Restart Claude completely (quit, not close)
- Check MCP logs for initialization errors

## Security Notes

- **Private key storage:** Stored in `.agent-config.json` (local file)
- **Production:** Use environment variables or key management service (AWS KMS, HashiCorp Vault)
- **Key rotation:** Manually delete `.agent-config.json` to generate new keypair
- **Signature freshness:** All signatures expire after 60 seconds

## Dependencies

- **@modelcontextprotocol/sdk** - MCP protocol implementation
- **@noble/ed25519** - Ed25519 signature generation
- **node-fetch** - HTTP requests (Node.js v18+ has native fetch)

## Testing

### Manual Tool Testing

You can test tools via Claude Desktop:

```
"Search for laptops"
"Add product 1 to cart with quantity 2"
"Show cart"
"Checkout to 123 Main St, SF, CA 94102, email test@example.com"
```

### Backend Integration

All tools make authenticated requests to backend. Backend logs show:
- Request received
- Signature verification (valid/invalid)
- Response status

## Extending

### Add New Tool

1. **Define tool schema:**
```javascript
{
  name: 'my_tool',
  description: 'What it does',
  inputSchema: {
    type: 'object',
    properties: {
      param: { type: 'string', description: 'Parameter desc' }
    },
    required: ['param']
  }
}
```

2. **Add handler:**
```javascript
case 'my_tool':
  const result = await apiRequest('GET', `/api/my-endpoint?param=${args.param}`);
  return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
```

3. **Restart Claude Desktop**

## Production Considerations

1. **Key storage:** Use secure key management
2. **Error handling:** Add retry logic for network failures
3. **Rate limiting:** Handle 429 responses
4. **Monitoring:** Track tool usage and errors
5. **Key rotation:** Implement automatic keypair rotation

## License

MIT
