import { useEffect, useState } from "react";
import axios from "axios";
import {
  getPendingPatients,
  getPendingVisits,
  removePendingPatient,
  removePendingVisit,
  isOnline,
  updateSyncStatus,
  getPendingCount,
  setLastSyncTime,
} from "../utils/offlineStorage";
import { getApiBaseUrl } from "../utils/apiBaseUrl";

const API_BASE_URL = getApiBaseUrl();

export default function OfflineSync() {
  const [isOnlineStatus, setIsOnlineStatus] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    function handleOnline() {
      setIsOnlineStatus(true);
      syncPendingRecords();
    }

    function handleOffline() {
      setIsOnlineStatus(false);
      updateSyncStatus("offline");
    }

    // Set up listeners
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Update pending count periodically
    const countInterval = setInterval(() => {
      setPendingCount(getPendingCount());
    }, 1000);

    // Try to sync periodically
    const syncInterval = setInterval(() => {
      if (isOnline() && getPendingCount() > 0) {
        syncPendingRecords();
      }
    }, 5000);

    setPendingCount(getPendingCount());

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(countInterval);
      clearInterval(syncInterval);
    };
  }, []);

  async function syncPendingRecords() {
    if (!isOnline() || syncing) return;

    setSyncing(true);
    updateSyncStatus("syncing");

    try {
      const pendingPatients = getPendingPatients();
      const pendingVisits = getPendingVisits();

      // Sync patients first
      for (const patient of pendingPatients) {
        if (!patient.synced) {
          try {
            await axios.post(`${API_BASE_URL}/patients`, patient.data);
            removePendingPatient(patient.id);
          } catch (error) {
            console.error("Failed to sync patient:", error);
          }
        }
      }

      // Then sync visits
      for (const visit of pendingVisits) {
        if (!visit.synced) {
          try {
            await axios.post(`${API_BASE_URL}/visits`, visit.data);
            removePendingVisit(visit.id);
          } catch (error) {
            console.error("Failed to sync visit:", error);
          }
        }
      }

      if (getPendingCount() === 0) {
        updateSyncStatus("synced");
        setLastSyncTime();
      }
    } catch (error) {
      console.error("Sync error:", error);
      updateSyncStatus("error");
    } finally {
      setSyncing(false);
      setPendingCount(getPendingCount());
    }
  }

  if (!isOnlineStatus) {
    return (
      <div className="mb-4 rounded-lg border border-yellow-300 bg-yellow-50 p-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">📡</span>
          <div className="flex-1">
            <p className="font-semibold text-yellow-900">Offline Mode</p>
            <p className="text-xs text-yellow-800">
              {pendingCount > 0
                ? `${pendingCount} pending record(s) will sync when connection restored`
                : "Working offline - forms will save locally"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (pendingCount > 0) {
    return (
      <div className="mb-4 rounded-lg border border-blue-300 bg-blue-50 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">{syncing ? "⏳" : "✅"}</span>
            <div>
              <p className="font-semibold text-blue-900">
                {syncing ? "Syncing..." : "Ready to sync"}
              </p>
              <p className="text-xs text-blue-800">
                {pendingCount} pending record(s) waiting to sync
              </p>
            </div>
          </div>
          {!syncing && (
            <button
              onClick={syncPendingRecords}
              className="rounded-lg bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-blue-700"
            >
              Sync Now
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
