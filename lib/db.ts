import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { Booking, SlotWithBooking } from "./types";

const dataDirectory = path.join(process.cwd(), "data");
const databasePath = path.join(dataDirectory, "booking.sqlite");

let database: Database.Database | null = null;

function getNextWeekBoundsFromNow() {
  const now = new Date();
  const localDay = now.getDay();
  const daysSinceMonday = (localDay + 6) % 7;

  const currentWeekStart = new Date(now);
  currentWeekStart.setDate(now.getDate() - daysSinceMonday);
  currentWeekStart.setHours(0, 0, 0, 0);

  const nextWeekStart = new Date(currentWeekStart);
  nextWeekStart.setDate(currentWeekStart.getDate() + 7);

  const weekAfterNextStart = new Date(nextWeekStart);
  weekAfterNextStart.setDate(nextWeekStart.getDate() + 7);

  return {
    nextWeekStart: nextWeekStart.toISOString(),
    weekAfterNextStart: weekAfterNextStart.toISOString(),
  };
}

function getWeekBoundsFromSlotStart(startsAt: string) {
  const slotStart = new Date(startsAt);
  const localDay = slotStart.getDay();
  const daysSinceMonday = (localDay + 6) % 7;

  const weekStart = new Date(slotStart);
  weekStart.setDate(slotStart.getDate() - daysSinceMonday);
  weekStart.setHours(0, 0, 0, 0);

  const nextWeekStart = new Date(weekStart);
  nextWeekStart.setDate(weekStart.getDate() + 7);

  return {
    weekStart: weekStart.toISOString(),
    nextWeekStart: nextWeekStart.toISOString(),
  };
}

function migrateBookingsTable(db: Database.Database) {
  const columns = db
    .prepare("PRAGMA table_info(bookings)")
    .all() as Array<{ name: string }>;

  if (columns.length === 0) {
    return;
  }

  const hasWechatId = columns.some((column) => column.name === "customer_wechat_id");
  const hasEmail = columns.some((column) => column.name === "customer_email");

  if (hasWechatId || !hasEmail) {
    return;
  }

  db.exec(`
    ALTER TABLE bookings RENAME TO bookings_old;

    CREATE TABLE bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_wechat_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled_at TEXT,
      FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
    );

    INSERT INTO bookings (
      id,
      slot_id,
      customer_name,
      customer_wechat_id,
      status,
      created_at,
      cancelled_at
    )
    SELECT
      id,
      slot_id,
      customer_name,
      customer_email,
      status,
      created_at,
      cancelled_at
    FROM bookings_old;

    DROP TABLE bookings_old;

    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_booking_per_slot
      ON bookings(slot_id)
      WHERE status = 'booked';

    CREATE INDEX IF NOT EXISTS index_bookings_slot_id
      ON bookings(slot_id);
  `);
}

function initializeSchema(db: Database.Database) {
  db.exec(`
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      starts_at TEXT NOT NULL,
      ends_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_wechat_id TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'cancelled')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      cancelled_at TEXT,
      FOREIGN KEY (slot_id) REFERENCES slots(id) ON DELETE CASCADE
    );

    CREATE UNIQUE INDEX IF NOT EXISTS unique_active_booking_per_slot
      ON bookings(slot_id)
      WHERE status = 'booked';

    CREATE INDEX IF NOT EXISTS index_slots_starts_at
      ON slots(starts_at);

    CREATE INDEX IF NOT EXISTS index_bookings_slot_id
      ON bookings(slot_id);
  `);

  migrateBookingsTable(db);
}

export function getDb() {
  if (database) {
    return database;
  }

  fs.mkdirSync(dataDirectory, { recursive: true });

  database = new Database(databasePath);
  database.pragma("journal_mode = WAL");
  initializeSchema(database);

  return database;
}

export function getDatabasePath() {
  return databasePath;
}

function mapSlotWithBooking(row: {
  id: number;
  starts_at: string;
  ends_at: string;
  created_at: string;
  booking_id: number | null;
  booking_status: "booked" | "cancelled" | null;
  customer_name: string | null;
  customer_wechat_id: string | null;
}) {
  return {
    id: row.id,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    bookingId: row.booking_id,
    bookingStatus: row.booking_status,
    customerName: row.customer_name,
    customerWechatId: row.customer_wechat_id,
  } satisfies SlotWithBooking;
}

function mapBooking(row: {
  id: number;
  slot_id: number;
  customer_name: string;
  customer_wechat_id: string;
  status: "booked" | "cancelled";
  created_at: string;
  cancelled_at: string | null;
}) {
  return {
    id: row.id,
    slotId: row.slot_id,
    customerName: row.customer_name,
    customerWechatId: row.customer_wechat_id,
    status: row.status,
    createdAt: row.created_at,
    cancelledAt: row.cancelled_at,
  } satisfies Booking;
}

export function listSlots() {
  const db = getDb();
  const rows = db
    .prepare(
      `
        SELECT
          s.id,
          s.starts_at,
          s.ends_at,
          s.created_at,
          b.id AS booking_id,
          b.status AS booking_status,
          b.customer_name,
          b.customer_wechat_id
        FROM slots s
        LEFT JOIN bookings b
          ON b.slot_id = s.id
         AND b.status = 'booked'
        ORDER BY s.starts_at ASC
      `,
    )
    .all() as Array<{
    id: number;
    starts_at: string;
    ends_at: string;
    created_at: string;
    booking_id: number | null;
    booking_status: "booked" | "cancelled" | null;
    customer_name: string | null;
    customer_wechat_id: string | null;
  }>;

  return rows.map(mapSlotWithBooking);
}

