/**
 * =============================================================
 * src/utils/haversine.ts – Geospatial Utility Functions
 * =============================================================
 * Implements the Haversine formula for great-circle distance
 * between two GPS coordinates.
 *
 * FEATURES IMPLEMENTED:
 *  - Feature #3: Distance to critical locations (hospitals/schools)
 *    used in severity scoring – closer = higher severity
 *  - Feature #5: Worker-to-complaint distance for smart assignment
 *  - Feature #2: Duplicate detection within 50m radius
 *  - Feature #13: Anomaly detection – count complaints within 100m/30min
 *
 * Chennai landmarks hardcoded for demo (as specified in requirements).
 * In production, replace with Nominatim reverse geocode lookup.
 * =============================================================
 */

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * haversineDistance – Calculates distance between two coordinates
 * using the Haversine formula (accounts for Earth's curvature).
 *
 * @param a – First coordinate {lat, lng} in decimal degrees
 * @param b – Second coordinate {lat, lng} in decimal degrees
 * @returns Distance in meters
 *
 * Formula: d = 2r × arcsin(√(sin²(Δφ/2) + cos(φ1) × cos(φ2) × sin²(Δλ/2)))
 * where r = 6371000 meters (Earth's mean radius)
 */
export function haversineDistance(a: Coords, b: Coords): number {
  const R = 6371000; // Earth radius in meters

  // Convert decimal degrees to radians
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lng - a.lng) * Math.PI) / 180;

  const aCalc =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(aCalc), Math.sqrt(1 - aCalc));

  return R * c; // Distance in meters
}

/**
 * haversineDistanceKm – Same as above but returns km.
 * Used for ETA calculation (Feature #7): distance / 30 km/h = ETA in hours
 */
export function haversineDistanceKm(a: Coords, b: Coords): number {
  return haversineDistance(a, b) / 1000;
}

/**
 * calculateETA – Estimates worker arrival time.
 * Assumes average urban speed of 30 km/h.
 *
 * @param workerLoc – Worker's current GPS position
 * @param complaintLoc – Complaint location
 * @returns ETA in minutes (rounded up)
 */
export function calculateETA(workerLoc: Coords, complaintLoc: Coords): number {
  const distKm = haversineDistanceKm(workerLoc, complaintLoc);
  const speedKmH = 30; // Average city speed
  const etaHours = distKm / speedKmH;
  return Math.ceil(etaHours * 60); // Convert to minutes
}

/**
 * CHENNAI_CRITICAL_LOCATIONS – Hardcoded landmarks for demo.
 * Feature #3: If a complaint is within 500m of any of these,
 * severity score is boosted by +15 points.
 *
 * In production: query Nominatim API for amenity=hospital/school
 * within a bounding box, then use those coordinates dynamically.
 */
export const CHENNAI_CRITICAL_LOCATIONS: Array<{
  name: string;
  type: 'hospital' | 'school' | 'market';
  coords: Coords;
}> = [
  {
    name: 'Government General Hospital',
    type: 'hospital',
    coords: { lat: 13.0825, lng: 80.2662 },
  },
  {
    name: 'Apollo Hospital Greams Road',
    type: 'hospital',
    coords: { lat: 13.0569, lng: 80.2619 },
  },
  {
    name: 'Presidency College',
    type: 'school',
    coords: { lat: 13.0568, lng: 80.2814 },
  },
  {
    name: 'Anna Nagar Primary School',
    type: 'school',
    coords: { lat: 13.0838, lng: 80.2089 },
  },
  {
    name: 'T. Nagar Market',
    type: 'market',
    coords: { lat: 13.0418, lng: 80.2341 },
  },
];

/**
 * isNearCriticalLocation – Returns true and the location name
 * if the coordinate is within `radiusMeters` of any critical location.
 *
 * @param coords       – Coordinates to check
 * @param radiusMeters – Search radius (default 500m)
 */
export function isNearCriticalLocation(
  coords: Coords,
  radiusMeters = 500
): { near: boolean; locationName?: string; locationType?: string } {
  for (const loc of CHENNAI_CRITICAL_LOCATIONS) {
    const dist = haversineDistance(coords, loc.coords);
    if (dist <= radiusMeters) {
      return { near: true, locationName: loc.name, locationType: loc.type };
    }
  }
  return { near: false };
}

/**
 * getBoundingBox – Returns a lat/lng bounding box around a point.
 * Used for MongoDB queries to pre-filter documents before
 * exact haversine calculation (avoids full collection scan).
 *
 * @param center       – Center coordinates
 * @param radiusMeters – Radius in meters
 * @returns { minLat, maxLat, minLng, maxLng }
 */
export function getBoundingBox(
  center: Coords,
  radiusMeters: number
): { minLat: number; maxLat: number; minLng: number; maxLng: number } {
  // 1 degree latitude ≈ 111,000 meters
  const latDelta = radiusMeters / 111000;
  // 1 degree longitude ≈ 111,000 * cos(lat) meters
  const lngDelta = radiusMeters / (111000 * Math.cos((center.lat * Math.PI) / 180));

  return {
    minLat: center.lat - latDelta,
    maxLat: center.lat + latDelta,
    minLng: center.lng - lngDelta,
    maxLng: center.lng + lngDelta,
  };
}
