import { initializeDatabase, productQueries } from './database.js';

await initializeDatabase();

const sampleProducts = [
  // Electronics
  {
    name: 'MacBook Air M2',
    description: '13-inch laptop with M2 chip, 8GB RAM, 256GB SSD. Perfect for everyday computing and creative work.',
    price: 119900, // $1,199.00 in cents
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=MacBook+Air',
    category: 'electronics',
    stock: 15
  },
  {
    name: 'Dell XPS 13',
    description: 'Premium ultrabook with Intel i7, 16GB RAM, 512GB SSD. Beautiful InfinityEdge display.',
    price: 109900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=Dell+XPS',
    category: 'electronics',
    stock: 8
  },
  {
    name: 'Lenovo ThinkPad X1',
    description: 'Business laptop with legendary keyboard, 14-inch display, 16GB RAM, 512GB SSD.',
    price: 99900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=ThinkPad',
    category: 'electronics',
    stock: 12
  },
  {
    name: 'iPhone 15 Pro',
    description: 'Latest iPhone with A17 Pro chip, titanium design, 256GB storage.',
    price: 99900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=iPhone+15',
    category: 'electronics',
    stock: 25
  },
  {
    name: 'Samsung Galaxy S24',
    description: 'Flagship Android phone with incredible camera, 256GB storage.',
    price: 79900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=Galaxy+S24',
    category: 'electronics',
    stock: 18
  },
  {
    name: 'Sony WH-1000XM5',
    description: 'Premium noise-cancelling wireless headphones with industry-leading sound quality.',
    price: 39900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=Sony+Headphones',
    category: 'electronics',
    stock: 30
  },
  {
    name: 'AirPods Pro',
    description: 'Apple wireless earbuds with active noise cancellation and spatial audio.',
    price: 24900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=AirPods',
    category: 'electronics',
    stock: 50
  },
  {
    name: 'iPad Air',
    description: '10.9-inch tablet with M1 chip, 64GB storage. Perfect for creativity and productivity.',
    price: 59900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=iPad+Air',
    category: 'electronics',
    stock: 20
  },

  // Clothing
  {
    name: 'Classic White T-Shirt',
    description: '100% cotton, comfortable fit. Essential wardrobe staple.',
    price: 2500,
    image_url: 'https://via.placeholder.com/400x300/28a745/fff?text=White+Tee',
    category: 'clothing',
    stock: 100
  },
  {
    name: 'Denim Jeans',
    description: 'Classic blue jeans, regular fit. Durable and stylish.',
    price: 6900,
    image_url: 'https://via.placeholder.com/400x300/28a745/fff?text=Jeans',
    category: 'clothing',
    stock: 75
  },
  {
    name: 'Running Shoes',
    description: 'Lightweight athletic shoes with excellent cushioning and support.',
    price: 8900,
    image_url: 'https://via.placeholder.com/400x300/28a745/fff?text=Shoes',
    category: 'clothing',
    stock: 40
  },
  {
    name: 'Winter Jacket',
    description: 'Warm insulated jacket, water-resistant. Perfect for cold weather.',
    price: 14900,
    image_url: 'https://via.placeholder.com/400x300/28a745/fff?text=Jacket',
    category: 'clothing',
    stock: 25
  },

  // Home Goods
  {
    name: 'Office Chair',
    description: 'Ergonomic office chair with lumbar support and adjustable height.',
    price: 29900,
    image_url: 'https://via.placeholder.com/400x300/ffc107/000?text=Office+Chair',
    category: 'home',
    stock: 15
  },
  {
    name: 'Standing Desk',
    description: 'Adjustable height standing desk, 60x30 inches. Electric motor.',
    price: 49900,
    image_url: 'https://via.placeholder.com/400x300/ffc107/000?text=Desk',
    category: 'home',
    stock: 10
  },
  {
    name: 'Coffee Maker',
    description: 'Programmable coffee maker with thermal carafe. Makes perfect coffee every time.',
    price: 8900,
    image_url: 'https://via.placeholder.com/400x300/ffc107/000?text=Coffee+Maker',
    category: 'home',
    stock: 35
  },
  {
    name: 'Table Lamp',
    description: 'Modern LED desk lamp with adjustable brightness and color temperature.',
    price: 4900,
    image_url: 'https://via.placeholder.com/400x300/ffc107/000?text=Lamp',
    category: 'home',
    stock: 50
  },
  {
    name: 'Bookshelf',
    description: '5-tier wooden bookshelf, holds up to 200 books. Easy assembly.',
    price: 12900,
    image_url: 'https://via.placeholder.com/400x300/ffc107/000?text=Bookshelf',
    category: 'home',
    stock: 12
  },
  {
    name: 'Throw Pillow Set',
    description: 'Set of 4 decorative throw pillows. Soft and comfortable.',
    price: 3900,
    image_url: 'https://via.placeholder.com/400x300/ffc107/000?text=Pillows',
    category: 'home',
    stock: 60
  },

  // More products
  {
    name: 'Wireless Mouse',
    description: 'Ergonomic wireless mouse with precision tracking. 2-year battery life.',
    price: 2900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=Mouse',
    category: 'electronics',
    stock: 80
  },
  {
    name: 'Mechanical Keyboard',
    description: 'RGB mechanical keyboard with Cherry MX switches. Perfect for gaming and typing.',
    price: 14900,
    image_url: 'https://via.placeholder.com/400x300/007bff/fff?text=Keyboard',
    category: 'electronics',
    stock: 22
  }
];

console.log('🌱 Seeding database with sample products...');

for (const product of sampleProducts) {
  try {
    productQueries.create(
      product.name,
      product.description,
      product.price,
      product.image_url,
      product.category,
      product.stock
    );
    console.log(`  ✓ Added: ${product.name}`);
  } catch (error) {
    console.log(`  ⚠ Skipped: ${product.name} (${error.message})`);
  }
}

console.log('\n✅ Database seeded successfully!');
console.log(`📦 Total products: ${productQueries.getAll().length}`);
