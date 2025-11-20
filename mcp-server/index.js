#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { generateSignature, generateKeypair } from './signature.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:8000';
const CONFIG_FILE = join(__dirname, '.agent-config.json');

// Agent state
let agentConfig = null;
let currentCartSessionId = null;

// =============================================================================
// AGENT INITIALIZATION
// =============================================================================

async function initializeAgent() {
  try {
    // Check if config exists
    if (existsSync(CONFIG_FILE)) {
      agentConfig = JSON.parse(readFileSync(CONFIG_FILE, 'utf-8'));
      console.error('✅ Agent config loaded');
      return;
    }

    // Generate new keypair
    console.error('🔑 Generating new Ed25519 keypair...');
    const { privateKey, publicKey } = await generateKeypair();

    const keyId = `agent-${Date.now()}`;
    const agentName = 'claude-desktop-agent';

    // Register with backend
    console.error('📝 Registering agent with backend...');
    const response = await axios.post(`${BACKEND_URL}/api/registry/register`, {
      keyid: keyId,
      name: agentName,
      publicKey: publicKey,
      algorithm: 'ed25519'
    });

    // Save config
    agentConfig = {
      keyId,
      agentName,
      privateKey,
      publicKey,
      registeredAt: new Date().toISOString()
    };

    writeFileSync(CONFIG_FILE, JSON.stringify(agentConfig, null, 2));
    console.error('✅ Agent registered and config saved');
    console.error(`   Agent ID: ${keyId}`);
  } catch (error) {
    console.error('❌ Agent initialization failed:', error.message);
    throw error;
  }
}

// =============================================================================
// HTTP CLIENT WITH SIGNATURES
// =============================================================================

async function apiRequest(method, path, data = null) {
  try {
    const authority = BACKEND_URL.replace('http://', '').replace('https://', '');
    const privateKeyBuffer = Buffer.from(agentConfig.privateKey, 'hex');

    // Generate signature
    const signatureHeaders = await generateSignature(
      authority,
      path,
      agentConfig.keyId,
      privateKeyBuffer
    );

    // Make request
    const config = {
      method,
      url: `${BACKEND_URL}${path}`,
      headers: {
        'Content-Type': 'application/json',
        ...signatureHeaders
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`API Error: ${error.response.data.error || error.response.statusText}`);
    }
    throw error;
  }
}

// =============================================================================
// MCP SERVER SETUP
// =============================================================================

const server = new Server(
  {
    name: 'agentic-commerce',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_products',
        description: 'Search and browse products in the store. Can filter by query text, category, and price range.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search query to match product names or descriptions'
            },
            category: {
              type: 'string',
              description: 'Filter by category (electronics, clothing, home)',
              enum: ['electronics', 'clothing', 'home']
            },
            minPrice: {
              type: 'number',
              description: 'Minimum price in cents (e.g., 1000 for $10.00)'
            },
            maxPrice: {
              type: 'number',
              description: 'Maximum price in cents (e.g., 50000 for $500.00)'
            }
          }
        }
      },
      {
        name: 'get_product',
        description: 'Get detailed information about a specific product by ID',
        inputSchema: {
          type: 'object',
          properties: {
            productId: {
              type: 'number',
              description: 'The product ID'
            }
          },
          required: ['productId']
        }
      },
      {
        name: 'add_to_cart',
        description: 'Add a product to the shopping cart. Creates a new cart if one doesn\'t exist.',
        inputSchema: {
          type: 'object',
          properties: {
            productId: {
              type: 'number',
              description: 'The product ID to add'
            },
            quantity: {
              type: 'number',
              description: 'Quantity to add (default: 1)',
              default: 1
            }
          },
          required: ['productId']
        }
      },
      {
        name: 'view_cart',
        description: 'View the current shopping cart with all items and total',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'update_cart_item',
        description: 'Update the quantity of an item in the cart. Set quantity to 0 to remove.',
        inputSchema: {
          type: 'object',
          properties: {
            productId: {
              type: 'number',
              description: 'The product ID to update'
            },
            quantity: {
              type: 'number',
              description: 'New quantity (0 to remove)'
            }
          },
          required: ['productId', 'quantity']
        }
      },
      {
        name: 'checkout',
        description: 'Complete the purchase with customer information and shipping address. Requires an active cart with items.',
        inputSchema: {
          type: 'object',
          properties: {
            customerName: {
              type: 'string',
              description: 'Customer full name'
            },
            customerEmail: {
              type: 'string',
              description: 'Customer email address'
            },
            phone: {
              type: 'string',
              description: 'Customer phone number (optional)'
            },
            shippingAddress: {
              type: 'object',
              description: 'Shipping address',
              properties: {
                street: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                zip: { type: 'string' }
              },
              required: ['street', 'city', 'state', 'zip']
            }
          },
          required: ['customerName', 'customerEmail', 'shippingAddress']
        }
      },
      {
        name: 'view_orders',
        description: 'View order history for a customer by email address',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Customer email address'
            }
          },
          required: ['email']
        }
      }
    ]
  };
});

