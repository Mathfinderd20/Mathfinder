import { readAppEnvironment } from "./buildEnvironment";

export const appEnvironment = readAppEnvironment(
  import.meta.env.VITE_APP_ENV ??
    (import.meta.env.DEV ? "development" : undefined),
);
