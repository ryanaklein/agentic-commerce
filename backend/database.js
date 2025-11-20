import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, 'commerce.db');

let SQL;
let db;

// Initialize SQL.js
export async function initializeDatabase() {
  SQL = await initSqlJs();

  // Load existing database or create new one
  if (existsSync(DB_PATH)) {
    const buffer = readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
    console.log('✅ Database loaded');
  } else {
    db = new SQL.Database();
    console.log('✅ Database created');
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      price INTEGER NOT NULL,
      image_url TEXT,
      category TEXT,
      stock INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS carts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cart_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id),
      UNIQUE(cart_id, product_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      customer_name TEXT NOT NULL,
      customer_email TEXT NOT NULL,
      phone TEXT,
      shipping_address TEXT NOT NULL,
      payment_method TEXT,
      total INTEGER NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      price_at_purchase INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    )
  `);

  saveDatabase();
  return db;
}

// Save database to disk
export function saveDatabase() {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(DB_PATH, buffer);
}

// Helper to execute query and return results
function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

// Helper to execute query and return single result
function queryOne(sql, params = []) {
  const results = query(sql, params);
  return results.length > 0 ? results[0] : null;
}

// Helper to execute query and return last insert id
function execute(sql, params = []) {
  db.run(sql, params);
  saveDatabase();
  const result = queryOne('SELECT last_insert_rowid() as id');
  return result ? result.id : null;
}

// Products
export const productQueries = {
  getAll: () => query('SELECT * FROM products'),

  getById: (id) => queryOne('SELECT * FROM products WHERE id = ?', [id]),

  search: (q, category, minPrice, maxPrice) => {
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (q) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      const searchTerm = `%${q}%`;
      params.push(searchTerm, searchTerm);
    }

    if (minPrice) {
      sql += ' AND price >= ?';
      params.push(minPrice);
    }

    if (maxPrice) {
      sql += ' AND price <= ?';
      params.push(maxPrice);
    }

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    return query(sql, params);
  },

  create: (name, description, price, image_url, category, stock) => {
    return execute(
      'INSERT INTO products (name, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
      [name, description, price, image_url, category, stock]
    );
  }
};

// Carts
export const cartQueries = {
  create: (sessionId) => {
    return execute('INSERT INTO carts (session_id) VALUES (?)', [sessionId]);
  },

  getBySessionId: (sessionId) => {
    return queryOne('SELECT * FROM carts WHERE session_id = ?', [sessionId]);
  },

  getItems: (cartId) => {
    return query(`
      SELECT ci.*, p.name, p.price, p.image_url
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ?
    `, [cartId]);
  },

  addItem: (cartId, productId, quantity) => {
    // Check if item exists
    const existing = queryOne(
      'SELECT * FROM cart_items WHERE cart_id = ? AND product_id = ?',
      [cartId, productId]
    );

    if (existing) {
      // Update quantity
      db.run(
        'UPDATE cart_items SET quantity = quantity + ? WHERE cart_id = ? AND product_id = ?',
        [quantity, cartId, productId]
      );
    } else {
      // Insert new
      db.run(
        'INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)',
        [cartId, productId, quantity]
      );
    }
    saveDatabase();
  },

  updateItem: (cartId, productId, quantity) => {
    db.run(
      'UPDATE cart_items SET quantity = ? WHERE cart_id = ? AND product_id = ?',
      [quantity, cartId, productId]
    );
    saveDatabase();
  },

  removeItem: (cartId, productId) => {
    db.run('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?', [cartId, productId]);
    saveDatabase();
  },

  clear: (cartId) => {
    db.run('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    saveDatabase();
  }
};

// Orders
export const orderQueries = {
  create: (orderNumber, customerName, customerEmail, phone, shippingAddress, paymentMethod, total, status) => {
    return execute(
      'INSERT INTO orders (order_number, customer_name, customer_email, phone, shipping_address, payment_method, total, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNumber, customerName, customerEmail, phone, shippingAddress, paymentMethod, total, status]
    );
  },

  createItem: (orderId, productId, quantity, priceAtPurchase) => {
    return execute(
      'INSERT INTO order_items (order_id, product_id, quantity, price_at_purchase) VALUES (?, ?, ?, ?)',
      [orderId, productId, quantity, priceAtPurchase]
    );
  },

  getById: (id) => {
    return queryOne('SELECT * FROM orders WHERE id = ?', [id]);
  },

  getByEmail: (email) => {
    return query('SELECT * FROM orders WHERE customer_email = ? ORDER BY created_at DESC', [email]);
  },

  getItems: (orderId) => {
    return query(`
      SELECT oi.*, p.name, p.image_url
      FROM order_items oi
      JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `, [orderId]);
  }
};

export function getDatabase() {
  return db;
}
