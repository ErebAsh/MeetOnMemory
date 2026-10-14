/**
 * Late-binding rate-limit store (Issue #1452).
 *
 * ─── The bug ─────────────────────────────────────────────────────────────────
 *
 * `rateLimiter.js` built each limiter's store eagerly at module scope:
 *
 *     const createStore = (prefix) => {
 *       const redisClient = getRedisClient();          // <- always null here
 *       if (redisClient && RedisStore) { ... }
 *       return undefined;                              // -> MemoryStore
 *     };
 *     export const apiLimiter = rateLimit({ store: createStore("rl:api:") });
 *
 * `middleware/rateLimiter.js` is reached through `config/express.js`, which is
 * part of `server.js`'s static import graph — so its module body runs during
 * the import phase, before a single line of `server.js` executes. `initRedis()`
 * is called from `config/workers.js`, inside `startWorkers()`, which `server.js`
 * schedules in a `setTimeout(…, 0)` *inside the `server.listen()` callback*.
 *
 * `getRedisClient()` therefore returned `null` for all thirteen limiters on
 * every boot, in every environment, and each one silently fell back to
 * express-rate-limit's in-process `MemoryStore`. The Redis-backed limiting this
 * file is written to provide had never actually run.
 *
 * That is not a cosmetic problem. `loginLimiter` is `max: 5` per 15 minutes;
 * behind four instances the real ceiling was 20. `dataExportLimiter` is
 * "1 per 24 hours" and became "1 per instance per 24 hours". And every counter
 * reset on every deploy.
 *
 * ─── Why not just call createStore() later ───────────────────────────────────
 *
 * Because `store` is read by `rateLimit()` at construction time and stashed on
 * the returned middleware. There is no supported way to swap it afterwards, and
 * reordering the bootstrap so Redis connects before the import graph is
 * evaluated would mean turning `initRedis()` into a top-level await in a module
 * that half the codebase imports.
 *
 * So the store itself becomes the thing that binds late. `LazyRateLimitStore`
 * satisfies express-rate-limit's `Store` interface and forwards every call to a
 * backing store that it resolves on first use — `MemoryStore` while Redis is
 * unavailable, `RedisStore` from the moment `getRedisClient()` reports a ready
 * client. Call sites in `rateLimiter.js` are unchanged apart from the store
 * they pass, and nothing about the bootstrap order has to move.
 *
 * ─── What is deliberately accepted ───────────────────────────────────────────
 *
 * Hits recorded in memory before Redis becomes ready are dropped at the
 * switchover rather than migrated. That window is the few hundred milliseconds
 * between `server.listen()` and `initRedis()` resolving, the alternative is a
 * read-modify-write race against every other instance doing the same thing, and
 * the failure mode is "a handful of requests are not counted once per deploy" —
 * which is strictly better than today, where they are never counted across
 * instances at all.
 */

import { MemoryStore } from "express-rate-limit";
import { getRedisClient } from "../services/redisService.js";

/**
 * Loads `rate-limit-redis` if it is installed.
 *
 * It is a declared dependency, but the original file guarded the import and
 * that guard is worth keeping: a store that cannot be constructed should
 * degrade to memory, not crash the process at import time.
 */
let RedisStore = null;
try {
  const mod = await import("rate-limit-redis");
  RedisStore = mod.RedisStore || mod.default || null;
} catch {
  RedisStore = null;
}

/** True once the "limiters are now using Redis" line has been logged. */
let announcedRedisBacking = false;

/**
 * Reports whether `rate-limit-redis` resolved. Exported for the test suite and
 * for the startup diagnostics in `describeRateLimitBacking()`.
 */
export const isRedisStoreAvailable = () => RedisStore !== null;

/**
 * Test seam. Passing `null` restores the real module-level binding, so a test
 * that stubs the store cannot leak into the next one.
 */
export const __setRedisStoreForTesting = (stub) => {
  RedisStore = stub === undefined ? null : stub;
  announcedRedisBacking = false;
};

/**
 * A `Store` that decides what it is backed by on first use instead of at
 * construction.
 *
 * express-rate-limit's `Store` contract is small — `init`, `increment`,
 * `decrement`, `resetKey`, optional `resetAll` and `shutdown`, plus a
 * `localKeys` flag — so delegation is mechanical. Two details are not:
 *
 *   - `prefix` is exposed because express-rate-limit's `singleCount` validator
 *     keys its per-request bookkeeping by `store.constructor.name` whenever
 *     `localKeys` is false. Every limiter here shares that class name, so
 *     without a distinct `prefix` two limiters incrementing the same IP in one
 *     request would trip a spurious `ERR_ERL_DOUBLE_COUNT`.
 *
 *   - `init(options)` may arrive before *or* after the backing store exists, so
 *     the options are retained and replayed onto whichever store is created
 *     later. A `RedisStore` that never received `init()` has no `windowMs` and
 *     sets no TTL, which would leak keys forever.
 */
export class LazyRateLimitStore {
  /**
   * @param {string} prefix   Redis key prefix for this limiter (e.g. `rl:api:`).
   * @param {object} [deps]   Injection seams for the test suite.
   * @param {() => any} [deps.getClient]   Resolves the Redis client.
   * @param {(msg: string) => void} [deps.log]
   */
  constructor(prefix, { getClient = getRedisClient, log = console.log } = {}) {
    this.prefix = prefix;

    this._getClient = getClient;
    this._log = log;

    /** Options handed over by `rateLimit()`; replayed onto late stores. */
    this._options = null;

    /** The store currently serving calls. Created on first use. */
    this._backing = null;

    /** True once `_backing` is the Redis-backed store. */
    this._usingRedis = false;
  }

