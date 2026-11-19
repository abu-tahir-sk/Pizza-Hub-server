/**
 * Backwards-compatible re-export.
 *
 * The implementation now lives in `src/db/mongoose.ts` so database concerns
 * are grouped with other infrastructure. Existing imports keep working.
 */
export {
  connectDB,
  disconnectDB,
  getConnection,
  getNativeDb,
  mongooseInstance,
} from "../db/mongoose.js";
