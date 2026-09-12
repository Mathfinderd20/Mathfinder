import type {
  DurableObjectStorage,
  SqlStorageValue,
} from "@cloudflare/workers-types";
import type { IngestionDatabase } from "../database";

/** Retains the existing SQL schema and transaction boundaries. */
export class DurableSqlite implements IngestionDatabase {
  constructor(private readonly storage: DurableObjectStorage) {}
  pragma(statement: string) {
    if (
      statement === "journal_mode = WAL" ||
      statement === "secure_delete = ON"
    ) {
      // Cloudflare owns journaling and historical recovery. These local SQLite
      // settings cannot promise erasure of provider-managed snapshots.
      return;
    }
    if (statement !== "foreign_keys = ON")
      throw new Error("Unsupported storage pragma");
    this.storage.sql.exec("PRAGMA foreign_keys = ON");
  }
  exec(statement: string) {
    this.storage.sql.exec(statement).toArray();
  }
  prepare(statement: string) {
    const query = (bindings: unknown[]) => {
      if (bindings.length > 100) throw new Error("Storage binding limit");
      for (const value of bindings) {
        if (value !== null && !["string", "number"].includes(typeof value))
          throw new Error("Unsupported storage binding");
      }
      // Leave headroom under the provider's 2 MB string/row bound.
      const bytes = bindings.reduce<number>(
        (n, value) =>
          n +
          (typeof value === "string"
            ? new TextEncoder().encode(value).length
            : 8),
        0,
      );
      if (bytes > 1_900_000)
        throw new Error("Storage row limit; source requires smaller fragments");
      return this.storage.sql.exec(
        statement,
        ...(bindings as SqlStorageValue[]),
      );
    };
    return {
      all: (...bindings: unknown[]) => query(bindings).toArray(),
      get: (...bindings: unknown[]) => query(bindings).toArray()[0],
      run: (...bindings: unknown[]) => {
        query(bindings).toArray();
        const result = this.storage.sql
          .exec<{ changes: number; id: number }>(
            "SELECT changes() AS changes, last_insert_rowid() AS id",
          )
          .one();
        return { changes: result.changes, lastInsertRowid: result.id };
      },
    };
  }
  transaction<T>(callback: () => T) {
    const run = () => this.storage.transactionSync(callback);
    return Object.assign(run, { immediate: run });
  }
  close() {
    /* The Durable Object owns storage lifetime. */
  }
}
