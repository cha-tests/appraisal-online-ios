import dotenv from 'dotenv';

/**
 * Loads environment variables before any other module is evaluated.
 *
 * This module MUST be the first import in src/index.ts. In ESM, every
 * `import` is evaluated before the importing file's body runs, so calling
 * dotenv.config() inline in index.ts happens too late — modules such as
 * middleware/auth.ts and services/supabase.ts read process.env at import
 * time and would see empty values.
 *
 * Paths are resolved relative to the working directory, which npm sets to
 * the package root when running the `dev`/`start` scripts.
 */
dotenv.config({ path: '.env.local' });
// Fall back to a plain .env for environments that use it. Values already
// loaded from .env.local win.
dotenv.config({ path: '.env' });
