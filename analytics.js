import { Database } from 'bun:sqlite';

const db = new Database('analytics.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS page_visits (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    ts       INTEGER NOT NULL,
    referrer TEXT,
    browser  TEXT,
    os       TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id        TEXT PRIMARY KEY,
    opened_at INTEGER NOT NULL,
    closed_at INTEGER,
    did_paint INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS counters (
    key   TEXT PRIMARY KEY,
    value INTEGER NOT NULL DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS canvas_cycles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    blocks_drawn    INTEGER NOT NULL DEFAULT 0,
    peak_players    INTEGER NOT NULL DEFAULT 0,
    unique_painters INTEGER NOT NULL DEFAULT 0
  );

  INSERT OR IGNORE INTO counters (key, value) VALUES ('total_blocks_drawn', 0);
  INSERT OR IGNORE INTO counters (key, value) VALUES ('max_concurrent_players', 0);
`);

// Ensure there's an open cycle on startup
const openCycle = db.query(`SELECT id FROM canvas_cycles WHERE ended_at IS NULL LIMIT 1`).get();
if (!openCycle) {
  db.query(`INSERT INTO canvas_cycles (started_at) VALUES (?)`).run(Date.now());
}

// Prepared statements
const insertVisit = db.prepare(`INSERT INTO page_visits (ts, referrer, browser, os) VALUES (?, ?, ?, ?)`);
const insertSession = db.prepare(`INSERT OR IGNORE INTO sessions (id, opened_at) VALUES (?, ?)`);
const closeSession = db.prepare(`UPDATE sessions SET closed_at = ? WHERE id = ? AND closed_at IS NULL`);
const markPaint = db.prepare(`UPDATE sessions SET did_paint = 1 WHERE id = ? AND did_paint = 0`);

const incCycleBlocks = db.prepare(`UPDATE canvas_cycles SET blocks_drawn = blocks_drawn + 1 WHERE ended_at IS NULL`);
const incCyclePeak = db.prepare(`
  UPDATE canvas_cycles SET peak_players = MAX(peak_players, ?) WHERE ended_at IS NULL
`);
const incCyclePainters = db.prepare(`
  UPDATE canvas_cycles
  SET unique_painters = unique_painters + 1
  WHERE ended_at IS NULL
    AND EXISTS (SELECT 1 FROM sessions WHERE id = ? AND did_paint = 0)
`);

const incCounter = db.prepare(`UPDATE counters SET value = value + ? WHERE key = ?`);
const maxCounter = db.prepare(`
  UPDATE counters SET value = MAX(value, ?) WHERE key = ?
`);

function parseBrowser(ua) {
  if (!ua) return 'Other';
  if (/Edg\//.test(ua)) return 'Edge';
  if (/OPR\/|Opera/.test(ua)) return 'Opera';
  if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  if (/Chrome\//.test(ua)) return 'Chrome';
  if (/Firefox\//.test(ua)) return 'Firefox';
  if (/Safari\//.test(ua) && /Version\//.test(ua)) return 'Safari';
  return 'Other';
}

function parseOS(ua) {
  if (!ua) return 'Other';
  if (/CrOS/.test(ua)) return 'ChromeOS';
  if (/Android/.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/.test(ua)) return 'iOS';
  if (/Macintosh|Mac OS X/.test(ua)) return 'macOS';
  if (/Windows/.test(ua)) return 'Windows';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Other';
}

function parseReferrer(header) {
  if (!header) return null;
  try {
    let hostname = new URL(header).hostname;
    if (hostname.startsWith('www.')) hostname = hostname.slice(4);
    return hostname || null;
  } catch {
    return null;
  }
}

export function trackPageVisit(req) {
  const url = new URL(req.url);
  const ua = req.headers.get('user-agent');
  const refParam = url.searchParams.get('ref');
  const referrer = refParam || parseReferrer(req.headers.get('referer') || req.headers.get('referrer'));
  const browser = parseBrowser(ua);
  const os = parseOS(ua);
  insertVisit.run(Date.now(), referrer, browser, os);
}

export function trackSessionOpen(id, concurrentCount) {
  insertSession.run(id, Date.now());
  incCyclePeak.run(concurrentCount);
  maxCounter.run(concurrentCount, 'max_concurrent_players');
}

export function trackSessionClose(id) {
  closeSession.run(Date.now(), id);
}

export function trackPaint(sessionId) {
  // Increment unique_painters in cycle before marking session as painted
  incCyclePainters.run(sessionId);
  markPaint.run(sessionId);
  incCycleBlocks.run();
  incCounter.run(1, 'total_blocks_drawn');
}

export function trackCanvasReset() {
  const now = Date.now();
  db.query(`UPDATE canvas_cycles SET ended_at = ? WHERE ended_at IS NULL`).run(now);
  db.query(`INSERT INTO canvas_cycles (started_at) VALUES (?)`).run(now);
}

export function getStats() {
  const totalVisits = db.query(`SELECT COUNT(*) as count FROM page_visits`).get().count;

  const perHour = db.query(`
    SELECT (ts / 3600000) * 3600000 AS hour_bucket, COUNT(*) AS count
    FROM page_visits
    GROUP BY hour_bucket
    ORDER BY hour_bucket DESC
    LIMIT 168
  `).all();

  const referrers = db.query(`
    SELECT referrer, COUNT(*) AS count
    FROM page_visits
    WHERE referrer IS NOT NULL
    GROUP BY referrer
    ORDER BY count DESC
    LIMIT 20
  `).all();

  const browsers = db.query(`
    SELECT browser, COUNT(*) AS count
    FROM page_visits
    GROUP BY browser
    ORDER BY count DESC
  `).all();

  const os = db.query(`
    SELECT os, COUNT(*) AS count
    FROM page_visits
    GROUP BY os
    ORDER BY count DESC
  `).all();

  const totalSessions = db.query(`SELECT COUNT(*) as count FROM sessions`).get().count;
  const avgDuration = db.query(`
    SELECT AVG(closed_at - opened_at) AS avg_ms
    FROM sessions
    WHERE closed_at IS NOT NULL
  `).get().avg_ms;

  const countersRows = db.query(`SELECT key, value FROM counters`).all();
  const counters = Object.fromEntries(countersRows.map(r => [r.key, r.value]));

  const totalPainters = db.query(`SELECT COUNT(*) as count FROM sessions WHERE did_paint = 1`).get().count;

  const currentCycle = db.query(`
    SELECT blocks_drawn, peak_players, unique_painters
    FROM canvas_cycles WHERE ended_at IS NULL LIMIT 1
  `).get();

  const recentCycles = db.query(`
    SELECT started_at, ended_at, blocks_drawn, peak_players, unique_painters
    FROM canvas_cycles
    WHERE ended_at IS NOT NULL
    ORDER BY ended_at DESC
    LIMIT 10
  `).all();

  const visitsPerHourOfDay = db.query(`
    SELECT CAST((ts / 3600000) % 24 AS INTEGER) AS hour, COUNT(*) AS count
    FROM page_visits
    GROUP BY hour
    ORDER BY hour
  `).all();

  const painterRate = totalSessions > 0 ? Math.round((totalPainters / totalSessions) * 1000) / 10 : 0;
  const avgBlocksPerPainter = totalPainters > 0
    ? Math.round((counters.total_blocks_drawn / totalPainters) * 10) / 10
    : 0;

  return {
    visits: {
      total: totalVisits,
      per_hour: perHour,
      referrers,
      browsers,
      os,
    },
    sessions: {
      total: totalSessions,
      avg_duration_ms: avgDuration ? Math.round(avgDuration) : null,
    },
    canvas: {
      total_blocks_drawn: counters.total_blocks_drawn,
      total_painters: totalPainters,
      max_concurrent_players: counters.max_concurrent_players,
      current_cycle: currentCycle || { blocks_drawn: 0, peak_players: 0, unique_painters: 0 },
      recent_cycles: recentCycles,
    },
    fun: {
      painter_conversion_rate: painterRate,
      avg_blocks_per_painter: avgBlocksPerPainter,
      visits_by_hour_of_day: visitsPerHourOfDay,
    },
  };
}
