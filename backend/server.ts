import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import pg from "pg";
import webpush from "web-push";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import crypto from "crypto";
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

if (!JWT_SECRET) {
  console.warn("JWT_SECRET not set in environment. Tokens will not be signed securely. Set JWT_SECRET in .env for production.");
}

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails("mailto:cloova@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
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
const pool = new Pool({
  connectionString: DATABASE_URL,
});

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
  if (userId !== "admin-1") {
    const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
    await client.query(
      `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [adminNotifId, "admin-1", `${action} - ${userName}`, details, false, requestId || null]
    );
    
    // Send push notification to admin asynchronously
    sendPushNotification("admin-1", `${action} - ${userName}`, details, requestId).catch(err =>
      console.error("Failed to send push notification:", err.message)
    );
  }
}

async function startServer() {
  const app = express();
  const requestedPort = Number(process.env.PORT);
  const PORT = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 3000;

  // Initialize database tables on startup
  await initializePushSubscriptionsTable();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // Security: basic hardening headers
  // In development, Vite injects inline scripts and opens websocket HMR connections.
  // Relax CSP during dev so these aren't blocked; keep Helmet defaults in production.
  const isProd = process.env.NODE_ENV === "production";
  app.use(helmet({ contentSecurityPolicy: isProd ? undefined : false }));

  // Rate limiter for request creation endpoint (prevent spam)
  const createRequestLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 6, // limit each IP to 6 create requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests, please try again later." },
  });

  // API Authentication Routes
  app.post("/api/auth/register", async (req, res) => {
    const { name, email, password, phone, nationality, programmeOfStudy, resident } = req.body;
    if (!name || !email || !password || !phone || !resident) {
      return res.status(400).json({ error: "Required fields (Name, Email, Password, Phone, Resident) are missing" });
    }

    const lowerEmail = email.toLowerCase();
    const isValidDomain = lowerEmail.endsWith("@alustudent.com") || lowerEmail.endsWith("@alueducation.com") || lowerEmail.endsWith("alueducation.com");
    if (!isValidDomain && lowerEmail !== "admin@cloova.com") {
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

      const isFirstAdmin = lowerEmail === "admin@cloova.com" || lowerEmail.startsWith("caleb.admin");
      const generatedStudentId = `ALU-2026-${Math.floor(100 + Math.random() * 900)}`;
      const newUserId = "user-" + Math.random().toString(36).substring(2, 11);

      const insertQuery = `
        INSERT INTO users (
          id, name, email, student_id, role, phone, nationality, programme_of_study, resident, 
          password_hash, is_suspended, notification_email, notification_sms, notification_in_app, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false, true, true, true, NOW())
        RETURNING *
      `;
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
        password
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
      if (existing.password_hash !== password) {
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
        result = await pool.query("SELECT * FROM requests ORDER BY created_at DESC");
      } else {
        result = await pool.query("SELECT * FROM requests WHERE student_id = $1 ORDER BY created_at DESC", [user.id]);
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
      const result = await pool.query("SELECT * FROM requests WHERE id = $1", [id]);
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

    const { category, description, photos, priority, additionalNotes, studentPhone, behalfStudentId } = req.body;
    if (!category || !description) {
      return res.status(400).json({ error: "Category and description are required" });
    }

    const client = await pool.connect();
    let insertQuery: string | undefined;
    let values: any[] | undefined;
    try {
      await client.query("BEGIN");

      // Calculate next request ID based on total count
      const countRes = await client.query("SELECT COUNT(*) FROM requests");
      const reqIdNum = Number(countRes.rows[0].count) + 1;
      const padding = reqIdNum.toString().padStart(3, "0");
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
        
        // Trigger Admin notification
        const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
        await client.query(
          `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
           VALUES ($1, $2, $3, $4, false, $5, NOW())`,
          [
            adminNotifId,
            "admin-1",
            "New Job Request Submitted",
            `Student ${user.name} submitted an item for ${category} repair. (#${uniqueId})`,
            uniqueId
          ]
        );
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
          const adminNotifId = "notif-adm-" + Math.random().toString(36).substring(2, 6);
          await client.query(
            `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
             VALUES ($1, 'admin-1', $2, $3, false, $4, NOW())`,
            [adminNotifId, "Request Cancelled by Student", `Student ${user.name} cancelled request #${id}. Reason: ${updatedCancelReason}.`, id]
          );

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
          
          await client.query(
            `INSERT INTO notifications (id, student_id, title, body, is_read, request_id, created_at)
             VALUES ($1, 'admin-1', $2, $3, false, $4, NOW())`,
            [
              adminNotifId, 
              `Quote ${body.isQuoteAccepted ? "Accepted" : "Declined"}`, 
              notifBody, 
              id
            ]
          );

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
      const result = await pool.query(
        `SELECT p.*, COUNT(r.id) AS request_count
         FROM providers p
         LEFT JOIN requests r ON r.provider_id = p.id
         GROUP BY p.id
         ORDER BY p.created_at DESC`
      );
      res.json(result.rows.map(mapProvider));
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
        targetId = "admin-1";
      }

      const result = await pool.query("SELECT * FROM notifications WHERE student_id = $1 ORDER BY created_at DESC", [targetId]);
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
      const targetId = user.role === "admin" ? "admin-1" : user.id;
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
    console.log(`Cloova Express Server booted on port ${PORT}`);
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
