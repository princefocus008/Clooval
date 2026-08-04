import express from "express";
import compression from "compression";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import pg from "pg";
import webpush from "web-push";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { sendEmail } from "../frontend/src/services/emailService";
// Vite is only used during local development. We avoid a static import
// so production bundles don't include Vite and its path-logic (which
// can break when bundled). When running in dev, load Vite at runtime.
import { Request, Provider, Notification, User, RequestStatus, PriorityLevel, RequestCategory, ActivityLog } from "../frontend/src/types";

// Load environment variables from .env
dotenv.config();

// Web Push Setup: Initialize VAPID keys for push notifications
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || undefined;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || undefined;
const JWT_SECRET = process.env.JWT_SECRET || undefined;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@clooval.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "19981235";

if (!JWT_SECRET) {
  console.warn("JWT_SECRET not set in environment. Tokens will not be signed securely. Set JWT_SECRET in .env for production.");
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails("mailto:clooval@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  } catch (err) {
    console.error("Invalid VAPID keys provided; push notifications will be disabled.", err);
  }
} else {
  console.warn("VAPID keys not configured — push notifications disabled. Run 'npm run generate-vapid' and set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY in .env.");
}

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL is not set in the environment variables.");
}

// Set up PostgreSQL client pool
const poolConfig: any = {
  connectionString: DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
};

if (DATABASE_URL.includes("sslmode=require") || DATABASE_URL.includes("ssl=true")) {
  poolConfig.ssl = { rejectUnauthorized: false };
} else {
  poolConfig.ssl = false;
}

const pool = new Pool(poolConfig);

pool.on("error", (err) => {
  console.error("Unexpected database pool error:", err);
});

if (process.env.NODE_ENV === "production") {
  setInterval(() => {
    console.log("Pool status:", {
      total: pool.totalCount,
      idle: pool.idleCount,
      waiting: pool.waitingCount,
    });
    if (pool.waitingCount > 0) {
      console.warn(`WARNING: ${pool.waitingCount} queries waiting for a DB connection`);
    }
  }, 5 * 60 * 1000);
}

const cache = new Map<string, { data: unknown; expiresAt: number }>();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 4 },
});

if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
} else {
  console.warn("Cloudinary credentials missing; shop image uploads will be unavailable.");
}

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password: string, storedHash: string | null | undefined): Promise<boolean> {
  if (!storedHash) return false;
  if (storedHash.startsWith("$2")) {
    return bcrypt.compare(password, storedHash);
  }
  return password === storedHash;
}

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttlSeconds: number): void {
  cache.set(key, {
    data,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

function invalidateCache(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.includes(pattern)) {
      cache.delete(key);
    }
  }
}

async function initializeDatabaseIndexes() {
  try {
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_requests_student_id ON requests(student_id);
      CREATE INDEX IF NOT EXISTS idx_requests_status ON requests(status);
      CREATE INDEX IF NOT EXISTS idx_requests_created_at ON requests(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_requests_status_created ON requests(status, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(student_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(student_id, is_read) WHERE is_read = false;
      CREATE INDEX IF NOT EXISTS idx_support_created_at ON support_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_support_unread ON support_messages(is_read) WHERE is_read = false;
      CREATE INDEX IF NOT EXISTS idx_contact_created_at ON contact_messages(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_contact_unread ON contact_messages(is_read) WHERE is_read = false;
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    `);
    console.log("Database indexes initialized");
  } catch (error) {
    console.error("Failed to initialize database indexes:", error);
  }
}

// Initialize push subscriptions table if it doesn't exist
async function initializePushSubscriptionsTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255) NOT NULL,
        endpoint TEXT NOT NULL UNIQUE,
        auth_key TEXT NOT NULL,
        p256dh_key TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_subscriptions ON push_subscriptions(user_id);
    `);
    console.log("Push subscriptions table initialized");
  } catch (error) {
    console.error("Failed to initialize push subscriptions table:", error);
  }
}

async function initializeContactMessagesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS contact_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("Contact messages table initialized");
  } catch (error) {
    console.error("Failed to initialize contact messages table:", error);
  }
}

async function initializeSupportMessagesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS support_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);
    console.log("Support messages table initialized");
  } catch (error) {
    console.error("Failed to initialize support messages table:", error);
  }
}

async function ensureAdminUserExists() {
  try {
    const lowerAdminEmail = ADMIN_EMAIL.toLowerCase();
    const existingAdmin = await pool.query(
      "SELECT id, password_hash FROM users WHERE LOWER(email) = $1",
      [lowerAdminEmail]
    );

    if (existingAdmin.rows.length > 0) {
      const currentPassword = existingAdmin.rows[0].password_hash;
      const passwordMatches = await comparePassword(ADMIN_PASSWORD, currentPassword);
      if (!passwordMatches) {
        const hashedAdminPassword = await hashPassword(ADMIN_PASSWORD);
        await pool.query(
          "UPDATE users SET password_hash = $1 WHERE id = $2",
          [hashedAdminPassword, existingAdmin.rows[0].id]
        );
        console.log(`Admin password for ${ADMIN_EMAIL} was updated to the current backend default.`);
      }
      return;
    }

    const adminId = "admin-" + Math.random().toString(36).substring(2, 11);
    const hashedAdminPassword = await hashPassword(ADMIN_PASSWORD);
    await pool.query(
      `INSERT INTO users (
        id, name, email, student_id, role, phone, nationality, programme_of_study, resident,
        password_hash, is_suspended, notification_email, notification_sms, notification_in_app, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, true, true, true, NOW())`,
      [
        adminId,
        "Clooval Admin",
        lowerAdminEmail,
        "FOUNDER",
        "admin",
        null,
        null,
        null,
        null,
        hashedAdminPassword,
      ]
    );

    console.log(`Admin account created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
    console.log("Set ADMIN_PASSWORD in .env to override or secure this default.");
  } catch (error) {
    console.error("Failed to ensure admin user exists:", error);
  }
}

async function ensureShopTablesExist() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS shop_categories (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        slug VARCHAR(100) NOT NULL UNIQUE,
        description TEXT,
        display_order INTEGER NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shop_products (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        category_id UUID NOT NULL REFERENCES shop_categories(id) ON DELETE RESTRICT,
        name VARCHAR(255) NOT NULL,
        slug VARCHAR(255) NOT NULL UNIQUE,
        description TEXT,
        price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
        stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        is_available BOOLEAN NOT NULL DEFAULT true,
        is_featured BOOLEAN NOT NULL DEFAULT false,
        image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
        specs JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shop_cart_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE CASCADE,
        quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
        added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE(student_id, product_id)
      );

      CREATE TABLE IF NOT EXISTS shop_orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        student_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'ready_for_collection', 'completed', 'cancelled')),
        total_amount NUMERIC(10, 2) NOT NULL,
        notes TEXT,
        admin_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS shop_order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
        product_id UUID NOT NULL REFERENCES shop_products(id) ON DELETE RESTRICT,
        product_name VARCHAR(255) NOT NULL,
        product_price NUMERIC(10, 2) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        line_total NUMERIC(10, 2) NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_shop_products_category ON shop_products(category_id);
      CREATE INDEX IF NOT EXISTS idx_shop_products_available ON shop_products(is_available) WHERE is_available = true;
      CREATE INDEX IF NOT EXISTS idx_shop_products_featured ON shop_products(is_featured) WHERE is_featured = true;
      CREATE INDEX IF NOT EXISTS idx_shop_cart_student ON shop_cart_items(student_id);
      CREATE INDEX IF NOT EXISTS idx_shop_orders_student ON shop_orders(student_id);
      CREATE INDEX IF NOT EXISTS idx_shop_orders_status ON shop_orders(status);
      CREATE INDEX IF NOT EXISTS idx_shop_order_items_order ON shop_order_items(order_id);
    `);
    console.log("Shop tables initialized");
  } catch (error) {
    console.error("Failed to initialize shop tables:", error);
  }
}

async function seedShopData() {
  try {
    const { rows } = await pool.query("SELECT COUNT(*) FROM shop_categories");
    if (parseInt(rows[0].count, 10) > 0) {
      return;
    }

    await pool.query(`
      INSERT INTO shop_categories (name, slug, description, display_order)
      VALUES
        ('Charging', 'charging', 'Chargers, cables, and power accessories', 1),
        ('Audio', 'audio', 'Earphones, earbuds, and Bluetooth speakers', 2),
        ('Phone Accessories', 'phone-accessories', 'Screen guards, cases, and phone essentials', 3),
        ('Computer Accessories', 'computer-accessories', 'Mice, keyboards, flash drives, and laptop gear', 4),
        ('Power & Connectivity', 'power-connectivity', 'Extension cables, power banks, and adapters', 5),
        ('Other Electronics', 'other-electronics', 'Other useful electronics for students', 6)
    `);

    const cats = await pool.query("SELECT id, slug FROM shop_categories");
    const catMap = Object.fromEntries(cats.rows.map((row: any) => [row.slug, row.id]));

    const productSeedData = [
      { categorySlug: 'charging', name: 'USB-C Charger (20W)', slug: 'usb-c-charger-20w', description: 'Fast charging USB-C adapter compatible with most modern phones and laptops.', price: 450, stock_quantity: 15, is_featured: true },
      { categorySlug: 'charging', name: 'iPhone Lightning Cable (1m)', slug: 'lightning-cable-1m', description: 'Durable MFi-certified Lightning cable.', price: 250, stock_quantity: 20, is_featured: false },
      { categorySlug: 'charging', name: 'USB-C to USB-C Cable (1m)', slug: 'usb-c-cable-1m', description: 'Fast-charging USB-C cable, compatible with Android and MacBook.', price: 200, stock_quantity: 25, is_featured: false },
      { categorySlug: 'charging', name: 'Laptop Charger (Universal)', slug: 'laptop-charger-universal', description: '65W universal laptop charger with multiple tips.', price: 1200, stock_quantity: 8, is_featured: true },
      { categorySlug: 'audio', name: 'Wired Earphones (USB-C)', slug: 'wired-earphones-usbc', description: 'Clear audio wired earphones with USB-C connector.', price: 350, stock_quantity: 20, is_featured: false },
      { categorySlug: 'audio', name: 'Wired Earphones (3.5mm)', slug: 'wired-earphones-3-5mm', description: 'Standard 3.5mm earphones with microphone.', price: 250, stock_quantity: 20, is_featured: false },
      { categorySlug: 'audio', name: 'Wireless Earbuds', slug: 'wireless-earbuds', description: 'Bluetooth 5.0 earbuds with charging case. Up to 4 hours playback.', price: 1500, stock_quantity: 10, is_featured: true },
      { categorySlug: 'audio', name: 'Bluetooth Speaker (Portable)', slug: 'bluetooth-speaker-portable', description: 'Compact Bluetooth speaker with 6-hour battery. Water resistant.', price: 2200, stock_quantity: 6, is_featured: true },
      { categorySlug: 'phone-accessories', name: 'Screen Protector (Universal)', slug: 'screen-protector-universal', description: 'Tempered glass screen protector. Fits most Android phones.', price: 150, stock_quantity: 30, is_featured: false },
      { categorySlug: 'phone-accessories', name: 'iPhone Screen Protector', slug: 'screen-protector-iphone', description: 'Tempered glass screen protector for iPhone 13/14/15 series.', price: 200, stock_quantity: 25, is_featured: false },
      { categorySlug: 'phone-accessories', name: 'Phone Stand (Adjustable)', slug: 'phone-stand-adjustable', description: 'Foldable aluminium phone stand for desk use.', price: 400, stock_quantity: 15, is_featured: false },
      { categorySlug: 'phone-accessories', name: 'OTG Adapter (USB-C to USB)', slug: 'otg-adapter-usbc', description: 'Connect USB drives and accessories to your USB-C phone.', price: 150, stock_quantity: 20, is_featured: false },
      { categorySlug: 'computer-accessories', name: 'Wireless Mouse', slug: 'wireless-mouse', description: 'Compact 2.4GHz wireless mouse with USB nano receiver.', price: 800, stock_quantity: 12, is_featured: true },
      { categorySlug: 'computer-accessories', name: 'USB Flash Drive (32GB)', slug: 'flash-drive-32gb', description: 'USB 3.0 flash drive, 32GB storage.', price: 400, stock_quantity: 25, is_featured: false },
      { categorySlug: 'computer-accessories', name: 'USB Flash Drive (64GB)', slug: 'flash-drive-64gb', description: 'USB 3.0 flash drive, 64GB storage.', price: 650, stock_quantity: 20, is_featured: false },
      { categorySlug: 'computer-accessories', name: 'USB Hub (4-Port)', slug: 'usb-hub-4-port', description: '4-port USB 3.0 hub for laptops with limited ports.', price: 600, stock_quantity: 15, is_featured: false },
      { categorySlug: 'computer-accessories', name: 'Laptop Cooling Pad', slug: 'laptop-cooling-pad', description: 'Portable laptop cooling stand with built-in fan.', price: 900, stock_quantity: 8, is_featured: false },
      { categorySlug: 'computer-accessories', name: 'Laptop Bag (15 inch)', slug: 'laptop-bag-15inch', description: 'Water-resistant laptop bag fitting up to 15-inch laptops.', price: 1800, stock_quantity: 10, is_featured: false },
      { categorySlug: 'power-connectivity', name: 'Extension Cable (4-Socket)', slug: 'extension-cable-4-socket', description: '4-socket extension cord with surge protection. 1.5m cable.', price: 700, stock_quantity: 15, is_featured: true },
      { categorySlug: 'power-connectivity', name: 'Power Bank (10000mAh)', slug: 'power-bank-10000mah', description: '10,000mAh power bank with dual USB output.', price: 1600, stock_quantity: 10, is_featured: true },
      { categorySlug: 'power-connectivity', name: 'Power Bank (5000mAh)', slug: 'power-bank-5000mah', description: 'Slim 5,000mAh power bank. Fits in a pocket.', price: 900, stock_quantity: 12, is_featured: false },
      { categorySlug: 'power-connectivity', name: 'HDMI Cable (1.5m)', slug: 'hdmi-cable-1-5m', description: 'HDMI 2.0 cable for connecting laptops to displays.', price: 350, stock_quantity: 15, is_featured: false },
      { categorySlug: 'other-electronics', name: 'Reading Light (USB)', slug: 'reading-light-usb', description: 'Flexible USB-powered LED reading lamp. 3 brightness levels.', price: 300, stock_quantity: 20, is_featured: false },
      { categorySlug: 'other-electronics', name: 'Cable Organiser (Pack of 6)', slug: 'cable-organiser-pack', description: 'Reusable silicone cable ties for keeping your desk neat.', price: 150, stock_quantity: 30, is_featured: false },
    ];

    for (const product of productSeedData) {
      const categoryId = catMap[product.categorySlug];
      if (!categoryId) continue;
      await pool.query(
        `INSERT INTO shop_products (category_id, name, slug, description, price, stock_quantity, is_featured)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [categoryId, product.name, product.slug, product.description, product.price, product.stock_quantity, product.is_featured]
      );
    }

    console.log("Shop seed data inserted.");
  } catch (error) {
    console.error("Failed to seed shop data:", error);
  }
}

async function ensureTablesExist() {
  await initializePushSubscriptionsTable();
  await initializeContactMessagesTable();
  await initializeSupportMessagesTable();
  await ensureShopTablesExist();
  await initializeDatabaseIndexes();
  await seedShopData();
  await ensureAdminUserExists();
}

// Web Push Helper: Send push notifications to all subscribed devices for a user
async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  requestId?: string
) {
  try {
    // Get all push subscriptions for this user
    const result = await pool.query(
      "SELECT endpoint, auth_key, p256dh_key FROM push_subscriptions WHERE user_id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      console.log(`No push subscriptions found for user ${userId}`);
      return;
    }

    const pushPayload = JSON.stringify({
      title,
      body,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(7)}`,
      requestId,
      url: requestId ? `/request/${requestId}` : "/",
    });

    // Send push to each subscription
    for (const sub of result.rows) {
      const subscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth_key,
          p256dh: sub.p256dh_key,
        },
      };

      try {
        await webpush.sendNotification(subscription, pushPayload);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          // Subscription expired, remove it
          await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1", [
            sub.endpoint,
          ]);
          console.log(`Removed expired push subscription for user ${userId}`);
        } else {
          console.error(`Error sending push notification:`, error.message);
        }
      }
    }
  } catch (error) {
    console.error("Failed to send push notifications:", error);
  }
}

