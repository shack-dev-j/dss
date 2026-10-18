// Test environment: in-memory PGlite, demo mode on, all optional modules on.
process.env.DATABASE_URL = "memory://";
process.env.SESSION_SECRET = "test-session-secret-0123456789abcdef0123";
process.env.ANONYMOUS_PEPPER = "test-anonymous-pepper-0123456789";
process.env.DEMO_MODE = "true";
process.env.FEATURES = "all";