  /**
   * Mirrors the backing store's own flag.
   *
   * Before resolution the honest answer is `true` — nothing is shared yet, and
   * memory is what the next call will use if Redis has not arrived.
   *
   * After resolution this is a plain truthiness check rather than a
   * `!== false` comparison, and the difference matters: `MemoryStore` sets
   * `localKeys = true` explicitly, while `rate-limit-redis`'s `RedisStore`
   * never sets the property at all. express-rate-limit reads that `undefined`
   * as "not local", so anything other than `Boolean(...)` here would report a
   * Redis-backed store as per-instance — the exact claim this issue is about.
   */
  get localKeys() {
    return this._backing ? Boolean(this._backing.localKeys) : true;
  }

  /** Test/diagnostic accessor — which backend is live right now. */
  get backing() {
    return this._usingRedis ? "redis" : this._backing ? "memory" : "unresolved";
  }

  init(options) {
    this._options = options;
    if (this._backing?.init) this._backing.init(options);
  }

  /**
   * Returns the store that should serve this call, upgrading from memory to
   * Redis the first time a ready client is available.
   */
  _resolve() {
    if (!this._usingRedis && this._tryUpgradeToRedis()) {
      return this._backing;
    }

    if (!this._backing) {
      this._backing = new MemoryStore();
      if (this._options) this._backing.init(this._options);
    }

    return this._backing;
  }

  /**
   * Attempts the one-way memory → Redis switch.
   *
   * Returns `true` only when the switch happened on this call. Every guard here
   * is cheap (a module variable read and a property check), which is what makes
   * it acceptable to re-attempt on each request until Redis appears.
   */
  _tryUpgradeToRedis() {
    if (!RedisStore) return false;

    let client;
    try {
      client = this._getClient();
    } catch {
      return false;
    }

    // `isReady` is what the rest of the codebase checks before issuing
    // commands (see `redisService.acquireLock`); a connecting-but-not-ready
    // client would throw on `sendCommand`.
    if (!client || !client.isReady) return false;

    let redisStore;
    try {
      redisStore = new RedisStore({
        sendCommand: (...args) => client.sendCommand(...args),
        prefix: this.prefix,
      });
    } catch (error) {
      // A malformed store must not take down request handling. Stay on memory
      // and let a later request try again.
      console.warn(
        `⚠️ Rate limiter could not build the Redis store for "${this.prefix}", staying on memory:`,
        error.message,
      );
      return false;
    }

    if (this._options && redisStore.init) redisStore.init(this._options);

    // Release the memory store's sweep interval so it does not keep the event
    // loop busy for a store nothing reads any more.
    if (this._backing?.shutdown) {
      try {
        this._backing.shutdown();
      } catch {
        // A store that fails to shut down is not worth failing a request over.
      }
    }

    this._backing = redisStore;
    this._usingRedis = true;

    if (!announcedRedisBacking) {
      announcedRedisBacking = true;
      this._log(
        "✅ Rate limiters are now backed by Redis (counters shared across instances)",
      );
    }

    return true;
  }

  async increment(key) {
    return this._resolve().increment(key);
  }

  async decrement(key) {
    return this._resolve().decrement(key);
  }

  async resetKey(key) {
    return this._resolve().resetKey(key);
  }

  async resetAll() {
    const store = this._resolve();
    if (typeof store.resetAll === "function") return store.resetAll();
    return undefined;
  }

  /**
   * Releases the backing store, if one was ever created.
   *
   * Nothing is resolved here on purpose — building a store during shutdown just
   * to tear it down would be backwards.
   */
  async shutdown() {
    const store = this._backing;
    this._backing = null;
    this._usingRedis = false;

    if (store?.shutdown) return store.shutdown();
    return undefined;
  }
}

/**
 * Factory used by `rateLimiter.js`.
 *
 * Named to read the same way the old `createStore(prefix)` did, so the diff at
 * the thirteen call sites is a single word.
 *
 * @param {string} prefix
 * @param {object} [deps]
 * @returns {LazyRateLimitStore}
 */
export const createRateLimitStore = (prefix, deps) =>
  new LazyRateLimitStore(prefix, deps);

/**
 * One-line summary of how limiting is currently configured, for the startup log.
 *
 * The point of this is that the old failure was *silent*: a deployment with
 * `REDIS_URI` set looked correctly configured and was not. Now the answer is
 * printed.
 *
 * @returns {{redisConfigured: boolean, storeAvailable: boolean, message: string}}
 */
export const describeRateLimitBacking = () => {
  const redisConfigured = Boolean(process.env.REDIS_URI);
  const storeAvailable = isRedisStoreAvailable();

  let message;
  if (!redisConfigured) {
    message =
      "ℹ️ Rate limiting is per-process (REDIS_URI not set). Limits apply per instance.";
  } else if (!storeAvailable) {
    message =
      "⚠️ REDIS_URI is set but `rate-limit-redis` could not be loaded — rate limiting is per-process.";
  } else {
    message =
      "ℹ️ Rate limiting will attach to Redis as soon as the client is ready.";
  }

  return { redisConfigured, storeAvailable, message };
};

export default createRateLimitStore;