// Database mapping helper functions (snake_case from Postgres to camelCase for the frontend)
function mapUser(row: any): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    studentId: row.student_id,
    role: row.role,
    phone: row.phone || undefined,
    nationality: row.nationality || undefined,
    programmeOfStudy: row.programme_of_study || undefined,
    resident: row.resident || undefined,
    notificationEmail: row.notification_email,
    notificationSMS: row.notification_sms,
    notificationInApp: row.notification_in_app,
    isSuspended: row.is_suspended
  } as any;
}

function mapProvider(row: any): Provider {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    specialty: row.specialty || [],
    notes: row.notes || undefined,
    rating: row.rating,
    requestCount: row.request_count !== undefined ? Number(row.request_count) : undefined,
  };
}

function mapRequest(row: any): Request {
  return {
    id: row.id,
    studentId: row.student_id,
    studentName: row.student_name,
    studentEmail: row.student_email,
    studentPhone: row.student_phone || undefined,
    category: row.category as RequestCategory,
    description: row.description,
    photos: row.photos || [],
    issues: row.issues || [],
    priority: row.priority as PriorityLevel,
    additionalNotes: row.additional_notes || undefined,
    status: row.status as RequestStatus,
    providerCost: row.provider_cost !== null ? Number(row.provider_cost) : undefined,
    serviceCharge: row.service_charge !== null ? Number(row.service_charge) : undefined,
    totalCost: row.total_cost !== null ? Number(row.total_cost) : undefined,
    isQuoteAccepted: row.is_quote_accepted !== null ? row.is_quote_accepted : undefined,
    depositPaid: row.deposit_paid !== null ? row.deposit_paid : undefined,
    finalPaid: row.final_paid !== null ? row.final_paid : undefined,
    readyNotes: row.ready_notes || undefined,
    operatorNotes: row.operator_notes || undefined,
    internalNotes: row.internal_notes || undefined,
    providerId: row.provider_id || undefined,
    providerTranslation: row.provider_translation || undefined,
    cancelReason: row.cancel_reason || undefined,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function mapNotification(row: any): Notification {
  return {
    id: row.id,
    studentId: row.student_id,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    requestId: row.request_id || undefined,
    amount: row.amount !== null ? Number(row.amount) : undefined
  };
}

function mapActivityLog(row: any): ActivityLog {
  return {
    id: row.id,
    userId: row.user_id,
    userName: row.user_name,
    userEmail: row.user_email,
    action: row.action,
    details: row.details,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
    requestId: row.request_id || undefined
  };
}

// Resolve the first primary admin user id for notifications and routing.
async function getPrimaryAdminId(client: pg.PoolClient | pg.Pool = pool): Promise<string | null> {
  try {
    const result = await client.query("SELECT id FROM users WHERE role = $1 ORDER BY created_at ASC LIMIT 1", ["admin"]);
    return result.rows.length > 0 ? result.rows[0].id : null;
  } catch (error) {
    console.error("Failed to resolve primary admin id:", error);
    return null;
  }
}

// Global Activity Logging Helper using Postgres client transaction/connection
async function logActivity(
  client: pg.PoolClient | pg.Pool,
  userId: string,
  userName: string,
  userEmail: string,
  action: string,
  details: string,
  requestId?: string
) {
  const id = "act-" + Math.random().toString(36).substring(2, 11);
  await client.query(
    `INSERT INTO activities (id, user_id, user_name, user_email, action, details, request_id, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
    [id, userId, userName, userEmail, action, details, requestId || null]
  );

  // If the log is for a student, add an Admin notification to alert the admin of this activity
  const adminId = await getPrimaryAdminId(client);
  if (adminId && userId !== adminId) {
    const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
    await client.query(
      `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [adminNotifId, adminId, `${action} - ${userName}`, details, false, requestId || null]
    );

    // Send push notification to admin asynchronously
    sendPushNotification(adminId, `${action} - ${userName}`, details, requestId).catch(err =>
      console.error("Failed to send push notification:", err.message)
    );
  } else if (!adminId) {
    console.warn("No admin user found; skipping admin notification.");
  }
}

async function startServer() {
  const app = express();
  const requestedPort = Number(process.env.PORT);
  const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;

  // Initialize database tables on startup
  await ensureTablesExist();

  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (duration > 500) {
        console.warn(`SLOW REQUEST: ${req.method} ${req.path} — ${duration}ms`);
      }
    });
    next();
  });

  app.use(compression({
    threshold: 1024,
    level: 6,
  }));

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Security: basic hardening headers
  // In development, Vite injects inline scripts and opens websocket HMR connections.
  // Relax CSP during dev so these aren't blocked; keep Helmet defaults in production.
  const isProd = process.env.NODE_ENV === "production";
  app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));

  // CORS: allow the active frontend origins for both development and production.
  const normalizeOrigin = (value: string | undefined) => {
    if (!value) return undefined;
    try {
      return new URL(value).origin;
    } catch {
      return undefined;
    }
  };

  const allowedOrigins = new Set([
    "https://clooval.com",
    "https://www.clooval.com",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    process.env.FRONTEND_URL,
    process.env.VITE_API_URL,
  ]
    .map(normalizeOrigin)
    .filter((value): value is string => Boolean(value)));

  const isAllowedOrigin = (origin: string | undefined) => {
    if (!origin) return false;
    try {
      const parsed = new URL(origin);
      const originKey = parsed.origin;
      if (allowedOrigins.has(originKey)) {
        return true;
      }

      const hostname = parsed.hostname.toLowerCase();
      return hostname === "clooval.com" || hostname.endsWith(".clooval.com") || hostname.endsWith(".vercel.app");
    } catch {
      return false;
    }
  };

  app.use((req, res, next) => {
    const originHeader = req.headers.origin;
    const allowedOrigin = isAllowedOrigin(originHeader)
      ? originHeader
      : (process.env.FRONTEND_URL || "https://www.clooval.com");

    console.log("CORS middleware:", req.method, "Origin:", originHeader, "->", allowedOrigin);
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.sendStatus(204);
    }
    next();
  });

  // Rate limiter for request creation endpoint (prevent spam)
  const createRequestLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 6, // limit each IP to 6 create requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  const contactFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many contact submissions, please try again later." },
  });

  const supportFormLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 4,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many support submissions, please try again later." },
  });

  // API Contact Form Route
  app.post("/api/contact", contactFormLimiter, async (req, res) => {
    const { name, email, category, message } = req.body;

    if (typeof name !== "string" || typeof email !== "string" || typeof category !== "string" || typeof message !== "string") {
      return res.status(400).json({ error: "All contact fields are required." });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    const trimmedCategory = category.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length < 2 || trimmedName.length > 100) {
      return res.status(400).json({ error: "Name must be between 2 and 100 characters." });
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(trimmedEmail)) {
      return res.status(400).json({ error: "A valid email address is required." });
    }

    const validCategories = [
      "General Enquiry",
      "Service Question",
      "Complaint",
      "Partnership / Business",
      "Press / Media",
      "Other",
    ];

    if (!validCategories.includes(trimmedCategory)) {
      return res.status(400).json({ error: "Please select a valid category." });
    }

    if (trimmedMessage.length < 10 || trimmedMessage.length > 1000) {
      return res.status(400).json({ error: "Message must be between 10 and 1000 characters." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO contact_messages (name, email, category, message) VALUES ($1, $2, $3, $4)`,
        [trimmedName, trimmedEmail, trimmedCategory, trimmedMessage]
      );
      await client.query("COMMIT");

      const subject = `New contact message — ${trimmedCategory} from ${trimmedName}`;
      const htmlContent = `
        <p><strong>Name:</strong> ${trimmedName}</p>
        <p><strong>Email:</strong> ${trimmedEmail}</p>
        <p><strong>Category:</strong> ${trimmedCategory}</p>
        <p><strong>Message:</strong></p>
        <p>${trimmedMessage.replace(/\n/g, "<br />")}</p>
      `;

      sendEmail("cloovalcontact@gmail.com", subject, htmlContent).catch((sendError) => {
        console.error("Failed to send contact notification email:", sendError);
      });

      return res.json({ success: true, message: "Message received." });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Contact submit error:", err);
      return res.status(500).json({ error: "Unable to save your message at this time." });
    } finally {
      client.release();
    }
  });

  const getAuthenticatedStudent = (req: express.Request): User | null => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "student") {
      return null;
    }
    return user;
  };

  // API Support Widget Route
  app.post("/api/support", supportFormLimiter, async (req, res) => {
    const user = getAuthenticatedStudent(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { category, message } = req.body;

    if (typeof category !== "string" || typeof message !== "string") {
      return res.status(400).json({ error: "Category and message are required." });
    }

    const trimmedCategory = category.trim();
    const trimmedMessage = message.trim();
    const validCategories = ["Request help", "Tech issue", "Other"];

    if (!validCategories.includes(trimmedCategory)) {
      return res.status(400).json({ error: "Please select a valid support category." });
    }

    if (trimmedMessage.length < 10 || trimmedMessage.length > 500) {
      return res.status(400).json({ error: "Message must be between 10 and 500 characters." });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO support_messages (name, email, category, message) VALUES ($1, $2, $3, $4)`,
        [user.name, user.email, trimmedCategory, trimmedMessage]
      );
      await client.query("COMMIT");

      const subject = `New support request — ${trimmedCategory} from ${user.name}`;
      const htmlContent = `
        <p><strong>Name:</strong> ${user.name}</p>
        <p><strong>Email:</strong> ${user.email}</p>
        <p><strong>Category:</strong> ${trimmedCategory}</p>
        <p><strong>Message:</strong></p>
        <p>${trimmedMessage.replace(/\n/g, "<br />")}</p>
      `;

      sendEmail("cloovalcontact@gmail.com", subject, htmlContent).catch((sendError) => {
        console.error("Failed to send support notification email:", sendError);
      });

      return res.json({ success: true, message: "Support request sent." });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Support submit error:", err);
      return res.status(500).json({ error: "Unable to save your support request at this time." });
    } finally {
      client.release();
    }
  });

  // API Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, phone, nationality, programmeOfStudy, resident } = req.body;
    if (!name || !email || !password || !phone || !resident) {
      return res.status(400).json({ error: "Required fields (Name, Email, Password, Phone, Resident) are missing" });
    }

    const lowerEmail = email.toLowerCase();
    const isValidDomain = lowerEmail.endsWith("@alustudent.com") || lowerEmail.endsWith("@alueducation.com") || lowerEmail.endsWith("alueducation.com");
    if (!isValidDomain && lowerEmail !== "admin@clooval.com") {
      return res.status(400).json({ error: "Must use a valid Student Email (@alustudent.com or alueducation.com)" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const existingRes = await client.query("SELECT * FROM users WHERE LOWER(email) = $1", [lowerEmail]);
      if (existingRes.rows.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Email is already registered" });
      }

      const isFirstAdmin = lowerEmail === "admin@clooval.com" || lowerEmail.startsWith("caleb.admin");
      const generatedStudentId = `ALU-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newUserId = "user-" + Math.random().toString(36).substring(2, 11);

      const insertQuery = `
        INSERT INTO users (
          id, name, email, student_id, role, phone, nationality, programme_of_study, resident, 
          password_hash, is_suspended, notification_email, notification_sms, notification_in_app, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, true, true, true, NOW())
        RETURNING *
      `;
      const passwordHash = await hashPassword(password);
      const values = [
        newUserId,
        name,
        lowerEmail,
        generatedStudentId,
        isFirstAdmin ? "admin" : "student",
        phone,
        nationality || null,
        programmeOfStudy || null,
        resident,
        passwordHash
      ];

      const userRes = await client.query(insertQuery, values);
      const dbUser = userRes.rows[0];
      const newUser = mapUser(dbUser);

      await logActivity(
        client, 
        newUser.id, 
        newUser.name, 
        newUser.email, 
        "Registration", 
        `User registered as a ${newUser.role} from ${newUser.resident || "unknown location"} residence.`
      );

      await client.query("COMMIT");

      const token = JWT_SECRET
        ? jwt.sign({ id: newUser.id, email: newUser.email, name: newUser.name, role: newUser.role }, JWT_SECRET, { expiresIn: '7d' })
        : Buffer.from(JSON.stringify(newUser)).toString("base64");
      res.status(201).json({ user: newUser, token });
    } catch (err: any) { 
      await client.query("ROLLBACK");
      console.error("Registration error:", err);
      res.status(500).json({ error: "Internal server error during registration: " + err.message });
    } finally {
      client.release();
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    try {
      const userRes = await pool.query("SELECT * FROM users WHERE LOWER(email) = $1", [email.toLowerCase()]);
      if (userRes.rows.length === 0) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      const existing = userRes.rows[0];
      const passwordMatches = await comparePassword(password, existing.password_hash);
      if (!passwordMatches) {
        return res.status(401).json({ error: "Invalid email or password" });
      }

      if (existing.is_suspended) {
        return res.status(403).json({ error: "Your account is suspended. Contact admin." });
      }

      const user = mapUser(existing);
      await logActivity(pool, user.id, user.name, user.email, "Login", "Signed in from dev/web portal.");

      const token = JWT_SECRET
        ? jwt.sign({ id: user.id, email: user.email, name: user.name, role: user.role }, JWT_SECRET, { expiresIn: '7d' })
        : Buffer.from(JSON.stringify(user)).toString("base64");
      res.json({ user, token });
    } catch (err: any) {
      console.error("Login error:", err);
      res.status(500).json({ error: "Internal server error during login: " + err.message });
    }
  });

  app.post("/api/auth/sync", async (req, res) => {
    const { users, requests, notifications } = req.body;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      if (users && Array.isArray(users)) {
        for (const u of users) {
          const emailKey = u.email ? u.email.toLowerCase() : "";
          if (emailKey) {
            const userCheck = await client.query("SELECT id FROM users WHERE LOWER(email) = $1", [emailKey]);
            if (userCheck.rows.length === 0) {
              const insertUserQuery = `
                INSERT INTO users (
                  id, name, email, student_id, role, phone, nationality, programme_of_study, resident, 
                  password_hash, is_suspended, notification_email, notification_sms, notification_in_app, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, true, true, true, NOW())
                ON CONFLICT (email) DO NOTHING
              `;
              await client.query(insertUserQuery, [
                u.id, u.name, emailKey, u.studentId, u.role || "student", u.phone, 
                u.nationality, u.programmeOfStudy, u.resident, u.passwordPlain || u.password || "student123"
              ]);
            }
          }
        }
      }

      if (requests && Array.isArray(requests)) {
        const providerCache = new Map<string, boolean>();
        const userCache = new Map<string, boolean>();

        const providerExists = async (providerId: string | undefined) => {
          if (!providerId) return false;
          if (providerCache.has(providerId)) return providerCache.get(providerId)!;
          const providerCheck = await client.query("SELECT id FROM providers WHERE id = $1", [providerId]);
          const exists = providerCheck.rows.length > 0;
          providerCache.set(providerId, exists);
          return exists;
        };

        const userExists = async (userId: string | undefined) => {
          if (!userId) return false;
          if (userCache.has(userId)) return userCache.get(userId)!;
          const userCheck = await client.query("SELECT id FROM users WHERE id = $1", [userId]);
          const exists = userCheck.rows.length > 0;
          userCache.set(userId, exists);
          return exists;
        };

        for (const r of requests) {
          if (r && r.id) {
            const checkReq = await client.query("SELECT * FROM requests WHERE id = $1", [r.id]);
            const validProviderId = await providerExists(r.providerId);
            const providerIdToStore = validProviderId ? r.providerId : null;
            const validStudentId = await userExists(r.studentId);
            const studentIdToStore = validStudentId ? r.studentId : null;

            if (checkReq.rows.length === 0) {
              const insertReqQuery = `
                INSERT INTO requests (
                  id, student_id, student_name, student_email, student_phone, category, description, photos, request_hash,
                  priority, additional_notes, status, provider_cost, service_charge, total_cost, 
                  is_quote_accepted, deposit_paid, final_paid, ready_notes, operator_notes, internal_notes, 
                  provider_id, provider_translation, cancel_reason, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25)
              `;
              const photosArr = Array.isArray(r.photos) ? r.photos : [];
              const cAt = r.createdAt ? new Date(r.createdAt) : new Date();
              const normalizedDescription = String(r.description || "").trim().replace(/\s+/g, " ").toLowerCase();
              const hashInput = `${r.studentId}|${r.category}|${normalizedDescription}|${photosArr.length}`;
              const requestHash = crypto.createHash("sha256").update(hashInput).digest("hex");
              await client.query(insertReqQuery, [
                r.id, studentIdToStore, r.studentName, r.studentEmail, r.studentPhone, r.category, r.description, photosArr, requestHash,
                r.priority || "normal", r.additionalNotes, r.status || "submitted", r.providerCost, r.serviceCharge, r.totalCost,
                r.isQuoteAccepted || false, r.depositPaid || false, r.finalPaid || false, r.readyNotes, r.operatorNotes, r.internalNotes,
                providerIdToStore, r.providerTranslation, r.cancelReason, cAt
              ]);
            } else {
              const currentOnServer = checkReq.rows[0];
              const localTime = new Date(r.createdAt || 0).getTime();
              const serverTime = new Date(currentOnServer.created_at || 0).getTime();
              
              const statusOrder: Record<string, number> = {
                submitted: 1,
                quote_sent: 2,
                confirmed: 3,
                with_provider: 4,
                ready_for_collection: 5,
                completed: 6,
                cancelled: 7,
              };

              const localStatusRank = statusOrder[r.status] || 0;
              const serverStatusRank = statusOrder[currentOnServer.status] || 0;

              if (localStatusRank > serverStatusRank || localTime > serverTime) {
                const updateQuery = `
                  UPDATE requests 
                  SET status = $2, provider_cost = $3, service_charge = $4, total_cost = $5, 
                      is_quote_accepted = $6, deposit_paid = $7, final_paid = $8, ready_notes = $9, 
                      operator_notes = $10, internal_notes = $11, provider_id = $12, 
                      provider_translation = $13, cancel_reason = $14
                  WHERE id = $1
                `;
                await client.query(updateQuery, [
                  r.id,
                  r.status || currentOnServer.status,
                  r.providerCost ?? currentOnServer.provider_cost,
                  r.serviceCharge ?? currentOnServer.service_charge,
                  r.totalCost ?? currentOnServer.total_cost,
                  r.isQuoteAccepted ?? currentOnServer.is_quote_accepted ?? false,
                  r.depositPaid ?? currentOnServer.deposit_paid ?? false,
                  r.finalPaid ?? currentOnServer.final_paid ?? false,
                  r.readyNotes ?? currentOnServer.ready_notes,
                  r.operatorNotes ?? currentOnServer.operator_notes,
                  r.internalNotes ?? currentOnServer.internal_notes,
                  providerIdToStore ?? currentOnServer.provider_id,
                  r.providerTranslation ?? currentOnServer.provider_translation,
                  r.cancelReason ?? currentOnServer.cancel_reason
                ]);
              }
            }
          }
        }
      }

      if (notifications && Array.isArray(notifications)) {
        const requestCache = new Map<string, boolean>();

        const requestExists = async (requestId: string | undefined) => {
          if (!requestId) return false;
          if (requestCache.has(requestId)) return requestCache.get(requestId)!;
          const requestCheck = await client.query("SELECT id FROM requests WHERE id = $1", [requestId]);
          const exists = requestCheck.rows.length > 0;
          requestCache.set(requestId, exists);
          return exists;
        };

        for (const n of notifications) {
          if (n && n.id) {
            const checkNotif = await client.query("SELECT * FROM notifications WHERE id = $1", [n.id]);
            const validRequestId = await requestExists(n.requestId);
            const requestIdToStore = validRequestId ? n.requestId : null;

            if (checkNotif.rows.length === 0) {
              const insertNotifQuery = `
                INSERT INTO notifications (id, student_id, title, body, is_read, request_id, amount, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
              `;
              const cAt = n.createdAt ? new Date(n.createdAt) : new Date();
              await client.query(insertNotifQuery, [
                n.id, n.studentId, n.title, n.body, n.isRead || false, requestIdToStore, n.amount, cAt
              ]);
            } else {
              const existingNotif = checkNotif.rows[0];
              if (existingNotif.is_read !== n.isRead) {
                await client.query("UPDATE notifications SET is_read = $2 WHERE id = $1", [n.id, n.isRead]);
              }
            }
          }
        }
      }

      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Sync error:", err);
      res.status(500).json({ error: "Internal server error during sync: " + err.message });
    } finally {
      client.release();
    }
  });

  // Verification Helper
  const getAuthenticatedUser = (req: express.Request): User | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return null;
    }
    try {
      const token = authHeader.split(" ")[1];
      if (JWT_SECRET) {
        // try signed JWT first
        try {
          const payload = jwt.verify(token, JWT_SECRET) as any;
          if (!payload || typeof payload.id !== "string") throw new Error("Invalid JWT payload");
          return { id: payload.id, name: payload.name, email: payload.email, role: payload.role } as User;
        } catch (jwtErr) {
          // If JWT verification fails, attempt legacy base64 parsing for backward compatibility
          try {
            const decodedStr = Buffer.from(token, "base64").toString("utf-8");
            const parsed = JSON.parse(decodedStr);
            if (
              !parsed ||
              typeof parsed.id !== "string" ||
              typeof parsed.email !== "string" ||
              typeof parsed.name !== "string" ||
              (parsed.role !== "student" && parsed.role !== "admin")
            ) {
              return null;
            }
            return parsed as User;
          } catch (e) {
            return null;
          }
        }
      } else {
        // fallback to legacy base64 token for compatibility when JWT not configured
        const decodedStr = Buffer.from(token, "base64").toString("utf-8");
        const parsed = JSON.parse(decodedStr);
        if (
          !parsed ||
          typeof parsed.id !== "string" ||
          typeof parsed.email !== "string" ||
          typeof parsed.name !== "string" ||
          (parsed.role !== "student" && parsed.role !== "admin")
        ) {
          return null;
        }
        return parsed as User;
      }
    } catch (e) {
      return null;
    }
  };

  // REST API: Patch Student's Own Profile & Preferences
  app.patch("/api/auth/profile", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const { 
      name, 
      phone, 
      studentId, 
      resident, 
      nationality, 
      programmeOfStudy, 
      notificationEmail, 
      notificationSMS, 
      notificationInApp 
    } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query("SELECT * FROM users WHERE id = $1", [user.id]);
      if (userRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User details not found" });
      }

      const targetUser = userRes.rows[0];

      const updateQuery = `
        UPDATE users 
        SET name = COALESCE($2, name),
            phone = COALESCE($3, phone),
            student_id = COALESCE($4, student_id),
            resident = COALESCE($5, resident),
            nationality = COALESCE($6, nationality),
            programme_of_study = COALESCE($7, programme_of_study),
            notification_email = COALESCE($8, notification_email),
            notification_sms = COALESCE($9, notification_sms),
            notification_in_app = COALESCE($10, notification_in_app)
        WHERE id = $1
        RETURNING *
      `;
      const values = [
        user.id,
        name !== undefined ? name : null,
        phone !== undefined ? phone : null,
        studentId !== undefined ? studentId : null,
        resident !== undefined ? resident : null,
        nationality !== undefined ? nationality : null,
        programmeOfStudy !== undefined ? programmeOfStudy : null,
        notificationEmail !== undefined ? notificationEmail : null,
        notificationSMS !== undefined ? notificationSMS : null,
        notificationInApp !== undefined ? notificationInApp : null
      ];

      const updatedRes = await client.query(updateQuery, values);
      const updatedUser = mapUser(updatedRes.rows[0]);

      await logActivity(
        client,
        user.id,
        updatedUser.name,
        updatedUser.email,
        "Update Profile",
        `Student profile and notification options updated by user.`
      );

      await client.query("COMMIT");
      res.json(updatedUser);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Profile update error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    } finally {
      client.release();
    }
  });

  // REST API: Get Requests (filters by state based on role)
  app.get("/api/requests", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    try {
      let result;
      if (user.role === "admin") {
        result = await pool.query(`
          SELECT id, student_id, student_name, student_email, student_phone, category, description, photos,
                 issues, priority, additional_notes, status, provider_cost, service_charge, total_cost,
                 is_quote_accepted, deposit_paid, final_paid, ready_notes, operator_notes, internal_notes,
                 provider_id, provider_translation, cancel_reason, created_at
          FROM requests
          ORDER BY created_at DESC
        `);
      } else {
        result = await pool.query(`
          SELECT id, student_id, student_name, student_email, student_phone, category, description, photos,
                 issues, priority, additional_notes, status, provider_cost, service_charge, total_cost,
                 is_quote_accepted, deposit_paid, final_paid, ready_notes, operator_notes, internal_notes,
                 provider_id, provider_translation, cancel_reason, created_at
          FROM requests
          WHERE student_id = $1
          ORDER BY created_at DESC
        `, [user.id]);
      }
      const requests = result.rows.map(mapRequest);
      res.json(requests);
    } catch (err: any) {
      console.error("Get requests error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Get Request by ID (Anyone can get details for shareable job cards!)
  app.get("/api/requests/:id", async (req, res) => {
    const id = req.params.id;
    try {
      const result = await pool.query(`
        SELECT id, student_id, student_name, student_email, student_phone, category, description, photos,
               issues, priority, additional_notes, status, provider_cost, service_charge, total_cost,
               is_quote_accepted, deposit_paid, final_paid, ready_notes, operator_notes, internal_notes,
               provider_id, provider_translation, cancel_reason, created_at
        FROM requests
        WHERE id = $1
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }
      res.json(mapRequest(result.rows[0]));
    } catch (err: any) {
      console.error("Get request error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: New Request
  app.post("/api/requests", /* rate limiter */ createRequestLimiter, async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        res.status(504).json({
          success: false,
          error: { code: "TIMEOUT", detail: "Request timed out. Please try again." },
        });
      }
    }, 10000);

    const { category, description, photos, priority, additionalNotes, studentPhone, behalfStudentId } = req.body;
    if (!category || !description) {
      return res.status(400).json({ error: "Category and description are required" });
    }

    const client = await pool.connect();
    let insertQuery: string | undefined;
    let values: any[] | undefined;
    try {
      await client.query("BEGIN");

      // Calculate next request ID using the latest zero-padded REQ- ID
      const latestReqRes = await client.query(
        "SELECT id FROM requests WHERE id LIKE 'REQ-%' ORDER BY id DESC LIMIT 1"
      );
      let nextIdNum = 1;
      if (latestReqRes.rows.length > 0) {
        const lastId = latestReqRes.rows[0].id as string;
        const match = lastId.match(/^REQ-(\d+)$/);
        if (match) {
          nextIdNum = Number(match[1]) + 1;
        }
      }
      const padding = nextIdNum.toString().padStart(3, "0");
      const uniqueId = `REQ-${padding}`;

      // Determine target student details
      let targetStudentId = user.id;
      let targetStudentName = user.name;
      let targetStudentEmail = user.email;
      let targetStudentPhone = studentPhone || user.phone || "";

      if (user.role === "admin" && behalfStudentId) {
        const studentRes = await client.query("SELECT * FROM users WHERE id = $1", [behalfStudentId]);
        if (studentRes.rows.length > 0) {
          const student = studentRes.rows[0];
          targetStudentId = student.id;
          targetStudentName = student.name;
          targetStudentEmail = student.email;
          targetStudentPhone = studentPhone || student.phone || "";
        }
      }

      let insertQuery: string | undefined;
      let values: any[] | undefined;
      insertQuery = `
        INSERT INTO requests (
          id, student_id, student_name, student_email, student_phone, category, description, photos, 
          request_hash,
          priority, additional_notes, status, provider_cost, service_charge, total_cost, 
          is_quote_accepted, deposit_paid, final_paid, ready_notes, operator_notes, internal_notes, 
          provider_id, provider_translation, cancel_reason, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'submitted', $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
        RETURNING *
      `;
      const photosArr = Array.isArray(photos) ? photos : [];
      // Compute request hash to prevent exact duplicate submissions
      const normalizedDescription = String(description).trim().replace(/\s+/g, " ").toLowerCase();
      const hashInput = `${targetStudentId}|${category}|${normalizedDescription}|${photosArr.length}`;
      const requestHash = crypto.createHash("sha256").update(hashInput).digest("hex");
      values = [
        uniqueId,
        targetStudentId,
        targetStudentName,
        targetStudentEmail,
        targetStudentPhone,
        category,
        description,
        photosArr,
        requestHash,
        priority || "normal",
        additionalNotes || null,
        null,
        null,
        null,
        false,
        false,
        false,
        null,
        null,
        null,
        null,
        null,
        null
      ];

      let newRequest: any = null;
      try {
        const reqRes = await client.query(insertQuery!, values!);
        newRequest = mapRequest(reqRes.rows[0]);
      } catch (err: any) {
        if (err && err.code === "23505") {
          await client.query("ROLLBACK");
          return res.status(409).json({ error: "Duplicate request detected" });
        }
        throw err;
      }

      if (user.id !== targetStudentId) {
        // Log that admin created on behalf of student
        await logActivity(
          client, 
          user.id, 
          user.name, 
          user.email, 
          "Create Behalf", 
          `Submitted ${category} repair request (#${uniqueId}) on behalf of student ${targetStudentName}.`, 
          uniqueId
        );
        
        // Auto-notify the student on their portal
        const studentNotifId = "notif-adm-behalf-" + Math.random().toString(36).substring(2, 6);
        await client.query(
          `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
           VALUES ($1, $2, $3, $4, false, $5, NOW())`,
          [
            studentNotifId, 
            targetStudentId, 
            "New Repair Request Logged 🛠️", 
            `An administrator has logged a new ${category} repair request on your behalf. (Job ID: #${uniqueId})`,
            uniqueId
          ]
        );
      } else {
        await logActivity(client, user.id, user.name, user.email, "Create Request", `Submitted ${category} repair request (#${uniqueId}).`, uniqueId);
        
        const adminId = await getPrimaryAdminId(client);
        if (adminId) {
          const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
          await client.query(
            `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
             VALUES ($1, $2, $3, $4, false, $5, NOW())`,
            [
              adminNotifId,
              adminId,
              "New Job Request Submitted",
              `Student ${user.name} submitted an item for ${category} repair. (#${uniqueId})`,
              uniqueId
            ]
          );
        } else {
          console.warn("No admin user found; skipping admin notification for new request.");
        }
      }

      await client.query("COMMIT");
      res.status(201).json(newRequest);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Create request error:", err);
      try {
        console.error("Insert query:", insertQuery);
        console.error("Values length:", values?.length);
        console.error("Values:", values);
      } catch (logErr) {
        console.error("Failed to log query/values:", logErr);
      }
      res.status(500).json({ error: "Internal server error: " + err.message });
    } finally {
      client.release();
    }
  });

  // REST API: Patch request (Update status, details, quotes, notes)
  app.patch("/api/requests/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const id = req.params.id;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const reqRes = await client.query("SELECT * FROM requests WHERE id = $1", [id]);
      if (reqRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "Request not found" });
      }

      const oldRequest = mapRequest(reqRes.rows[0]);

      // Student validation
      if (user.role === "student" && oldRequest.studentId !== user.id) {
        await client.query("ROLLBACK");
        return res.status(403).json({ error: "Forbidden" });
      }

      const body = req.body;
      const isRestoring = user.role === "admin" && oldRequest.status === "cancelled" && body.status && body.status !== "cancelled";
      if (oldRequest.status === "cancelled" && user.role === "student") {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Cancelled requests cannot be modified by students." });
      }
      if (oldRequest.status === "cancelled" && user.role === "admin" && !isRestoring) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: "Cancelled requests can only be restored by changing the status away from cancelled." });
      }

      let updatedStatus = oldRequest.status;
      let updatedProviderCost = oldRequest.providerCost;
      let updatedServiceCharge = oldRequest.serviceCharge;
      let updatedTotalCost = oldRequest.totalCost;
      let updatedIsQuoteAccepted = oldRequest.isQuoteAccepted;
      let updatedDepositPaid = oldRequest.depositPaid;
      let updatedFinalPaid = oldRequest.finalPaid;
      let updatedReadyNotes = oldRequest.readyNotes;
      let updatedOperatorNotes = oldRequest.operatorNotes;
      let updatedInternalNotes = oldRequest.internalNotes;
      let updatedProviderId = oldRequest.providerId;
      let updatedProviderTranslation = oldRequest.providerTranslation;
      let updatedCancelReason = oldRequest.cancelReason;

      let activityAction = "Request Update";
      let activityDesc = `Updated request #${id}.`;

      if (user.role === "admin") {
        if (body.status) {
          if (body.status === "cancelled" && (!body.cancelReason || !String(body.cancelReason).trim())) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "A reason is required when cancelling a request." });
          }
          updatedStatus = body.status as RequestStatus;
        }
        if (body.providerCost !== undefined) updatedProviderCost = Number(body.providerCost);
        if (body.serviceCharge !== undefined) updatedServiceCharge = Number(body.serviceCharge);
        
        if (body.providerCost !== undefined || body.serviceCharge !== undefined) {
          const pCost = updatedProviderCost || 0;
          const sCost = updatedServiceCharge || 0;
          updatedTotalCost = pCost + sCost;
        }
        
        if (body.operatorNotes !== undefined) updatedOperatorNotes = body.operatorNotes;
        if (body.internalNotes !== undefined) updatedInternalNotes = body.internalNotes;
        if (body.providerId !== undefined) updatedProviderId = body.providerId;
        if (body.providerTranslation !== undefined) updatedProviderTranslation = body.providerTranslation;
        if (body.readyNotes !== undefined) updatedReadyNotes = body.readyNotes;
        const isRestoring = oldRequest.status === "cancelled" && body.status && body.status !== "cancelled";

        if (isRestoring) {
          updatedCancelReason = undefined;
          updatedIsQuoteAccepted = undefined;
        }

        if (body.isQuoteAccepted !== undefined) updatedIsQuoteAccepted = body.isQuoteAccepted;
        if (body.cancelReason !== undefined) updatedCancelReason = body.cancelReason;

        // Student-facing notifications
        if (body.status && body.status !== oldRequest.status) {
          let statusTitle = "Request Updated";
          let statusText = `Your request state is now: ${body.status.replace("_", " ")}`;
          let amountVal: number | undefined = undefined;

          if (isRestoring) {
            statusTitle = "Repair Request Restored 🛠️";
            statusText = `Your repair request #${id} has been restored by the administrator and is back under active review.`;
          } else if (body.status === "quote_sent") {
            statusTitle = "Repair Quote Available";
            amountVal = updatedTotalCost;
            statusText = `The operator sent a price quote of MUR ${amountVal || 0} for request #${id}. Please view and approve.`;
          } else if (body.status === "ready_for_collection") {
            statusTitle = "Item Ready for Collection 🎒";
            statusText = `Hooray! Your ${oldRequest.category} is ready to be collected.`;
          } else if (body.status === "cancelled") {
            statusTitle = "Request Cancelled by Admin 🚫";
            statusText = `Your request was cancelled by the administrator. Reason: ${body.cancelReason || "No reason provided"}`;
          }

          const notifId = "notif-std-" + Math.random().toString(36).substring(2, 6);
          await client.query(
            `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, amount, created_at)
             VALUES ($1, $2, $3, $4, false, $5, $6, NOW())`,
            [notifId, oldRequest.studentId, statusTitle, statusText, id, amountVal || null]
          );

          // Send push notification asynchronously on restoration
          if (isRestoring) {
            sendPushNotification(oldRequest.studentId, statusTitle, statusText, id).catch(err =>
              console.error("Failed to send push notification:", err.message)
            );
          }

          if (isRestoring) {
            activityAction = "Request Restored";
            activityDesc = `Admin restored cancelled request #${id} and set status to "${body.status}".`;
          } else {
            activityAction = "Status Changed";
            activityDesc = `Changed status of request #${id} to "${body.status.replace("_", " ")}".`;
            if (body.status === "cancelled") {
              activityAction = "Order Cancelled (Admin)";
              activityDesc = `Cancelled request #${id}. Reason: ${body.cancelReason || "No reason provided"}.`;
            }
          }
        } else if (body.providerCost !== undefined || body.serviceCharge !== undefined) {
          // If quote is updated while status is "quote_sent"
          if (oldRequest.status === "quote_sent") {
            const notifId = "notif-std-" + Math.random().toString(36).substring(2, 6);
            await client.query(
              `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, amount, created_at)
               VALUES ($1, $2, $3, $4, false, $5, $6, NOW())`,
              [
                notifId, 
                oldRequest.studentId, 
                "Repair Quote Revised 📝", 
                `The operator has revised the price quote for request #${id} to a new total of MUR ${updatedTotalCost || 0}. Please view and approve the update.`,
                id, 
                updatedTotalCost || null
              ]
            );
          }
          activityAction = "Quote Updated";
          activityDesc = `Admin drafted quote for #${id}: Cost MUR ${updatedTotalCost} (Provider: ${body.providerCost}, Support: ${body.serviceCharge}).`;
        } else if (body.providerId !== undefined && body.providerId !== oldRequest.providerId) {
          if (body.providerId) {
            const provRes = await client.query("SELECT name FROM providers WHERE id = $1", [body.providerId]);
            const provName = provRes.rows.length > 0 ? provRes.rows[0].name : body.providerId;
            activityAction = "Provider Assigned";
            activityDesc = `Assigned request #${id} to provider: ${provName}.`;
          } else {
            activityAction = "Provider Unassigned";
            activityDesc = `Removed assigned provider from request #${id}.`;
          }
        } else if (body.operatorNotes !== undefined && body.operatorNotes !== oldRequest.operatorNotes) {
          activityAction = "Notes Updated";
          activityDesc = `Updated student-facing notes on request #${id}.`;
        }
      } else {
        // Student action update
        if (body.status === "cancelled") {
          const nonCancellableStages = ["with_provider", "ready_for_collection", "completed", "cancelled"];
          if (nonCancellableStages.includes(oldRequest.status)) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "Cannot cancel request at this stage as it has already reached the provider." });
          }
          if (!body.cancelReason || !String(body.cancelReason).trim()) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "A reason is required when cancelling a request." });
          }
          updatedStatus = "cancelled";
          updatedCancelReason = String(body.cancelReason).trim();

          // Notify admin
          const adminId = await getPrimaryAdminId(client);
          if (adminId) {
            const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
            await client.query(
              `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
               VALUES ($1, $2, $3, $4, false, $5, NOW())`,
              [adminNotifId, adminId, "Request Cancelled by Student", `Student ${user.name} cancelled request #${id}. Reason: ${updatedCancelReason}.`, id]
            );
          } else {
            console.warn("No admin user found; skipping admin notification for cancelled request.");
          }

          activityAction = "Order Cancelled (Student)";
          activityDesc = `Student cancelled request #${id}. Reason: ${updatedCancelReason}.`;
        }
        if (body.isQuoteAccepted !== undefined) {
          if (body.isQuoteAccepted === false && (!body.cancelReason || !String(body.cancelReason).trim())) {
            await client.query("ROLLBACK");
            return res.status(400).json({ error: "A reason is required when declining a quote." });
          }
          updatedIsQuoteAccepted = body.isQuoteAccepted;
          updatedStatus = body.isQuoteAccepted ? "confirmed" : "cancelled";
          if (!body.isQuoteAccepted) {
            updatedCancelReason = String(body.cancelReason).trim();
          }

          // Notify admin
          const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
          const notifBody = body.isQuoteAccepted
            ? `Student ${user.name} has accepted the quote for request #${id}.`
            : `Student ${user.name} has declined the quote for request #${id}. Reason: ${updatedCancelReason}.`;
          
          const adminId = await getPrimaryAdminId(client);
          if (adminId) {
            await client.query(
              `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
               VALUES ($1, $2, $3, false, $4, NOW())`,
              [
                adminNotifId, 
                adminId, 
                `Quote ${body.isQuoteAccepted ? "Accepted" : "Declined"}`, 
                notifBody, 
                id
              ]
            );
          } else {
            console.warn("No admin user found; skipping admin notification for quote response.");
          }

          activityAction = body.isQuoteAccepted ? "Quote Approved" : "Quote Declined";
          activityDesc = body.isQuoteAccepted
            ? `Student accepted quote for request #${id}.`
            : `Student declined quote for request #${id}. Reason: ${updatedCancelReason}.`;
        }
        if (body.depositPaid !== undefined) {
          updatedDepositPaid = body.depositPaid;
          updatedStatus = "with_provider";

          activityAction = "Deposit Paid";
          activityDesc = `Student paid deposit for request #${id}. Ready for provider repair.`;
        }
      }

      const updateQuery = `
        UPDATE requests 
        SET status = $2, provider_cost = $3, service_charge = $4, total_cost = $5, 
            is_quote_accepted = $6, deposit_paid = $7, final_paid = $8, ready_notes = $9, 
            operator_notes = $10, internal_notes = $11, provider_id = $12, 
            provider_translation = $13, cancel_reason = $14
        WHERE id = $1
        RETURNING *
      `;
      const updateValues = [
        id,
        updatedStatus,
        updatedProviderCost !== undefined ? updatedProviderCost : null,
        updatedServiceCharge !== undefined ? updatedServiceCharge : null,
        updatedTotalCost !== undefined ? updatedTotalCost : null,
        updatedIsQuoteAccepted !== undefined ? updatedIsQuoteAccepted : null,
        updatedDepositPaid !== undefined ? updatedDepositPaid : null,
        updatedFinalPaid !== undefined ? updatedFinalPaid : null,
        updatedReadyNotes !== undefined ? updatedReadyNotes : null,
        updatedOperatorNotes !== undefined ? updatedOperatorNotes : null,
        updatedInternalNotes !== undefined ? updatedInternalNotes : null,
        updatedProviderId !== undefined ? updatedProviderId : null,
        updatedProviderTranslation !== undefined ? updatedProviderTranslation : null,
        updatedCancelReason !== undefined ? updatedCancelReason : null
      ];

      const patchRes = await client.query(updateQuery, updateValues);
      const patchedRequest = mapRequest(patchRes.rows[0]);

      await logActivity(client, user.id, user.name, user.email, activityAction, activityDesc, id);

      await client.query("COMMIT");
      res.json(patchedRequest);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Patch request error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    } finally {
      client.release();
    }
  });

  // REST API: Get All Users and their Summary (Admin Only)
  app.get("/api/admin/users", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    try {
      const usersRes = await pool.query("SELECT * FROM users ORDER BY created_at DESC");
      const requestsRes = await pool.query("SELECT * FROM requests");
      const activitiesRes = await pool.query("SELECT * FROM activities");

      const dbRequests = requestsRes.rows.map(mapRequest);
      const dbActivities = activitiesRes.rows.map(mapActivityLog);

      const allUsersList = usersRes.rows.map(u => {
        const userRequests = dbRequests.filter(r => r.studentId === u.id);
        const userActivities = dbActivities.filter(act => act.userId === u.id);

        const mappedU = mapUser(u);
        return {
          ...mappedU,
          requests: userRequests,
          activities: userActivities,
          totalServiceRequested: userRequests.length
        };
      });

      res.json(allUsersList);
    } catch (err: any) {
      console.error("Admin get users error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Get Support Messages (Admin Only)
  app.get("/api/admin/support", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    try {
      const result = await pool.query("SELECT * FROM support_messages ORDER BY created_at DESC");
      const supportMessages = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        category: row.category,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      }));
      res.json(supportMessages);
    } catch (err: any) {
      console.error("Admin get support messages error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Mark Support Message as Read (Admin Only)
  app.post("/api/admin/support/:id/read", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    const { id } = req.params;
    try {
      await pool.query("UPDATE support_messages SET is_read = true WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Admin mark support read error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Get Contact Messages (Admin Only)
  app.get("/api/admin/contact", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    try {
      const result = await pool.query("SELECT * FROM contact_messages ORDER BY created_at DESC");
      const contactMessages = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        email: row.email,
        category: row.category,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      }));
      res.json(contactMessages);
    } catch (err: any) {
      console.error("Admin get contact messages error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Mark Contact Message as Read (Admin Only)
  app.post("/api/admin/contact/:id/read", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    const { id } = req.params;
    try {
      await pool.query("UPDATE contact_messages SET is_read = true WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Admin mark contact read error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Get All Activities (Admin Only)
  app.get("/api/admin/activities", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    try {
      const result = await pool.query("SELECT * FROM activities ORDER BY created_at DESC");
      res.json(result.rows.map(mapActivityLog));
    } catch (err: any) {
      console.error("Admin get activities error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Admin Patch User (Edit Profile / Suspensions)
  app.patch("/api/admin/users/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    const { id } = req.params;
    const { name, email, phone, resident, studentId, isSuspended } = req.body;

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userCheck = await client.query("SELECT * FROM users WHERE id = $1", [id]);
      if (userCheck.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      const targetUser = userCheck.rows[0];

      if (email && email.toLowerCase() !== targetUser.email.toLowerCase()) {
        const emailCheck = await client.query("SELECT id FROM users WHERE LOWER(email) = $1", [email.toLowerCase()]);
        if (emailCheck.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(400).json({ error: "New email is already in use by another account" });
        }
      }

      const updateQuery = `
        UPDATE users 
        SET name = COALESCE($2, name),
            email = COALESCE($3, email),
            phone = COALESCE($4, phone),
            resident = COALESCE($5, resident),
            student_id = COALESCE($6, student_id),
            is_suspended = COALESCE($7, is_suspended)
        WHERE id = $1
        RETURNING *
      `;
      const values = [
        id,
        name !== undefined ? name : null,
        email !== undefined ? email.toLowerCase() : null,
        phone !== undefined ? phone : null,
        resident !== undefined ? resident : null,
        studentId !== undefined ? studentId : null,
        isSuspended !== undefined ? isSuspended : null
      ];

      const updateRes = await client.query(updateQuery, values);
      const updatedUser = mapUser(updateRes.rows[0]);

      await logActivity(
        client,
        user.id,
        user.name,
        user.email,
        "User Updated",
        `Admin updated profile details for student ${updatedUser.name} (${updatedUser.email}).`
      );

      await client.query("COMMIT");
      res.json(updatedUser);
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Admin user update error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    } finally {
      client.release();
    }
  });

  // REST API: Admin Send Custom Push Alert
  app.post("/api/admin/users/:id/alert", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    const { id } = req.params;
    const { title, message } = req.body;
    if (!title || !message) {
      return res.status(400).json({ error: "Title and message are required" });
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const userRes = await client.query("SELECT * FROM users WHERE id = $1", [id]);
      if (userRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(404).json({ error: "User not found" });
      }

      const userObj = userRes.rows[0];
      const alertNotifId = "notif-custom-" + Math.random().toString(36).substring(2, 6);

      await client.query(
        `INSERT INTO notifications (id, student_id, title, body, is_read, created_at)
         VALUES ($1, $2, $3, $4, false, NOW())`,
        [alertNotifId, userObj.id, title, message]
      );

      await logActivity(
        client,
        user.id,
        user.name,
        user.email,
        "Send Alert",
        `Sent custom administrative alert to ${userObj.name}: "${title}"`
      );

      await client.query("COMMIT");

      const notifRes = await pool.query("SELECT * FROM notifications WHERE id = $1", [alertNotifId]);
      res.json({ success: true, notification: mapNotification(notifRes.rows[0]) });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Admin alert error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    } finally {
      client.release();
    }
  });

  // REST API: Get Providers
  app.get("/api/providers", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    try {
      const cacheKey = "providers_list";
      const cached = getCached<Provider[]>(cacheKey);
      if (cached) {
        return res.json(cached);
      }

      const result = await pool.query(
        `SELECT p.id, p.name, p.phone, p.specialty, p.notes, p.rating, p.created_at, COUNT(r.id) AS request_count
         FROM providers p
         LEFT JOIN requests r ON r.provider_id = p.id
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      );
      const providers = result.rows.map(mapProvider);
      setCached(cacheKey, providers, 300);
      res.json(providers);
    } catch (err: any) {
      console.error("Get providers error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Add Providers
  app.post("/api/providers", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    const { name, phone, specialty, notes, rating } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ error: "Name and phone are required" });
    }

    try {
      const countRes = await pool.query("SELECT COUNT(*) FROM providers");
      const nextId = Number(countRes.rows[0].count) + 1;
      const provId = "prov-" + nextId;

      const insertQuery = `
        INSERT INTO providers (id, name, phone, specialty, notes, rating, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING *
      `;
      const specialtyArr = Array.isArray(specialty) ? specialty : [];
      const values = [
        provId,
        name,
        phone,
        specialtyArr,
        notes || null,
        rating !== undefined ? Number(rating) : 5
      ];

      const result = await pool.query(insertQuery, values);
      res.status(201).json(mapProvider(result.rows[0]));
    } catch (err: any) {
      console.error("Create provider error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Delete a provider (only allowed if not referenced by any request)
  app.delete("/api/providers/:id", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return res.status(401).json({ error: "Admin access only" });
    }

    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "Provider id is required" });

    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Ensure no requests reference this provider
      const refRes = await client.query("SELECT COUNT(*) FROM requests WHERE provider_id = $1", [id]);
      const refCount = Number(refRes.rows[0].count || 0);
      if (refCount > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ error: `Provider ${id} cannot be deleted because it is referenced by ${refCount} request(s)` });
      }

      // Perform delete
      await client.query("DELETE FROM providers WHERE id = $1", [id]);
      await client.query("COMMIT");
      res.json({ success: true });
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Delete provider error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    } finally {
      client.release();
    }
  });

  // REST API: Get Notifications
  app.get("/api/notifications", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      let targetId = user.id;
      if (user.role === "admin") {
        const adminId = await getPrimaryAdminId();
        if (adminId) {
          targetId = adminId;
        }
      }

      const result = await pool.query(`
        SELECT id, student_id, title, body, is_read, created_at, request_id, amount
        FROM notifications
        WHERE student_id = $1
        ORDER BY created_at DESC
      `, [targetId]);
      res.json(result.rows.map(mapNotification));
    } catch (err: any) {
      console.error("Get notifications error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Read All Notifications
  app.post("/api/notifications/read-all", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const targetId = user.role === "admin" ? (await getPrimaryAdminId()) || user.id : user.id;
      await pool.query("UPDATE notifications SET is_read = true WHERE student_id = $1", [targetId]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Read all notifications error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Mark Single Notification Read
  app.post("/api/notifications/:id/read", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { id } = req.params;
    try {
      await pool.query("UPDATE notifications SET is_read = true WHERE id = $1", [id]);
      res.json({ success: true });
    } catch (err: any) {
      console.error("Read single notification error:", err);
      res.status(500).json({ error: "Internal server error: " + err.message });
    }
  });

  // REST API: Get VAPID public key for client-side push subscription
  app.get("/api/push/vapid-key", (req, res) => {
    if (!VAPID_PUBLIC_KEY) {
      return res.status(400).json({ error: "Push notifications not configured" });
    }
    res.json({ vapidPublicKey: VAPID_PUBLIC_KEY });
  });

  // REST API: Subscribe to push notifications
  app.post("/api/push/subscribe", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { subscription } = req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "Invalid subscription object" });
    }

    try {
      const { endpoint, keys } = subscription;
      
      // Check if subscription already exists
      const existingResult = await pool.query(
        "SELECT id FROM push_subscriptions WHERE endpoint = $1",
        [endpoint]
      );

      if (existingResult.rows.length > 0) {
        // Update existing subscription
        await pool.query(
          "UPDATE push_subscriptions SET user_id = $1, auth_key = $2, p256dh_key = $3 WHERE endpoint = $4",
          [user.id, keys.auth, keys.p256dh, endpoint]
        );
      } else {
        // Insert new subscription
        await pool.query(
          "INSERT INTO push_subscriptions (user_id, endpoint, auth_key, p256dh_key) VALUES ($1, $2, $3, $4)",
          [user.id, endpoint, keys.auth, keys.p256dh]
        );
      }

      res.json({ success: true, message: "Push subscription registered" });
    } catch (err: any) {
      console.error("Push subscription error:", err);
      res.status(500).json({ error: "Failed to register push subscription: " + err.message });
    }
  });

  // REST API: Unsubscribe from push notifications
  app.post("/api/push/unsubscribe", async (req, res) => {
    const user = getAuthenticatedUser(req);
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ error: "Endpoint is required" });
    }

    try {
      await pool.query("DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2", [
        endpoint,
        user.id,
      ]);
      res.json({ success: true, message: "Push subscription removed" });
    } catch (err: any) {
      console.error("Push unsubscribe error:", err);
      res.status(500).json({ error: "Failed to remove push subscription: " + err.message });
    }
  });

  const getAuthenticatedStudentMiddleware = (req: express.Request): User | null => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "student") {
      return null;
    }
    return user;
  };

  const getAuthenticatedAdminMiddleware = (req: express.Request): User | null => {
    const user = getAuthenticatedUser(req);
    if (!user || user.role !== "admin") {
      return null;
    }
    return user;
  };

  const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "product";

  const buildShopListResponse = (data: any[], total: number, page: number, pageSize: number) => ({
    data,
    total,
    page,
    page_size: pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  });

  const errorResponse = (code: string, detail: string) => ({ success: false, error: { code, detail } });

  const parsePage = (value: any, fallback: number) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };

  const parsePageSize = (value: any, fallback: number, max: number) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return Math.min(parsed, max);
  };

  // Shop: Public routes
  app.get("/api/shop/categories", async (req, res) => {
    try {
      const cacheKey = "shop:categories";
      const cached = getCached<any[]>(cacheKey);
      if (cached) {
        return res.json({ success: true, data: cached });
      }

      const result = await pool.query(
        "SELECT id, name, slug, description FROM shop_categories WHERE is_active = true ORDER BY display_order ASC, created_at ASC"
      );
      const data = result.rows;
      setCached(cacheKey, data, 300);
      return res.json({ success: true, data });
    } catch (error: any) {
      console.error("Shop categories error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load categories."));
    }
  });

  app.get("/api/shop/products", async (req, res) => {
    try {
      const category = typeof req.query.category === "string" ? req.query.category : undefined;
      const search = typeof req.query.search === "string" ? req.query.search.trim() : undefined;
      const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
      const featured = typeof req.query.featured === "string" ? req.query.featured : undefined;
      const page = parsePage(req.query.page, 1);
      const pageSize = parsePageSize(req.query.page_size, 20, 50);
      const offset = (page - 1) * pageSize;

      const validSorts = new Set(["price_asc", "price_desc", "newest"]);
      const sortMode = validSorts.has(sort) ? sort : "newest";

      let query = `
        SELECT p.id, p.name, p.slug, p.price, p.stock_quantity, p.is_featured, p.image_urls,
               c.id AS category_id, c.name AS category_name, c.slug AS category_slug
        FROM shop_products p
        JOIN shop_categories c ON c.id = p.category_id
        WHERE p.is_available = true
      `;
      const params: any[] = [];
      let paramIndex = 1;

      if (category) {
        query += ` AND c.slug = $${paramIndex++}`;
        params.push(category);
      }
      if (search) {
        query += ` AND (p.name ILIKE $${paramIndex++} OR p.description ILIKE $${paramIndex++})`;
        params.push(`%${search}%`, `%${search}%`);
      }
      if (featured === "true") {
        query += ` AND p.is_featured = true`;
      } else if (featured === "false") {
        query += ` AND p.is_featured = false`;
      }

      const orderBy = sortMode === "price_asc"
        ? "ORDER BY p.price ASC, p.created_at DESC"
        : sortMode === "price_desc"
          ? "ORDER BY p.price DESC, p.created_at DESC"
          : "ORDER BY p.created_at DESC, p.id DESC";

      const countQuery = `SELECT COUNT(*) FROM (${query}) AS filtered`;
      const countResult = await pool.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count, 10);

      query += `${orderBy} LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
      params.push(pageSize, offset);

      const result = await pool.query(query, params);
      const data = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: Number(row.price),
        stock_quantity: row.stock_quantity,
        is_featured: row.is_featured,
        image_urls: row.image_urls || [],
        category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
      }));

      return res.json({ success: true, data: buildShopListResponse(data, total, page, pageSize) });
    } catch (error: any) {
      console.error("Shop products list error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load products."));
    }
  });

  app.get("/api/shop/products/featured", async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT p.id, p.name, p.slug, p.price, p.stock_quantity, p.is_featured, p.image_urls,
               c.id AS category_id, c.name AS category_name, c.slug AS category_slug
        FROM shop_products p
        JOIN shop_categories c ON c.id = p.category_id
        WHERE p.is_available = true AND p.is_featured = true
        ORDER BY p.created_at DESC
        LIMIT 6
      `);
      const data = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        price: Number(row.price),
        stock_quantity: row.stock_quantity,
        is_featured: row.is_featured,
        image_urls: row.image_urls || [],
        category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
      }));
      return res.json({ success: true, data });
    } catch (error: any) {
      console.error("Featured shop products error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load featured products."));
    }
  });

  app.get("/api/shop/products/:slug", async (req, res) => {
    try {
      const { slug } = req.params;
      const result = await pool.query(`
        SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
        FROM shop_products p
        JOIN shop_categories c ON c.id = p.category_id
        WHERE p.slug = $1 AND p.is_available = true
        LIMIT 1
      `, [slug]);

      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Product not found."));
      }

      const row = result.rows[0];
      return res.json({ success: true, data: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price: Number(row.price),
        stock_quantity: row.stock_quantity,
        is_available: row.is_available,
        is_featured: row.is_featured,
        image_urls: row.image_urls || [],
        specs: row.specs || {},
        category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
        created_at: row.created_at,
        updated_at: row.updated_at,
      } });
    } catch (error: any) {
      console.error("Shop product detail error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load product details."));
    }
  });

  // Shop: Student routes
  app.get("/api/shop/cart", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    try {
      const result = await pool.query(`
        SELECT sci.id, sci.quantity, sci.added_at, p.id AS product_id, p.name AS product_name, p.price, p.stock_quantity, p.image_urls, p.is_available
        FROM shop_cart_items sci
        JOIN shop_products p ON p.id = sci.product_id
        WHERE sci.student_id = $1
        ORDER BY sci.added_at DESC
      `, [user.id]);

      const items = result.rows.map((row: any) => ({
        id: row.id,
        quantity: row.quantity,
        added_at: row.added_at,
        product: {
          id: row.product_id,
          name: row.product_name,
          price: Number(row.price),
          stock_quantity: row.stock_quantity,
          image_urls: row.image_urls || [],
          is_available: row.is_available,
        },
      }));
      const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
      return res.json({ success: true, data: { items, total: Number(total.toFixed(2)), item_count: items.reduce((sum, item) => sum + item.quantity, 0) } });
    } catch (error: any) {
      console.error("Shop cart fetch error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load cart."));
    }
  });

  app.post("/api/shop/cart", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    const { product_id, quantity } = req.body;
    if (!product_id || !Number.isInteger(Number(quantity)) || Number(quantity) < 1) {
      return res.status(400).json(errorResponse("INVALID_REQUEST", "A valid product_id and quantity are required."));
    }

    const requestedQty = Number(quantity);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const productRes = await client.query("SELECT id, name, stock_quantity, is_available FROM shop_products WHERE id = $1", [product_id]);
      if (productRes.rows.length === 0 || !productRes.rows[0].is_available) {
        await client.query("ROLLBACK");
        return res.status(404).json(errorResponse("PRODUCT_NOT_FOUND", "Product is unavailable."));
      }

      const product = productRes.rows[0];
      if (requestedQty > product.stock_quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json(errorResponse("STOCK_ERROR", "Requested quantity exceeds available stock."));
      }

      const existingCart = await client.query("SELECT quantity FROM shop_cart_items WHERE student_id = $1 AND product_id = $2", [user.id, product_id]);
      const currentQty = existingCart.rows[0]?.quantity || 0;
      const newQty = currentQty + requestedQty;
      if (newQty > product.stock_quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json(errorResponse("STOCK_ERROR", "Cart quantity exceeds available stock."));
      }

      if (existingCart.rows.length > 0) {
        await client.query("UPDATE shop_cart_items SET quantity = $1, added_at = NOW() WHERE student_id = $2 AND product_id = $3", [newQty, user.id, product_id]);
      } else {
        await client.query("INSERT INTO shop_cart_items (student_id, product_id, quantity) VALUES ($1, $2, $3)", [user.id, product_id, requestedQty]);
      }
      await client.query("COMMIT");
      return res.json({ success: true, data: (await getShopCartData(user.id)) });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Shop cart add error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to add item to cart."));
    } finally {
      client.release();
    }
  });

  app.patch("/api/shop/cart/:product_id", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    const { quantity } = req.body;
    const { product_id } = req.params;
    const parsedQty = Number(quantity);
    if (!Number.isInteger(parsedQty) || parsedQty < 0) {
      return res.status(400).json(errorResponse("INVALID_REQUEST", "Quantity must be a non-negative integer."));
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      if (parsedQty === 0) {
        await client.query("DELETE FROM shop_cart_items WHERE student_id = $1 AND product_id = $2", [user.id, product_id]);
      } else {
        const productRes = await client.query("SELECT stock_quantity FROM shop_products WHERE id = $1", [product_id]);
        if (productRes.rows.length === 0) {
          await client.query("ROLLBACK");
          return res.status(404).json(errorResponse("PRODUCT_NOT_FOUND", "Product not found."));
        }
        if (parsedQty > productRes.rows[0].stock_quantity) {
          await client.query("ROLLBACK");
          return res.status(400).json(errorResponse("STOCK_ERROR", "Requested quantity exceeds available stock."));
        }
        await client.query("UPDATE shop_cart_items SET quantity = $1 WHERE student_id = $2 AND product_id = $3", [parsedQty, user.id, product_id]);
      }
      await client.query("COMMIT");
      return res.json({ success: true, data: (await getShopCartData(user.id)) });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Shop cart update error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to update cart item."));
    } finally {
      client.release();
    }
  });

  app.delete("/api/shop/cart/:product_id", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    try {
      await pool.query("DELETE FROM shop_cart_items WHERE student_id = $1 AND product_id = $2", [user.id, req.params.product_id]);
      return res.json({ success: true, data: (await getShopCartData(user.id)) });
    } catch (error: any) {
      console.error("Shop cart remove error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to remove cart item."));
    }
  });

  app.delete("/api/shop/cart", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    try {
      await pool.query("DELETE FROM shop_cart_items WHERE student_id = $1", [user.id]);
      return res.json({ success: true, data: { items: [], total: 0, item_count: 0 } });
    } catch (error: any) {
      console.error("Shop cart clear error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to clear cart."));
    }
  });

  app.post("/api/shop/orders", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const cartRes = await client.query(`
        SELECT sci.product_id, sci.quantity, p.name AS product_name, p.price, p.stock_quantity
        FROM shop_cart_items sci
        JOIN shop_products p ON p.id = sci.product_id
        WHERE sci.student_id = $1
        ORDER BY sci.added_at ASC
      `, [user.id]);

      if (cartRes.rows.length === 0) {
        await client.query("ROLLBACK");
        return res.status(400).json(errorResponse("EMPTY_CART", "Cannot place an empty order."));
      }

      const outOfStock: string[] = [];
      const lineItems: any[] = [];
      for (const row of cartRes.rows) {
        if (row.quantity > row.stock_quantity) {
          outOfStock.push(row.product_name);
        }
        lineItems.push({ product_id: row.product_id, product_name: row.product_name, product_price: Number(row.price), quantity: row.quantity, line_total: Number(row.price) * row.quantity });
      }

      if (outOfStock.length > 0) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, error: { code: "STOCK_ERROR", detail: "Some items are out of stock", out_of_stock: outOfStock } });
      }

      const totalAmount = lineItems.reduce((sum, item) => sum + item.line_total, 0);
      const orderRes = await client.query(`
        INSERT INTO shop_orders (student_id, status, total_amount, notes, admin_notes, created_at, updated_at)
        VALUES ($1, 'pending', $2, $3, $4, NOW(), NOW())
        RETURNING id, status, total_amount
      `, [user.id, totalAmount.toFixed(2), req.body.notes || null, null]);
      const order = orderRes.rows[0];
      const orderId = order.id;

      for (const item of lineItems) {
        await client.query(`
          INSERT INTO shop_order_items (order_id, product_id, product_name, product_price, quantity, line_total)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [orderId, item.product_id, item.product_name, item.product_price, item.quantity, item.line_total]);
        await client.query(`
          UPDATE shop_products SET stock_quantity = stock_quantity - $1, updated_at = NOW() WHERE id = $2
        `, [item.quantity, item.product_id]);
      }

      await client.query("DELETE FROM shop_cart_items WHERE student_id = $1", [user.id]);
      await client.query("COMMIT");

      sendEmail(
        "cloovalcontact@gmail.com",
        `New shop order — ${user.name}`,
        `Student: ${user.name}\nEmail: ${user.email}\nItems:\n${lineItems.map((item) => `- ${item.product_name} x${item.quantity}`).join("\n")}\nTotal: MUR ${totalAmount.toFixed(2)}`
      ).catch((error) => console.error("Failed to send shop order notification email:", error));

      return res.json({ success: true, data: { order_id: orderId, status: order.status, total_amount: Number(order.total_amount), items: lineItems } });
    } catch (error: any) {
      await client.query("ROLLBACK");
      console.error("Shop order create error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to place order."));
    } finally {
      client.release();
    }
  });

  app.get("/api/shop/orders", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    try {
      const page = parsePage(req.query.page, 1);
      const pageSize = parsePageSize(req.query.page_size, 10, 50);
      const offset = (page - 1) * pageSize;
      const orderResult = await pool.query(`
        SELECT id, status, total_amount, created_at, updated_at
        FROM shop_orders
        WHERE student_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `, [user.id, pageSize, offset]);
      const totalResult = await pool.query("SELECT COUNT(*) FROM shop_orders WHERE student_id = $1", [user.id]);
      const total = parseInt(totalResult.rows[0].count, 10);
      const data = await Promise.all(orderResult.rows.map(async (order: any) => {
        const itemsResult = await pool.query(`
          SELECT product_id, product_name, product_price, quantity, line_total
          FROM shop_order_items
          WHERE order_id = $1
        `, [order.id]);
        return {
          id: order.id,
          status: order.status,
          total_amount: Number(order.total_amount),
          created_at: order.created_at,
          updated_at: order.updated_at,
          items: itemsResult.rows.map((item: any) => ({
            product_id: item.product_id,
            product_name: item.product_name,
            product_price: Number(item.product_price),
            quantity: item.quantity,
            line_total: Number(item.line_total),
          })),
        };
      }));

      return res.json({ success: true, data: buildShopListResponse(data, total, page, pageSize) });
    } catch (error: any) {
      console.error("Shop orders list error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load orders."));
    }
  });

  app.get("/api/shop/orders/:id", async (req, res) => {
    const user = getAuthenticatedStudentMiddleware(req);
    if (!user) {
      return res.status(401).json(errorResponse("UNAUTHORIZED", "Authentication required."));
    }

    try {
      const orderResult = await pool.query("SELECT * FROM shop_orders WHERE id = $1", [req.params.id]);
      if (orderResult.rows.length === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Order not found."));
      }
      const order = orderResult.rows[0];
      if (order.student_id !== user.id) {
        return res.status(403).json(errorResponse("FORBIDDEN", "This order does not belong to your account."));
      }
      const itemsResult = await pool.query(`
        SELECT product_id, product_name, product_price, quantity, line_total
        FROM shop_order_items
        WHERE order_id = $1
      `, [req.params.id]);
      return res.json({ success: true, data: { id: order.id, status: order.status, total_amount: Number(order.total_amount), created_at: order.created_at, updated_at: order.updated_at, items: itemsResult.rows.map((item: any) => ({ product_id: item.product_id, product_name: item.product_name, product_price: Number(item.product_price), quantity: item.quantity, line_total: Number(item.line_total) })) } });
    } catch (error: any) {
      console.error("Shop order detail error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load order details."));
    }
  });

  // Shop: Admin routes
  app.get("/api/admin/shop/products", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const available = typeof req.query.available === "string" ? req.query.available : "all";
      const page = parsePage(req.query.page, 1);
      const pageSize = parsePageSize(req.query.page_size, 20, 50);
      const offset = (page - 1) * pageSize;
      let query = `
        SELECT p.*, c.id AS category_id, c.name AS category_name, c.slug AS category_slug
        FROM shop_products p
        JOIN shop_categories c ON c.id = p.category_id
      `;
      const params: any[] = [];
      if (available === "true") {
        query += " WHERE p.is_available = true";
      } else if (available === "false") {
        query += " WHERE p.is_available = false";
      }
      query += " ORDER BY p.created_at DESC LIMIT $1 OFFSET $2";
      params.push(pageSize, offset);
      const result = await pool.query(query, params);
      const countResult = await pool.query("SELECT COUNT(*) FROM shop_products" );
      const data = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        price: Number(row.price),
        stock_quantity: row.stock_quantity,
        is_available: row.is_available,
        is_featured: row.is_featured,
        image_urls: row.image_urls || [],
        specs: row.specs || {},
        category: { id: row.category_id, name: row.category_name, slug: row.category_slug },
        created_at: row.created_at,
        updated_at: row.updated_at,
      }));
      return res.json({ success: true, data: buildShopListResponse(data, parseInt(countResult.rows[0].count, 10), page, pageSize) });
    } catch (error: any) {
      console.error("Admin shop products list error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load products."));
    }
  });

  app.post("/api/admin/shop/products", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const { category_id, name, description, price, stock_quantity, is_available, is_featured, image_urls, specs } = req.body;
      if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 255) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Product name must be between 2 and 255 characters."));
      }
      const priceValue = Number(price);
      if (!Number.isFinite(priceValue) || priceValue <= 0) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Price must be a positive number."));
      }
      const stockValue = Number(stock_quantity);
      if (!Number.isInteger(stockValue) || stockValue < 0) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Stock quantity must be zero or more."));
      }
      const categoryRes = await pool.query("SELECT id FROM shop_categories WHERE id = $1", [category_id]);
      if (categoryRes.rows.length === 0) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Category does not exist."));
      }

      let slug = slugify(name);
      let slugIndex = 2;
      let slugExists = true;
      let finalSlug = slug;
      while (slugExists) {
        const existsRes = await pool.query("SELECT id FROM shop_products WHERE slug = $1", [finalSlug]);
        if (existsRes.rows.length === 0) {
          slugExists = false;
        } else {
          finalSlug = `${slug}-${slugIndex}`;
          slugIndex += 1;
        }
      }

      const result = await pool.query(`
        INSERT INTO shop_products (category_id, name, slug, description, price, stock_quantity, is_available, is_featured, image_urls, specs, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW()) RETURNING *
      `, [category_id, name.trim(), finalSlug, description || null, priceValue.toFixed(2), stockValue, is_available !== false, is_featured === true, JSON.stringify(image_urls || []), JSON.stringify(specs || {})]);
      const row = result.rows[0];
      return res.status(201).json({ success: true, data: { id: row.id, name: row.name, slug: row.slug, description: row.description, price: Number(row.price), stock_quantity: row.stock_quantity, is_available: row.is_available, is_featured: row.is_featured, image_urls: row.image_urls || [], specs: row.specs || {}, created_at: row.created_at, updated_at: row.updated_at } });
    } catch (error: any) {
      console.error("Admin create product error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to create product."));
    }
  });

  app.patch("/api/admin/shop/products/:id", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const { name, description, price, stock_quantity, is_available, is_featured, image_urls, specs, category_id } = req.body;
      const existingRes = await pool.query("SELECT * FROM shop_products WHERE id = $1", [req.params.id]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Product not found."));
      }

      if (name !== undefined) {
        if (typeof name !== "string" || name.trim().length < 2 || name.trim().length > 255) {
          return res.status(400).json(errorResponse("INVALID_REQUEST", "Product name must be between 2 and 255 characters."));
        }
      }
      if (price !== undefined) {
        const priceValue = Number(price);
        if (!Number.isFinite(priceValue) || priceValue <= 0) {
          return res.status(400).json(errorResponse("INVALID_REQUEST", "Price must be a positive number."));
        }
      }
      if (stock_quantity !== undefined) {
        const stockValue = Number(stock_quantity);
        if (!Number.isInteger(stockValue) || stockValue < 0) {
          return res.status(400).json(errorResponse("INVALID_REQUEST", "Stock quantity must be zero or more."));
        }
      }
      if (category_id !== undefined) {
        const categoryRes = await pool.query("SELECT id FROM shop_categories WHERE id = $1", [category_id]);
        if (categoryRes.rows.length === 0) {
          return res.status(400).json(errorResponse("INVALID_REQUEST", "Category does not exist."));
        }
      }

      const updates: string[] = ["updated_at = NOW()"];
      const values: any[] = [];
      let index = 1;
      if (name !== undefined) {
        updates.push(`name = $${index++}`); values.push(name.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${index++}`); values.push(description);
      }
      if (price !== undefined) {
        updates.push(`price = $${index++}`); values.push(Number(price).toFixed(2));
      }
      if (stock_quantity !== undefined) {
        updates.push(`stock_quantity = $${index++}`); values.push(Number(stock_quantity));
      }
      if (is_available !== undefined) {
        updates.push(`is_available = $${index++}`); values.push(Boolean(is_available));
      }
      if (is_featured !== undefined) {
        updates.push(`is_featured = $${index++}`); values.push(Boolean(is_featured));
      }
      if (image_urls !== undefined) {
        updates.push(`image_urls = $${index++}`); values.push(JSON.stringify(image_urls || []));
      }
      if (specs !== undefined) {
        updates.push(`specs = $${index++}`); values.push(JSON.stringify(specs || {}));
      }
      if (category_id !== undefined) {
        updates.push(`category_id = $${index++}`); values.push(category_id);
      }
      values.push(req.params.id);
      const result = await pool.query(`UPDATE shop_products SET ${updates.join(", ")} WHERE id = $${index} RETURNING *`, values);
      const row = result.rows[0];
      return res.json({ success: true, data: { id: row.id, name: row.name, slug: row.slug, description: row.description, price: Number(row.price), stock_quantity: row.stock_quantity, is_available: row.is_available, is_featured: row.is_featured, image_urls: row.image_urls || [], specs: row.specs || {}, created_at: row.created_at, updated_at: row.updated_at } });
    } catch (error: any) {
      console.error("Admin update product error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to update product."));
    }
  });

  app.delete("/api/admin/shop/products/:id", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      await pool.query("UPDATE shop_products SET is_available = false, stock_quantity = 0, updated_at = NOW() WHERE id = $1", [req.params.id]);
      return res.json({ success: true, message: "Product deactivated." });
    } catch (error: any) {
      console.error("Admin deactivate product error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to deactivate product."));
    }
  });

  app.patch("/api/admin/shop/products/:id/stock", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const { stock_quantity, operation } = req.body;
      const productRes = await pool.query("SELECT stock_quantity FROM shop_products WHERE id = $1", [req.params.id]);
      if (productRes.rows.length === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Product not found."));
      }
      const current = Number(productRes.rows[0].stock_quantity);
      let next = current;
      if (operation === "set") {
        next = Number(stock_quantity);
      } else if (operation === "add") {
        next = current + Number(stock_quantity);
      } else if (operation === "subtract") {
        next = current - Number(stock_quantity);
      } else {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Operation must be set, add, or subtract."));
      }
      if (!Number.isInteger(next) || next < 0) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Stock cannot be negative."));
      }
      const updatedRes = await pool.query("UPDATE shop_products SET stock_quantity = $1, updated_at = NOW() WHERE id = $2 RETURNING *", [next, req.params.id]);
      const row = updatedRes.rows[0];
      return res.json({ success: true, data: { id: row.id, stock_quantity: row.stock_quantity, updated_at: row.updated_at } });
    } catch (error: any) {
      console.error("Admin stock update error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to update stock."));
    }
  });

  app.get("/api/admin/shop/orders", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const page = parsePage(req.query.page, 1);
      const pageSize = parsePageSize(req.query.page_size, 10, 50);
      const offset = (page - 1) * pageSize;
      const { status, date_from, date_to } = req.query;
      let query = `
        SELECT so.id, so.student_id, so.status, so.total_amount, so.created_at, so.updated_at, u.name AS student_name, u.email AS student_email
        FROM shop_orders so
        JOIN users u ON u.id = so.student_id
        WHERE 1 = 1
      `;
      const values: any[] = [];
      let index = 1;
      if (typeof status === "string" && status) {
        query += ` AND so.status = $${index++}`;
        values.push(status);
      }
      if (typeof date_from === "string" && date_from) {
        query += ` AND so.created_at >= $${index++}`;
        values.push(date_from);
      }
      if (typeof date_to === "string" && date_to) {
        query += ` AND so.created_at <= $${index++}`;
        values.push(date_to);
      }
      query += ` ORDER BY so.created_at DESC LIMIT $${index++} OFFSET $${index++}`;
      values.push(pageSize, offset);
      const result = await pool.query(query, values);
      const totalResult = await pool.query("SELECT COUNT(*) FROM shop_orders");
      const data = await Promise.all(result.rows.map(async (order: any) => {
        const itemsResult = await pool.query("SELECT product_name, quantity, line_total FROM shop_order_items WHERE order_id = $1", [order.id]);
        return { id: order.id, student_id: order.student_id, student_name: order.student_name, student_email: order.student_email, status: order.status, total_amount: Number(order.total_amount), created_at: order.created_at, updated_at: order.updated_at, items: itemsResult.rows.map((item: any) => ({ product_name: item.product_name, quantity: item.quantity, line_total: Number(item.line_total) })) };
      }));
      return res.json({ success: true, data: buildShopListResponse(data, parseInt(totalResult.rows[0].count, 10), page, pageSize) });
    } catch (error: any) {
      console.error("Admin shop orders list error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load orders."));
    }
  });

  app.patch("/api/admin/shop/orders/:id/status", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    const { status, admin_notes } = req.body;
    if (!status) {
      return res.status(400).json(errorResponse("INVALID_REQUEST", "A status is required."));
    }

    const validTransitions: Record<string, string[]> = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["ready_for_collection", "cancelled"],
      ready_for_collection: ["completed", "cancelled"],
      completed: [],
      cancelled: [],
    };

    try {
      const orderRes = await pool.query("SELECT * FROM shop_orders WHERE id = $1", [req.params.id]);
      if (orderRes.rows.length === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Order not found."));
      }
      const currentOrder = orderRes.rows[0];
      if (!validTransitions[currentOrder.status]?.includes(status)) {
        return res.status(400).json(errorResponse("INVALID_TRANSITION", "This status transition is not allowed."));
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (status === "cancelled") {
          const itemsRes = await client.query("SELECT product_id, quantity FROM shop_order_items WHERE order_id = $1", [req.params.id]);
          for (const row of itemsRes.rows) {
            await client.query("UPDATE shop_products SET stock_quantity = stock_quantity + $1, updated_at = NOW() WHERE id = $2", [row.quantity, row.product_id]);
          }
        }
        const updatedOrder = await client.query(`
          UPDATE shop_orders SET status = $1, admin_notes = COALESCE($2, admin_notes), updated_at = NOW() WHERE id = $3 RETURNING *
        `, [status, admin_notes || null, req.params.id]);
        await client.query("COMMIT");
        const studentRes = await pool.query("SELECT name, email FROM users WHERE id = $1", [currentOrder.student_id]);
        sendEmail(
          studentRes.rows[0]?.email || "cloovalcontact@gmail.com",
          `Your shop order status changed to ${status}`,
          `Hello ${studentRes.rows[0]?.name || "Student"},\nYour shop order ${req.params.id} is now ${status}.`
        ).catch((error) => console.error("Failed to send shop order status email:", error));
        return res.json({ success: true, data: { id: updatedOrder.rows[0].id, status: updatedOrder.rows[0].status, admin_notes: updatedOrder.rows[0].admin_notes, updated_at: updatedOrder.rows[0].updated_at } });
      } catch (error: any) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error: any) {
      console.error("Admin shop order status error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to update order status."));
    }
  });

  app.get("/api/admin/shop/categories", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const result = await pool.query("SELECT * FROM shop_categories ORDER BY display_order ASC, created_at ASC");
      return res.json({ success: true, data: result.rows });
    } catch (error: any) {
      console.error("Admin shop categories error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to load categories."));
    }
  });

  app.post("/api/admin/shop/categories", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const { name, description, display_order } = req.body;
      if (typeof name !== "string" || name.trim().length < 2) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Category name is required."));
      }
      let slug = slugify(name);
      let suffix = 2;
      let candidate = slug;
      while (true) {
        const existsRes = await pool.query("SELECT id FROM shop_categories WHERE slug = $1", [candidate]);
        if (existsRes.rows.length === 0) {
          break;
        }
        candidate = `${slug}-${suffix}`;
        suffix += 1;
      }
      const result = await pool.query(`
        INSERT INTO shop_categories (name, slug, description, display_order, is_active)
        VALUES ($1, $2, $3, $4, true) RETURNING *
      `, [name.trim(), candidate, description || null, Number(display_order || 0)]);
      return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error("Admin shop category create error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to create category."));
    }
  });

  app.patch("/api/admin/shop/categories/:id", async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const { name, description, display_order, is_active } = req.body;
      const updates: string[] = [];
      const values: any[] = [];
      let index = 1;
      if (name !== undefined) {
        updates.push(`name = $${index++}`); values.push(name.trim());
      }
      if (description !== undefined) {
        updates.push(`description = $${index++}`); values.push(description);
      }
      if (display_order !== undefined) {
        updates.push(`display_order = $${index++}`); values.push(Number(display_order));
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${index++}`); values.push(Boolean(is_active));
      }
      if (updates.length === 0) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "No updates provided."));
      }
      values.push(req.params.id);
      const result = await pool.query(`UPDATE shop_categories SET ${updates.join(", ")} WHERE id = $${index} RETURNING *`, values);
      if (result.rows.length === 0) {
        return res.status(404).json(errorResponse("NOT_FOUND", "Category not found."));
      }
      return res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
      console.error("Admin shop category update error:", error);
      return res.status(500).json(errorResponse("INTERNAL_ERROR", "Unable to update category."));
    }
  });

  app.post("/api/admin/shop/upload-image", upload.single("image"), async (req, res) => {
    const user = getAuthenticatedAdminMiddleware(req);
    if (!user) {
      return res.status(user ? 403 : 401).json(errorResponse(user ? "FORBIDDEN" : "UNAUTHORIZED", user ? "Admin access required." : "Authentication required."));
    }

    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "An image file is required."));
      }
      const mimeType = file.mimetype || "";
      if (!["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Only JPEG, PNG, and WEBP images are allowed."));
      }
      if (file.size > 5 * 1024 * 1024) {
        return res.status(400).json(errorResponse("INVALID_REQUEST", "Image must be 5MB or smaller."));
      }
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json(errorResponse("UPLOAD_UNAVAILABLE", "Cloudinary is not configured."));
      }
      const uploadResult: any = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: "clooval-shop",
          transformation: [{ width: 800, quality: "auto", fetch_format: "auto" }],
        }, (error, result) => {
          if (error || !result) {
            reject(error || new Error("Upload failed"));
            return;
          }
          resolve(result);
        });
        stream.end(file.buffer);
      });
      return res.json({ success: true, data: { url: uploadResult.secure_url, public_id: uploadResult.public_id } });
    } catch (error: any) {
      console.error("Shop image upload error:", error);
      return res.status(500).json(errorResponse("UPLOAD_FAILED", "Unable to upload image."));
    }
  });

  async function getShopCartData(studentId: string) {
    const result = await pool.query(`
      SELECT sci.id, sci.quantity, sci.added_at, p.id AS product_id, p.name AS product_name, p.price, p.stock_quantity, p.image_urls, p.is_available
      FROM shop_cart_items sci
      JOIN shop_products p ON p.id = sci.product_id
      WHERE sci.student_id = $1
      ORDER BY sci.added_at DESC
    `, [studentId]);

    const items = result.rows.map((row: any) => ({
      id: row.id,
      quantity: row.quantity,
      added_at: row.added_at,
      product: {
        id: row.product_id,
        name: row.product_name,
        price: Number(row.price),
        stock_quantity: row.stock_quantity,
        image_urls: row.image_urls || [],
        is_available: row.is_available,
      },
    }));
    const total = items.reduce((sum, item) => sum + Number(item.product.price) * item.quantity, 0);
    return { items, total: Number(total.toFixed(2)), item_count: items.reduce((sum, item) => sum + item.quantity, 0) };
  }

  const frontendRoot = path.join(process.cwd(), "frontend");
  const frontendPublic = path.join(frontendRoot, "public");

  // REST API: Serve Service Worker from the frontend public folder
  app.get("/sw.js", (req, res) => {
    res.setHeader("Content-Type", "application/javascript");
    res.sendFile(path.join(frontendPublic, "sw.js"));
  });

  // Vite development vs production asset server
  if (process.env.NODE_ENV !== "production") {
    try {
      const createViteServer = eval("require")("vite").createServer;
      const vite = await createViteServer({
        root: frontendRoot,
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } catch (err: any) {
      console.warn("Vite dev server not available; continuing without it:", err && err.message ? err.message : err);
    }
  } else {
    const distPath = path.join(process.cwd(), "dist-frontend");
    app.use(express.static(distPath));
    // Support wildcard page routing for Single Page App
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Clooval Express Server booted on port ${PORT}`);
  });

  server.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.error(`Port ${PORT} is already in use. Set PORT to another value and retry.`);
    } else {
      console.error("Server error:", err);
    }
    process.exit(1);
  });
}

startServer();