export function listNextWeekSlots() {
  const db = getDb();
  const { nextWeekStart, weekAfterNextStart } = getNextWeekBoundsFromNow();
  const rows = db
    .prepare(
      `
        SELECT
          s.id,
          s.starts_at,
          s.ends_at,
          s.created_at,
          b.id AS booking_id,
          b.status AS booking_status,
          b.customer_name,
          b.customer_wechat_id
        FROM slots s
        LEFT JOIN bookings b
          ON b.slot_id = s.id
         AND b.status = 'booked'
        WHERE s.starts_at >= ?
          AND s.starts_at < ?
        ORDER BY s.starts_at ASC
      `,
    )
    .all(nextWeekStart, weekAfterNextStart) as Array<{
    id: number;
    starts_at: string;
    ends_at: string;
    created_at: string;
    booking_id: number | null;
    booking_status: "booked" | "cancelled" | null;
    customer_name: string | null;
    customer_wechat_id: string | null;
  }>;

  return rows.map(mapSlotWithBooking);
}

export function createSlot(startsAt: string, endsAt: string) {
  const db = getDb();
  const result = db
    .prepare(
      `
        INSERT INTO slots (starts_at, ends_at)
        VALUES (?, ?)
      `,
    )
    .run(startsAt, endsAt);

  const row = db
    .prepare(
      `
        SELECT
          s.id,
          s.starts_at,
          s.ends_at,
          s.created_at,
          NULL AS booking_id,
          NULL AS booking_status,
          NULL AS customer_name,
          NULL AS customer_wechat_id
        FROM slots s
        WHERE s.id = ?
      `,
    )
    .get(result.lastInsertRowid) as {
    id: number;
    starts_at: string;
    ends_at: string;
    created_at: string;
    booking_id: number | null;
    booking_status: "booked" | "cancelled" | null;
    customer_name: string | null;
    customer_wechat_id: string | null;
  };

  return mapSlotWithBooking(row);
}

export function createBooking(
  slotId: number,
  customerName: string,
  customerWechatId: string,
) {
  const db = getDb();
  const insertBooking = db.prepare(
    `
      INSERT INTO bookings (slot_id, customer_name, customer_wechat_id)
      VALUES (?, ?, ?)
    `,
  );
  const getBookingById = db.prepare(
    `
      SELECT
        id,
        slot_id,
        customer_name,
        customer_wechat_id,
        status,
        created_at,
        cancelled_at
      FROM bookings
      WHERE id = ?
    `,
  );

  const transaction = db.transaction(() => {
    const slot = db
      .prepare(
        `
          SELECT id, starts_at
          FROM slots
          WHERE id = ?
        `,
      )
      .get(slotId) as { id: number; starts_at: string } | undefined;

    if (!slot) {
      throw new Error("SLOT_NOT_FOUND");
    }

    const { weekStart, nextWeekStart } = getWeekBoundsFromSlotStart(slot.starts_at);
    const existingWeeklyBooking = db
      .prepare(
        `
          SELECT b.id
          FROM bookings b
          INNER JOIN slots s ON s.id = b.slot_id
          WHERE b.customer_wechat_id = ?
            AND b.status = 'booked'
            AND s.starts_at >= ?
            AND s.starts_at < ?
          LIMIT 1
        `,
      )
      .get(customerWechatId, weekStart, nextWeekStart);

    if (existingWeeklyBooking) {
      throw new Error("WEEKLY_WECHAT_LIMIT");
    }

    const result = insertBooking.run(slotId, customerName, customerWechatId);
    const booking = getBookingById.get(result.lastInsertRowid) as {
      id: number;
      slot_id: number;
      customer_name: string;
      customer_wechat_id: string;
      status: "booked" | "cancelled";
      created_at: string;
      cancelled_at: string | null;
    };

    return mapBooking(booking);
  });

  return transaction();
}

export function cancelBooking(bookingId: number) {
  const db = getDb();
  const update = db.prepare(
    `
      UPDATE bookings
      SET status = 'cancelled',
          cancelled_at = datetime('now')
      WHERE id = ?
        AND status = 'booked'
    `,
  );
  const result = update.run(bookingId);

  if (result.changes === 0) {
    return null;
  }

  const booking = db
    .prepare(
      `
        SELECT
          id,
          slot_id,
          customer_name,
          customer_wechat_id,
          status,
          created_at,
          cancelled_at
        FROM bookings
        WHERE id = ?
      `,
    )
    .get(bookingId) as {
    id: number;
    slot_id: number;
    customer_name: string;
    customer_wechat_id: string;
    status: "booked" | "cancelled";
    created_at: string;
    cancelled_at: string | null;
  };

  return mapBooking(booking);
}

export function deleteSlot(slotId: number) {
  const db = getDb();

  return db.transaction(() => {
    const slot = db
      .prepare(
        `
          SELECT
            s.id,
            b.id AS booking_id
          FROM slots s
          LEFT JOIN bookings b
            ON b.slot_id = s.id
           AND b.status = 'booked'
          WHERE s.id = ?
        `,
      )
      .get(slotId) as { id: number; booking_id: number | null } | undefined;

    if (!slot) {
      return { status: "not_found" as const };
    }

    if (slot.booking_id !== null) {
      return { status: "has_booking" as const };
    }

    db.prepare("DELETE FROM slots WHERE id = ?").run(slotId);

    return { status: "deleted" as const };
  })();
}

export function deletePastSlots() {
  const db = getDb();
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `
        DELETE FROM slots
        WHERE ends_at < ?
      `,
    )
    .run(now);

  return result.changes;
}
