import os from "os";
import path from "path";
import { vi } from "vitest";

// Test environment: in-memory PGlite, demo mode on, all optional modules on.
// Default: in-memory PGlite. Set TEST_DATABASE_URL=postgres://... (and run with --no-file-parallelism) to test against real PostgreSQL.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || "memory://";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef0123";
process.env.ANONYMOUS_PEPPER = "test-anonymous-pepper-0123456789";
process.env.DEMO_MODE = "true";
process.env.FEATURES = "all";
process.env.UPLOAD_DIR = path.join(os.tmpdir(), `namps-test-uploads-${process.pid}`);

// "Now" is fixed (Sun 2026-10-18, 12:00 in Tashkent) so date rules don't depend on the real clock.
// Only Date is faked; timers stay real.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-10-18T07:00:00Z"));
