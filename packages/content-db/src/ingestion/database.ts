/** The synchronous SQL contract shared by local SQLite and Durable Object SQLite. */
export interface IngestionDatabase {
  pragma(statement: string): unknown;
  exec(statement: string): unknown;
  prepare(statement: string): {
    get(...bindings: unknown[]): unknown;
    all(...bindings: unknown[]): unknown[];
    run(...bindings: unknown[]): {
      changes: number;
      lastInsertRowid: number | bigint;
    };
  };
  transaction<T>(callback: () => T): (() => T) & { immediate(): T };
  close(): void;
}
