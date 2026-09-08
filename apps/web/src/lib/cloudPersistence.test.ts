import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  user: { id: "user-a", email: "a@example.test", is_anonymous: false },
  authError: null as unknown,
  selectFailures: {} as Record<
    string,
    { remaining: number; error: unknown; status: number }
  >,
  rows: {} as Record<string, Record<string, unknown>[]>,
  mutations: [] as string[],
  cache: undefined as unknown,
  callback: undefined as
    undefined | ((event: string, session: unknown) => void),
}));
vi.mock("./supabaseClient", () => ({
  storedOfflineUser: () => undefined,
  supabase: {
    auth: {
      getSession: async () => ({
        data: { session: { user: mocks.user } },
        error: null,
      }),
      getUser: async () => ({
        data: { user: mocks.user },
        error: mocks.authError,
      }),
      onAuthStateChange: (fn: typeof mocks.callback) => {
        mocks.callback = fn;
      },
      signOut: async () => ({ error: null }),
    },
    from: (table: string) => {
      let action = "select";
      let payload: Record<string, unknown> = {};
      const filters: Record<string, unknown> = {};
      let single = false;
      const chain = {
        select: () => chain,
        match: (value: Record<string, unknown>) => {
          Object.assign(filters, value);
          return chain;
        },
        eq: (key: string, value: unknown) => {
          filters[key] = value;
          return chain;
        },
        is: (key: string, value: unknown) => {
          filters[key] = value;
          return chain;
        },
        maybeSingle: () => {
          single = true;
          return chain;
        },
        insert: (value: Record<string, unknown>) => {
          action = "insert";
          payload = value;
          return chain;
        },
        update: (value: Record<string, unknown>) => {
          action = "update";
          payload = value;
          return chain;
        },
        delete: () => {
          action = "delete";
          return chain;
        },
        then: (resolve: (value: unknown) => unknown) => {
          const failure = mocks.selectFailures[table];
          if (action === "select" && failure?.remaining) {
            failure.remaining--;
            return Promise.resolve(
              resolve({
                data: null,
                error: failure.error,
                status: failure.status,
              }),
            );
          }
          const rows = mocks.rows[table] ?? [];
          let data = rows.filter((row) =>
            Object.entries(filters).every(([k, v]) => (row[k] ?? null) === v),
          );
          if (action !== "select") mocks.mutations.push(`${action}:${table}`);
          if (action === "update")
            data.forEach((row) =>
              Object.assign(row, payload, {
                updated_at: "2026-09-06T00:00:00Z",
              }),
            );
          if (action === "delete")
            mocks.rows[table] = rows.filter((row) => !data.includes(row));
          if (action === "insert") {
            data = [{ ...payload, updated_at: "2026-09-06T00:00:00Z" }];
            mocks.rows[table] = [...rows, ...data];
          }
          return Promise.resolve(
            resolve({
              data: single ? (data[0] ?? null) : data,
              error: null,
              status: 200,
            }),
          );
        },
      };
      return chain;
    },
  },
}));
vi.mock("./accountCache", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  readCache: async (_key: string, id: string) => {
    const cache = mocks.cache as { userId?: string } | undefined;
    return cache?.userId === id ? cache : undefined;
  },
  writeCache: async (_key: string, value: unknown) => {
    mocks.cache = value;
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("window", new EventTarget());
  mocks.user = { id: "user-a", email: "a@example.test", is_anonymous: false };
  mocks.authError = null;
  mocks.selectFailures = {};
  mocks.mutations = [];
  mocks.cache = undefined;
  mocks.rows = {
    profiles: [
      {
        id: "user-a",
        saved_build_slots: [],
        updated_at: "2026-09-05T00:00:00Z",
      },
    ],
    characters: [
      {
        id: "hero",
        owner_id: "user-a",
        name: "Hero",
        ancestry_name: "Human",
        class_summary: "Fighter",
        level: 1,
        build: {
          name: "Hero",
          race: { name: "Human" },
          levels: [{ className: "Fighter" }],
        },
        build_version: 1,
        created_at: "2026-09-05T00:00:00Z",
        updated_at: "2026-09-05T00:00:00Z",
      },
    ],
  };
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("authenticated persistence", () => {
  it("loads server data without uploading legacy browser records", async () => {
    const cloud = await import("./cloudPersistence");
    await cloud.initializeCloudPersistence();
    expect(cloud.getCloudConnectionState().status).toBe("connected");
    expect(mocks.mutations).toEqual([]);
    expect(mocks.cache).toMatchObject({ userId: "user-a", version: 1 });
  });
  it("caches offline edits, restores them after reload, and syncs on reconnection", async () => {
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    mocks.authError = new Error("Failed to fetch");
    await cloud.reconnect();
    expect(cloud.getCloudConnectionState().status).toBe("offline");
    const key = "mathfinder:characters:v1";
    const value = JSON.parse(cache.accountStorage.getItem(key)!);
    value.characters[0].name = "Offline hero";
    value.characters[0].build.name = "Offline hero";
    cache.accountStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event("mathfinder:local-data-changed"));
    await vi.advanceTimersByTimeAsync(600);
    expect(mocks.mutations).toEqual([]);
    expect(mocks.cache).toMatchObject({
      entries: { [key]: expect.stringContaining("Offline hero") },
    });
    vi.resetModules();
    vi.stubGlobal("window", new EventTarget());
    const restored = await import("./cloudPersistence");
    await restored.initializeCloudPersistence();
    expect(restored.getCloudConnectionState()).toMatchObject({
      status: "offline",
      pending: true,
    });
    mocks.authError = null;
    await restored.reconnect();
    expect(restored.getCloudConnectionState()).toMatchObject({
      status: "connected",
      pending: false,
    });
    expect(mocks.rows.characters![0]!.name).toBe("Offline hero");
  });
  it("rejects invalid sessions instead of using an offline fallback", async () => {
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    mocks.authError = { status: 401, message: "Invalid token" };
    await cloud.reconnect();
    expect(cloud.getCloudConnectionState().status).toBe("signedOut");
    expect(cache.currentEntries()).toEqual({});
  });
  it("retries a transient future-JWT response without signing out", async () => {
    mocks.selectFailures.characters = {
      remaining: 1,
      error: { code: "PGRST303", message: "JWT issued at future" },
      status: 401,
    };
    const cloud = await import("./cloudPersistence");
    const initializing = cloud.initializeCloudPersistence();

    await vi.advanceTimersByTimeAsync(1000);
    await initializing;

    expect(cloud.getCloudConnectionState().status).toBe("connected");
  });
  it("restores a matching account cache after a page reload during an outage", async () => {
    const first = await import("./cloudPersistence");
    await first.initializeCloudPersistence();
    vi.resetModules();
    vi.stubGlobal("window", new EventTarget());
    mocks.authError = new Error("Network offline");
    const restarted = await import("./cloudPersistence");
    await restarted.initializeCloudPersistence();
    expect(restarted.getCloudConnectionState()).toMatchObject({
      status: "offline",
      userId: "user-a",
    });
    const cache = await import("./accountCache");
    expect(cache.accountStorage.getItem("mathfinder:characters:v1")).toContain(
      "Hero",
    );
  });
  it("never signs anonymous development users into the app", async () => {
    mocks.user.is_anonymous = true;
    const cloud = await import("./cloudPersistence");
    await cloud.initializeCloudPersistence();
    expect(cloud.getCloudConnectionState().status).toBe("signedOut");
    expect(mocks.cache).toBeUndefined();
  });
  it("does not delete characters added by another device", async () => {
    const cloud = await import("./cloudPersistence");
    await cloud.initializeCloudPersistence();
    mocks.rows.characters!.push({
      ...mocks.rows.characters![0],
      id: "new-on-other-device",
    });
    await cloud.reconnect();
    expect(mocks.mutations).toEqual([]);
    expect(mocks.rows.characters).toHaveLength(2);
  });
  it("retains a conflicting edit and does not overwrite the server", async () => {
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    const key = "mathfinder:characters:v1";
    const value = JSON.parse(cache.accountStorage.getItem(key)!);
    value.characters[0].name = "Local edit";
    value.characters[0].build.name = "Local edit";
    cache.accountStorage.setItem(key, JSON.stringify(value));
    mocks.rows.characters![0]!.updated_at = "2026-09-07T00:00:00Z";
    await cloud.reconnect();
    expect(cloud.getCloudConnectionState()).toMatchObject({
      status: "offline",
      pending: true,
      message: expect.stringContaining("Conflict:"),
    });
    expect(mocks.mutations).toEqual([]);
    expect(cache.accountStorage.getItem(key)).toContain("Local edit");
  });
  it("saves only the changed record and clears the pending marker", async () => {
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    const key = "mathfinder:characters:v1";
    const value = JSON.parse(cache.accountStorage.getItem(key)!);
    value.characters[0].name = "Renamed";
    value.characters[0].build.name = "Renamed";
    cache.accountStorage.setItem(key, JSON.stringify(value));
    await cloud.reconnect();
    expect(mocks.mutations).toEqual(["update:characters"]);
    expect(cloud.getCloudConnectionState()).toMatchObject({
      status: "connected",
      pending: false,
    });
  });
  it("syncs existing build-slot functionality to the account profile", async () => {
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    cache.accountStorage.setItem(
      "mathfinder:web-build-slots:v1",
      JSON.stringify([{ id: "slot", label: "Backup", build: {} }]),
    );
    await cloud.reconnect();
    expect(mocks.mutations).toEqual(["update:profiles"]);
    expect(cloud.getCloudConnectionState()).toMatchObject({
      status: "connected",
      pending: false,
    });
  });
  it("loads the reusable campaign ID into the account cache", async () => {
    mocks.rows.campaigns = [
      {
        id: "campaign-a",
        owner_id: "user-a",
        join_code: "ABCD1234EF567890ABCD",
        name: "The Long Road",
        description: null,
        created_at: "2026-09-05T00:00:00Z",
        updated_at: "2026-09-05T00:00:00Z",
        archived_at: null,
      },
    ];
    mocks.rows.campaign_members = [
      { campaign_id: "campaign-a", user_id: "user-a", role: "gm" },
    ];
    mocks.rows.campaign_characters = [];
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    const stored = JSON.parse(
      cache.accountStorage.getItem("mathfinder:campaigns:v1")!,
    );
    expect(stored.campaigns[0]).toMatchObject({
      id: "campaign-a",
      joinCode: "ABCD1234EF567890ABCD",
      role: "gm",
    });
  });
  it("clears the previous account from memory before loading another", async () => {
    const cloud = await import("./cloudPersistence");
    const cache = await import("./accountCache");
    await cloud.initializeCloudPersistence();
    mocks.user = { id: "user-b", email: "b@example.test", is_anonymous: false };
    mocks.rows.characters = [];
    mocks.callback!("SIGNED_IN", { user: mocks.user });
    await vi.advanceTimersByTimeAsync(1);
    expect(cloud.getCloudConnectionState()).toMatchObject({ userId: "user-b" });
    expect(JSON.stringify(cache.currentEntries())).not.toContain("Hero");
  });
});
