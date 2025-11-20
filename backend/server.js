import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { initializeDatabase, productQueries, cartQueries, orderQueries } from './database.js';
import { verifySignature, registerAgent } from './middleware.js';

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Initialize database (async)
await initializeDatabase();

// =============================================================================
// AGENT REGISTRY ROUTES (No signature required for registration)
// =============================================================================

app.post('/api/registry/register', (req, res) => {
  try {
    const { keyid, name, publicKey, algorithm } = req.body;

    if (!keyid || !name || !publicKey) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['keyid', 'name', 'publicKey']
      });
    }

    const agent = registerAgent(keyid, name, publicKey, algorithm);
    res.json({
      success: true,
      agent
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// PRODUCT ROUTES (Signature required)
// =============================================================================

app.get('/api/products', verifySignature, (req, res) => {
  try {
    const { q, category, minPrice, maxPrice } = req.query;

    let products;

    if (q || category || minPrice || maxPrice) {
      // Search with filters
      const min = minPrice ? parseInt(minPrice) : null;
      const max = maxPrice ? parseInt(maxPrice) : null;

      products = productQueries.search(q, category, min, max);
    } else {
      // Get all products
      products = productQueries.getAll();
    }

    res.json({
      products,
      count: products.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/products/:id', verifySignature, (req, res) => {
  try {
    const product = productQueries.getById(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(product);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CART ROUTES (Signature required)
// =============================================================================

app.post('/api/cart', verifySignature, (req, res) => {
  try {
    const sessionId = randomUUID();
    const cartId = cartQueries.create(sessionId);

    res.json({
      sessionId,
      cartId,
      items: [],
      total: 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/cart/:sessionId', verifySignature, (req, res) => {
  try {
    const cart = cartQueries.getBySessionId(req.params.sessionId);

    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const items = cartQueries.getItems(cart.id);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      sessionId: cart.session_id,
      cartId: cart.id,
      items,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/cart/:sessionId/items', verifySignature, (req, res) => {
  try {
    const { productId, quantity } = req.body;

    if (!productId || !quantity) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['productId', 'quantity']
      });
    }

    const cart = cartQueries.getBySessionId(req.params.sessionId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const product = productQueries.getById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    if (product.stock < quantity) {
      return res.status(400).json({
        error: 'Insufficient stock',
        available: product.stock
      });
    }

    cartQueries.addItem(cart.id, productId, quantity);

    // Return updated cart
    const items = cartQueries.getItems(cart.id);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      sessionId: cart.session_id,
      items,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cart/:sessionId/items/:productId', verifySignature, (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity === undefined) {
      return res.status(400).json({
        error: 'Missing required field: quantity'
      });
    }

    const cart = cartQueries.getBySessionId(req.params.sessionId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    if (quantity === 0) {
      cartQueries.removeItem(cart.id, req.params.productId);
    } else {
      cartQueries.updateItem(cart.id, req.params.productId, quantity);
    }

    // Return updated cart
    const items = cartQueries.getItems(cart.id);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      sessionId: cart.session_id,
      items,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cart/:sessionId/items/:productId', verifySignature, (req, res) => {
  try {
    const cart = cartQueries.getBySessionId(req.params.sessionId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    cartQueries.removeItem(cart.id, req.params.productId);

    // Return updated cart
    const items = cartQueries.getItems(cart.id);
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({
      sessionId: cart.session_id,
      items,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// CHECKOUT ROUTE (Signature required - most critical!)
// =============================================================================

app.post('/api/cart/:sessionId/checkout', verifySignature, (req, res) => {
  try {
    const { customerName, customerEmail, phone, shippingAddress, paymentMethod } = req.body;

    if (!customerName || !customerEmail || !shippingAddress) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['customerName', 'customerEmail', 'shippingAddress']
      });
    }

    const cart = cartQueries.getBySessionId(req.params.sessionId);
    if (!cart) {
      return res.status(404).json({ error: 'Cart not found' });
    }

    const items = cartQueries.getItems(cart.id);
    if (items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate total
    const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    // Generate order number
    const orderNumber = `ORD-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${randomUUID().slice(0, 8).toUpperCase()}`;

    // Convert shipping address to string if it's an object
    const shippingAddressStr = typeof shippingAddress === 'object'
      ? JSON.stringify(shippingAddress)
      : shippingAddress;

    // Create order
    const orderId = orderQueries.create(
      orderNumber,
      customerName,
      customerEmail,
      phone || null,
      shippingAddressStr,
      paymentMethod || 'cybersource_token_placeholder',
      total,
      'confirmed'
    );

    // Create order items
    for (const item of items) {
      orderQueries.createItem(
        orderId,
        item.product_id,
        item.quantity,
        item.price
      );
    }

    // Clear cart
    cartQueries.clear(cart.id);

    // Get complete order
    const order = orderQueries.getById(orderId);
    const orderItems = orderQueries.getItems(orderId);

    res.json({
      success: true,
      order: {
        ...order,
        items: orderItems,
        shippingAddress: typeof shippingAddress === 'object'
          ? shippingAddress
          : JSON.parse(shippingAddressStr)
      }
    });
  } catch (error) {
    console.error('Checkout error:', error);
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// ORDER ROUTES (Signature required)
// =============================================================================

app.get('/api/orders', verifySignature, (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        error: 'Email parameter required'
      });
    }

    const orders = orderQueries.getByEmail(email);

    // Add items to each order
    const ordersWithItems = orders.map(order => ({
      ...order,
      items: orderQueries.getItems(order.id)
    }));

    res.json({
      orders: ordersWithItems,
      count: ordersWithItems.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/orders/:id', verifySignature, (req, res) => {
  try {
    const order = orderQueries.getById(req.params.id);

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const items = orderQueries.getItems(order.id);

    res.json({
      ...order,
      items,
      shippingAddress: JSON.parse(order.shipping_address)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// =============================================================================
// HEALTH CHECK (No signature required)
// =============================================================================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'agentic-commerce-backend'
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n🚀 Agentic Commerce Backend');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🔒 RFC 9421 signature verification enabled`);
  console.log(`\n💡 Endpoints:`);
  console.log(`   POST /api/registry/register - Register agent (no signature)`);
  console.log(`   GET  /api/products - List products`);
  console.log(`   POST /api/cart - Create cart`);
  console.log(`   POST /api/cart/:id/checkout - Complete purchase`);
  console.log(`   GET  /api/orders - View orders`);
  console.log(`\n✅ Ready for MCP connections!\n`);
});
