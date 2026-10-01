export const GEOFENCE_M = 75;
export const MAX_ACCURACY_M = 300;
/** Reported accuracy is credited against the distance, but never by more than this. */
export const ACCURACY_CREDIT_M = 100;

export type GeofenceResult = "ok" | "low_accuracy" | "too_far";

/** distance(user, cafe) - min(accuracy, 100) <= 75 m; reject outright if accuracy > 300 m. */
export function checkGeofence(distance_m: number, accuracy_m: number): GeofenceResult {
  if (accuracy_m > MAX_ACCURACY_M) return "low_accuracy";
  return distance_m - Math.min(accuracy_m, ACCURACY_CREDIT_M) <= GEOFENCE_M ? "ok" : "too_far";
}
