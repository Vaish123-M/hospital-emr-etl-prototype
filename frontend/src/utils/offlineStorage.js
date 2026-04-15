/**
 * Offline-first storage management for EMR
 * Saves form data locally when API fails and syncs when connection restored
 */

const STORAGE_KEYS = {
  PENDING_PATIENTS: "emr_pending_patients",
  PENDING_VISITS: "emr_pending_visits",
  SYNC_STATUS: "emr_sync_status",
  LAST_SYNC: "emr_last_sync",
};

export function savePendingPatient(patientData) {
  try {
    const pending = getPendingPatients();
    const newPatient = {
      id: Date.now(),
      data: patientData,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    pending.push(newPatient);
    localStorage.setItem(STORAGE_KEYS.PENDING_PATIENTS, JSON.stringify(pending));
    return newPatient.id;
  } catch (error) {
    console.error("Failed to save pending patient:", error);
    return null;
  }
}

export function savePendingVisit(visitData, patientId) {
  try {
    const pending = getPendingVisits();
    const newVisit = {
      id: Date.now(),
      patientId,
      data: visitData,
      timestamp: new Date().toISOString(),
      synced: false,
    };
    pending.push(newVisit);
    localStorage.setItem(STORAGE_KEYS.PENDING_VISITS, JSON.stringify(pending));
    return newVisit.id;
  } catch (error) {
    console.error("Failed to save pending visit:", error);
    return null;
  }
}

export function getPendingPatients() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_PATIENTS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to retrieve pending patients:", error);
    return [];
  }
}

export function getPendingVisits() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PENDING_VISITS);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error("Failed to retrieve pending visits:", error);
    return [];
  }
}

export function removePendingPatient(id) {
  try {
    const pending = getPendingPatients();
    const filtered = pending.filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEYS.PENDING_PATIENTS, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to remove pending patient:", error);
  }
}

export function removePendingVisit(id) {
  try {
    const pending = getPendingVisits();
    const filtered = pending.filter((v) => v.id !== id);
    localStorage.setItem(STORAGE_KEYS.PENDING_VISITS, JSON.stringify(filtered));
  } catch (error) {
    console.error("Failed to remove pending visit:", error);
  }
}

export function clearLocalQueue() {
  try {
    localStorage.removeItem(STORAGE_KEYS.PENDING_PATIENTS);
    localStorage.removeItem(STORAGE_KEYS.PENDING_VISITS);
  } catch (error) {
    console.error("Failed to clear local queue:", error);
  }
}

export function updateSyncStatus(status) {
  try {
    localStorage.setItem(STORAGE_KEYS.SYNC_STATUS, status);
  } catch (error) {
    console.error("Failed to update sync status:", error);
  }
}

export function getSyncStatus() {
  try {
    return localStorage.getItem(STORAGE_KEYS.SYNC_STATUS) || "synced";
  } catch {
    return "synced";
  }
}

export function setLastSyncTime() {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  } catch (error) {
    console.error("Failed to set last sync time:", error);
  }
}

export function getLastSyncTime() {
  try {
    return localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
  } catch {
    return null;
  }
}

export function isOnline() {
  return navigator.onLine;
}

export function getPendingCount() {
  const patients = getPendingPatients().filter((p) => !p.synced).length;
  const visits = getPendingVisits().filter((v) => !v.synced).length;
  return patients + visits;
}
