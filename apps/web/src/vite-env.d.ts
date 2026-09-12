/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_REVIEWED_CATALOGUE_HASH?: string;
  readonly VITE_INGESTION_API_URL?: string;
  readonly VITE_APP_ENV?: "development" | "staging" | "production";
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
