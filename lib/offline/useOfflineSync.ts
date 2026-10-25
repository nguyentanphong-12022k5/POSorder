"use client";

import { useEffect, useState } from "react";
import { offlineManager, NetworkStatus } from "./offlineManager";

export function useOfflineSync() {
  const [status, setStatus] = useState<NetworkStatus>(() => offlineManager.getStatus());
  const [pendingCount, setPendingCount] = useState<number>(() => offlineManager.getPendingCount());

  useEffect(() => {
    const unsubscribe = offlineManager.subscribe((newStatus, count) => {
      setStatus(newStatus);
      setPendingCount(count);
    });

    offlineManager.refreshPendingCount();

    return () => {
      unsubscribe();
    };
  }, []);

  const syncNow = async () => {
    return await offlineManager.replayPendingOrders();
  };

  return {
    status,
    isOnline: status === "ONLINE",
    isOffline: status === "OFFLINE",
    isSyncing: status === "SYNCING",
    pendingCount,
    syncNow,
  };
}
