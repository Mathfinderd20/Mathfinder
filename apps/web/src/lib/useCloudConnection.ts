import { useSyncExternalStore } from "react";
import {
  getCloudConnectionState,
  subscribeToCloudConnection,
} from "./cloudPersistence";

export function useCloudConnection() {
  return useSyncExternalStore(
    subscribeToCloudConnection,
    getCloudConnectionState,
    getCloudConnectionState,
  );
}