// =============================================================================
// TOOL HANDLERS
// =============================================================================

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // -----------------------------------------------------------------------
      // SEARCH PRODUCTS
      // -----------------------------------------------------------------------
      case 'search_products': {
        const params = new URLSearchParams();
        if (args.query) params.append('q', args.query);
        if (args.category) params.append('category', args.category);
        if (args.minPrice) params.append('minPrice', args.minPrice.toString());
        if (args.maxPrice) params.append('maxPrice', args.maxPrice.toString());

        const queryString = params.toString();
        const path = `/api/products${queryString ? '?' + queryString : ''}`;

        const result = await apiRequest('GET', path);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // -----------------------------------------------------------------------
      // GET PRODUCT
      // -----------------------------------------------------------------------
      case 'get_product': {
        const result = await apiRequest('GET', `/api/products/${args.productId}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // -----------------------------------------------------------------------
      // ADD TO CART
      // -----------------------------------------------------------------------
      case 'add_to_cart': {
        // Create cart if needed
        if (!currentCartSessionId) {
          const cartResult = await apiRequest('POST', '/api/cart');
          currentCartSessionId = cartResult.sessionId;
        }

        // Add item
        const result = await apiRequest(
          'POST',
          `/api/cart/${currentCartSessionId}/items`,
          {
            productId: args.productId,
            quantity: args.quantity || 1
          }
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // -----------------------------------------------------------------------
      // VIEW CART
      // -----------------------------------------------------------------------
      case 'view_cart': {
        if (!currentCartSessionId) {
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({ items: [], total: 0, message: 'Cart is empty' }, null, 2)
            }]
          };
        }

        const result = await apiRequest('GET', `/api/cart/${currentCartSessionId}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // -----------------------------------------------------------------------
      // UPDATE CART ITEM
      // -----------------------------------------------------------------------
      case 'update_cart_item': {
        if (!currentCartSessionId) {
          throw new Error('No active cart');
        }

        const result = await apiRequest(
          'PUT',
          `/api/cart/${currentCartSessionId}/items/${args.productId}`,
          { quantity: args.quantity }
        );

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // -----------------------------------------------------------------------
      // CHECKOUT
      // -----------------------------------------------------------------------
      case 'checkout': {
        if (!currentCartSessionId) {
          throw new Error('No active cart');
        }

        const result = await apiRequest(
          'POST',
          `/api/cart/${currentCartSessionId}/checkout`,
          {
            customerName: args.customerName,
            customerEmail: args.customerEmail,
            phone: args.phone,
            shippingAddress: args.shippingAddress,
            paymentMethod: 'cybersource_token_placeholder'
          }
        );

        // Clear cart after successful checkout
        currentCartSessionId = null;

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      // -----------------------------------------------------------------------
      // VIEW ORDERS
      // -----------------------------------------------------------------------
      case 'view_orders': {
        const result = await apiRequest('GET', `/api/orders?email=${encodeURIComponent(args.email)}`);

        return {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }]
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }],
      isError: true
    };
  }
});

// =============================================================================
// START SERVER
// =============================================================================

async function main() {
  console.error('🚀 Starting Agentic Commerce MCP Server...\n');

  await initializeAgent();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('\n✅ MCP Server ready!');
  console.error('🔗 Connected to backend:', BACKEND_URL);
  console.error('🛍️  Ready to shop!\n');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
