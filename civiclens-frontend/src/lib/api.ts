const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://127.0.0.1:8000";

// --- Auth token management ---
// Token lives in memory + localStorage so it survives page reloads. All API calls
// attach it automatically via getAuthHeader().
let _authToken: string | null = null;

export function setAuthToken(token: string | null) {
  _authToken = token;
  if (typeof window !== "undefined") {
    if (token) localStorage.setItem("civiclens_token", token);
    else localStorage.removeItem("civiclens_token");
  }
}

export function getAuthToken(): string | null {
  if (_authToken) return _authToken;
  if (typeof window !== "undefined") {
    _authToken = localStorage.getItem("civiclens_token");
  }
  return _authToken;
}

function getAuthHeader(): Record<string, string> {
  const t = getAuthToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

export function authHeader(): Record<string, string> {
  return getAuthHeader();
}

export function imageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${API_BASE}${path}`;
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { Accept: "application/json", ...getAuthHeader(), ...init?.headers },
    cache: "no-store",
  });
  if (res.status === 401 && typeof window !== "undefined") {
    // token expired or invalid - clear it and bounce to login
    setAuthToken(null);
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json();
}

export type ScoreColor = "green" | "gray" | "red";

export interface Participant {
  person_id: string;
  name: string;
  current_score: number;
  score_color: ScoreColor;
  total_detections: number;
  image_url?: string | null;
  external_id?: string | null;
  source?: string | null;
}

export interface ParticipantDetail extends Participant {
  positive_event_count: number;
  negative_event_count: number;
  latest_detection_image_url: string | null;
  last_camera_name: string | null;
  last_match_confidence: number | null;
  first_seen: string | null;
  last_seen: string | null;
  phone?: string | null;
  address?: string | null;
  notes?: string | null;
}

export interface RecentEvent {
  event_id: number;
  person_id: string;
  name: string;
  event_type_id: string;
  camera_name: string;
  score_before: number;
  score_delta: number;
  score_after: number;
  occurred_at: string;
}

export interface RedListPerson {
  redlist_id: string;
  name: string;
  risk_level: "Low" | "Medium" | "High" | "Critical";
  category: string;
  active: boolean;
  detection_count: number;
  last_camera_name: string | null;
  last_seen: string | null;
  image_url?: string | null;
}

export interface Alert {
  alert_id: number;
  redlist_id: string;
  name: string;
  risk_level: string;
  camera_name: string;
  similarity_score: number;
  detection_image_path: string | null;
  image_url?: string | null;
  acknowledged: boolean;
  occurred_at: string;
  recommended_action: string;
}

export interface SceneEvent {
  scene_event_id: number;
  event_type: string;
  camera_name: string;
  detail: string | null;
  detection_image_path: string | null;
  image_url?: string | null;
  occurred_at: string;
}

export interface SceneAlert {
  alert_id: number;
  event_type: string;
  camera_name: string;
  zone_name: string | null;
  person_count: number | null;
  detail: string | null;
  image_url: string | null;
  acknowledged: boolean;
  occurred_at: string;
}

export interface CrowdEventData {
  alert_id: number;
  zone_name: string;
  person_count: number;
  camera_name: string;
  occurred_at: string | null;
  image_url: string | null;
  recommended_action: string;
}

export interface UnknownProfile {
  unknown_id: string;
  detection_count: number;
  last_camera_name: string | null;
  first_seen: string | null;
  last_seen: string | null;
  representative_image_path: string | null;
  image_url?: string | null;
}

export interface RedlistAlert {
  redlist_id: string;
  name: string;
  risk_level: string;
  similarity_score: number;
  camera_name: string;
  photo: string | null;
  previous_detection_count: number;
  recommended_action: string;
}

export interface MissingPersonAlertData {
  missing_id: string;
  name: string;
  age: number | null;
  similarity_score: number;
  camera_name: string;
  photo: string | null;
  previous_detection_count: number;
  contact_info: string | null;
}

export interface MissingPerson {
  missing_id: string;
  name: string;
  age: number | null;
  active: boolean;
  detection_count: number;
  last_camera_name: string | null;
  last_seen: string | null;
  reported_missing_since: string | null;
  image_url: string | null;
}

export interface MissingPersonAlertEntry {
  alert_id: number;
  camera_name: string;
  similarity_score: number;
  image_url: string | null;
  acknowledged: boolean;
  occurred_at: string;
}

export interface MissingPersonDetail extends MissingPerson {
  description: string | null;
  contact_info: string | null;
  first_seen: string | null;
  alerts: MissingPersonAlertEntry[];
}

export interface MissingPersonAlertListItem {
  alert_id: number;
  missing_id: string;
  name: string;
  camera_name: string;
  similarity_score: number;
  image_url: string | null;
  acknowledged: boolean;
  occurred_at: string;
}

export class MissingPersonDuplicateError extends Error {
  existingMissingId: string;
  existingName: string;
  similarity: number;

  constructor(detail: { existing_missing_id: string; existing_name: string; similarity: number }) {
    super("A similar missing person record already exists");
    this.existingMissingId = detail.existing_missing_id;
    this.existingName = detail.existing_name;
    this.similarity = detail.similarity;
  }
}

export interface EventType {
  event_type_id: string;
  display_name: string;
  category: "positive" | "negative";
  score_delta: number;
  description: string;
}

export interface IncidentLogEntry {
  event_id: number;
  person_id: string;
  name: string;
  event_type_id: string;
  camera_name: string;
  score_delta: number;
  score_after: number;
  occurred_at: string;
}

export interface TriggeredEvent {
  event_type_id: string;
  score_delta: number;
  score_after: number;
}

export interface DetectionResult {
  status: "matched" | "unknown";
  person_id?: string;
  name?: string;
  match_confidence?: number;
  current_score?: number;
  score_color?: ScoreColor;
  total_detections?: number;
  unknown_id?: string;
  message?: string;
  best_score?: number;
  detection_count?: number;
  face_bbox: [number, number, number, number];
  centroid: [number, number];
  triggered_events?: TriggeredEvent[];
  redlist_alert: RedlistAlert | null;
  missing_person_alert?: MissingPersonAlertData | null;
  image_url?: string | null;
  keypoints?: [number, number][] | null;
}

export interface SceneEventHit {
  event_type: "crowd_detected" | "crowd_surge" | "illegal_parking" | "loitering" | "unattended_object" | "road_accident";
  count?: number;
  vehicle_id?: string;
  object_id?: string;
  person_id?: string;
  bbox?: [number, number, number, number];
  dwell_seconds?: number;
  alert_id?: number;
  zone_name?: string;
  person_count?: number;
  from_count?: number;
  increase?: number;
  window_seconds?: number;
  camera_name?: string;
  occurred_at?: string | null;
  image_url?: string | null;
  recommended_action?: string;
  type?: "fallen_person" | "person_vehicle_overlap" | "vehicle_stopped_on_road" | "vehicle_collision" | "crashed_vehicle_pair";
  detail?: string;
}

export interface DetectFrameResponse {
  camera_name: string;
  camera_purpose?: string;
  person_count?: number;
  detections: DetectionResult[];
  scene_events: SceneEventHit[];
  error?: string;
}

export interface ParticipantEvent {
  event_id: number;
  event_type_id: string;
  camera_name: string;
  score_before: number;
  score_delta: number;
  score_after: number;
  occurred_at: string;
}

export interface ParticipantDetection {
  detection_id: number;
  camera_name: string;
  match_confidence: number | null;
  detection_image_path: string | null;
  image_url: string | null;
  centroid: [number, number] | null;
  detected_at: string;
}

export class RedListDuplicateError extends Error {
  existingRedlistId: string;
  existingName: string;
  similarity: number;

  constructor(detail: { existing_redlist_id: string; existing_name: string; similarity: number }) {
    super("A similar Red List profile already exists");
    this.existingRedlistId = detail.existing_redlist_id;
    this.existingName = detail.existing_name;
    this.similarity = detail.similarity;
  }
}

export interface RedListAlertEntry {
  alert_id: number;
  camera_name: string;
  similarity_score: number;
  risk_level: string;
  occurred_at: string;
}

export interface RedListDetail extends RedListPerson {
  notes: string;
  recommended_action: string;
  alerts: RedListAlertEntry[];
}

export interface AnalyticsSummary {
  score_distribution: { green: number; gray: number; red: number };
  event_type_counts: { event_type_id: string; count: number }[];
  redlist_risk_counts: Record<string, number>;
  scene_event_counts: Record<string, number>;
  total_alerts: number;
  total_participants: number;
}

export interface CameraInfo {
  camera_name: string;
  purpose: string;
  enabled_detections: string[];
  zones: Record<string, [number, number][]>;
  source_type?: "manual" | "rtsp" | "file";
  source_path?: string;
  capture_interval?: number;
  monitoring_enabled?: boolean;
}

export interface CameraSourceConfig {
  source_type: "manual" | "rtsp" | "file";
  source_path: string;
  capture_interval: number;
  monitoring_enabled: boolean;
}

export interface CameraImportResult {
  dry_run: boolean;
  filename: string;
  columns: string[];
  detected_columns: Record<string, string>;
  row_count: number;
  cameras: { camera_name: string; rtsp_url: string; purpose: string; capture_interval: number }[];
  already_exists: { row: number; camera: string }[];
  errors: { row: number; camera?: string; error: string }[];
  created: string[];
}

export interface MonitoringStatus {
  camera_name: string;
  purpose: string;
  state: "live" | "reconnecting" | "error" | "stopped";
  monitoring_active: boolean;
  person_count: number | null;
  face_count: number | null;
  alert_count: number | null;
  frames_processed: number;
  last_update: number | null;
  last_error: string | null;
  frame_url: string;
  source_type: "manual" | "rtsp" | "file";
  source_path: string | null;
  capture_interval: number;
  monitoring_enabled: boolean;
  has_zones: boolean;
}

export interface ZoneSuggestion {
  zone_type: string;
  label: string;
  confidence: number;
  polygon: [number, number][];
}

export interface ImportColumnMapping {
  name?: string;
  image?: string;
  external_id?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface ImportInspect {
  filename: string;
  columns: string[];
  row_count: number;
  preview_rows: Record<string, string>[];
  suggested_mapping: ImportColumnMapping;
  supported_fields: string[];
  required_fields: string[];
}

export interface BulkImportSummary {
  dry_run: boolean;
  source?: string | null;
  registered: { person_id: string; name: string; image: string; external_id?: string; phone?: string; address?: string; notes?: string }[];
  duplicates_skipped: { image: string; name: string; matched_person_id: string; similarity: number }[];
  no_face: { image: string; name: string }[];
  multiple_faces: { image: string; name: string; faces_detected: number }[];
  low_quality: { image: string; name: string; reason: string }[];
  errors: { image: string; name: string; error: string }[];
  unmatched_mapping_rows: { name: string; image: string }[];
}

export const api = {
  auth: {
    needsBootstrap: () => apiFetch<{ needs_bootstrap: boolean }>("/api/auth/needs-bootstrap"),
    bootstrap: (username: string, password: string, fullName: string) =>
      apiFetch<{ created: string; role: string }>("/api/auth/bootstrap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, full_name: fullName }),
      }),
    login: async (username: string, password: string) => {
      // OAuth2 password flow expects form-encoded, not JSON
      const form = new URLSearchParams();
      form.append("username", username);
      form.append("password", password);
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.detail === "string" ? body.detail : "Login failed");
      }
      return res.json() as Promise<{
        access_token: string;
        token_type: string;
        user: { username: string; full_name: string | null; role: string };
      }>;
    },
    me: () => apiFetch<{ username: string; full_name: string | null; role: string }>("/api/auth/me"),
    changePassword: (currentPassword: string, newPassword: string) =>
      apiFetch<{ changed: string }>("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      }),
    listUsers: () =>
      apiFetch<{ id: number; username: string; full_name: string | null; role: string; active: boolean; last_login: string | null }[]>(
        "/api/auth/users"
      ),
    createUser: (username: string, password: string, fullName: string, role: string) =>
      apiFetch<{ created: string; role: string }>("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, full_name: fullName, role }),
      }),
    deactivateUser: (userId: number) =>
      apiFetch<{ user_id: number; active: boolean }>(`/api/auth/users/${userId}/deactivate`, { method: "PATCH" }),
  },
  settings: {
    list: () =>
      apiFetch<
        { key: string; value: number; default: number; min: number; max: number; type: string; label: string; help: string }[]
      >("/api/settings"),
    update: (key: string, value: number) =>
      apiFetch<{ key: string; value: number }>(`/api/settings/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
      }),
  },
  health: () => apiFetch<{ status: string; service: string }>("/api/health"),
  participants: {
    list: () => apiFetch<Participant[]>("/api/participants"),
    get: (id: string) => apiFetch<ParticipantDetail>(`/api/participants/${id}`),
    events: (id: string) => apiFetch<ParticipantEvent[]>(`/api/participants/${id}/events`),
    detections: (id: string) => apiFetch<ParticipantDetection[]>(`/api/participants/${id}/detections`),
    register: async (name: string, faceImage: File): Promise<Participant> => {
      const formData = new FormData();
      formData.append("name", name);
      formData.append("face_image", faceImage);
      const res = await fetch(`${API_BASE}/api/participants`, { method: "POST", body: formData, headers: authHeader() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail ?? `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    remove: (id: string) => apiFetch<{ deleted: string }>(`/api/participants/${id}`, { method: "DELETE" }),
    bulkImport: async (
      zipFile: File,
      mappingFile: File | null,
      dryRun: boolean,
      columnMapping?: ImportColumnMapping,
      source?: string
    ): Promise<BulkImportSummary> => {
      const fd = new FormData();
      fd.append("zip_file", zipFile);
      if (mappingFile) fd.append("mapping_file", mappingFile);
      if (columnMapping) fd.append("column_mapping", JSON.stringify(columnMapping));
      if (source) fd.append("source", source);
      fd.append("dry_run", String(dryRun));
      const res = await fetch(`${API_BASE}/api/participants/bulk-import`, { method: "POST", body: fd, headers: authHeader() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.detail === "string" ? body.detail : `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    inspectImportFile: async (mappingFile: File): Promise<ImportInspect> => {
      const fd = new FormData();
      fd.append("mapping_file", mappingFile);
      const res = await fetch(`${API_BASE}/api/participants/bulk-import/inspect`, { method: "POST", body: fd, headers: authHeader() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.detail === "string" ? body.detail : `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
  },
  redlist: {
    list: (params?: { risk_level?: string; active?: boolean; name?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {}).reduce((acc, [k, v]) => {
          if (v !== undefined) acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>)
      ).toString();
      return apiFetch<RedListPerson[]>(`/api/redlist${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => apiFetch<RedListDetail>(`/api/redlist/${id}`),
    create: async (
      params: { name: string; riskLevel: string; category: string; notes: string; faceImage: File; force?: boolean }
    ): Promise<RedListPerson> => {
      const fd = new FormData();
      fd.append("name", params.name);
      fd.append("risk_level", params.riskLevel);
      fd.append("category", params.category);
      fd.append("notes", params.notes);
      fd.append("face_image", params.faceImage);
      fd.append("force", String(params.force ?? false));
      const res = await fetch(`${API_BASE}/api/redlist`, { method: "POST", body: fd, headers: authHeader() });
      if (res.status === 409) {
        const body = await res.json();
        throw new RedListDuplicateError(body.detail);
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.detail === "string" ? body.detail : `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    mergeImage: async (redlistId: string, faceImage: File) => {
      const fd = new FormData();
      fd.append("face_image", faceImage);
      const res = await fetch(`${API_BASE}/api/redlist/${redlistId}/merge-image`, { method: "POST", body: fd, headers: authHeader() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    update: (redlistId: string, fields: { name?: string; risk_level?: string; category?: string; notes?: string }) => {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined) fd.append(k, v);
      });
      return fetch(`${API_BASE}/api/redlist/${redlistId}`, { method: "PUT", body: fd, headers: authHeader() }).then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      });
    },
    activate: (id: string) => apiFetch(`/api/redlist/${id}/activate`, { method: "PATCH" }),
    deactivate: (id: string) => apiFetch(`/api/redlist/${id}/deactivate`, { method: "PATCH" }),
    remove: (id: string) => apiFetch<{ deleted: string }>(`/api/redlist/${id}`, { method: "DELETE" }),
  },
  missingPersons: {
    list: (params?: { active?: boolean; name?: string }) => {
      const qs = new URLSearchParams(
        Object.entries(params ?? {}).reduce((acc, [k, v]) => {
          if (v !== undefined) acc[k] = String(v);
          return acc;
        }, {} as Record<string, string>)
      ).toString();
      return apiFetch<MissingPerson[]>(`/api/missing-persons${qs ? `?${qs}` : ""}`);
    },
    get: (id: string) => apiFetch<MissingPersonDetail>(`/api/missing-persons/${id}`),
    checkSimilar: async (faceImage: File) => {
      const fd = new FormData();
      fd.append("face_image", faceImage);
      const res = await fetch(`${API_BASE}/api/missing-persons/check-similar`, { method: "POST", body: fd, headers: authHeader() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json() as Promise<{ possible_duplicates: { missing_id: string; name: string; similarity: number }[] }>;
    },
    create: async (
      params: { name: string; age?: string; description: string; contactInfo: string; faceImage: File; force?: boolean }
    ): Promise<MissingPerson> => {
      const fd = new FormData();
      fd.append("name", params.name);
      if (params.age) fd.append("age", params.age);
      fd.append("description", params.description);
      fd.append("contact_info", params.contactInfo);
      fd.append("face_image", params.faceImage);
      fd.append("force", String(params.force ?? false));
      const res = await fetch(`${API_BASE}/api/missing-persons`, { method: "POST", body: fd, headers: authHeader() });
      if (res.status === 409) {
        const body = await res.json();
        throw new MissingPersonDuplicateError(body.detail);
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.detail === "string" ? body.detail : `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    mergeImage: async (missingId: string, faceImage: File) => {
      const fd = new FormData();
      fd.append("face_image", faceImage);
      const res = await fetch(`${API_BASE}/api/missing-persons/${missingId}/merge-image`, { method: "POST", body: fd, headers: authHeader() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
    update: (missingId: string, fields: { name?: string; age?: string; description?: string; contact_info?: string }) => {
      const fd = new FormData();
      Object.entries(fields).forEach(([k, v]) => {
        if (v !== undefined) fd.append(k, v);
      });
      return fetch(`${API_BASE}/api/missing-persons/${missingId}`, { method: "PUT", body: fd, headers: authHeader() }).then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      });
    },
    markFound: (id: string) => apiFetch(`/api/missing-persons/${id}/mark-found`, { method: "PATCH" }),
    reopen: (id: string) => apiFetch(`/api/missing-persons/${id}/reopen`, { method: "PATCH" }),
    remove: (id: string) => apiFetch<{ deleted: string }>(`/api/missing-persons/${id}`, { method: "DELETE" }),
  },
  missingPersonAlerts: {
    list: (limit = 20) => apiFetch<MissingPersonAlertListItem[]>(`/api/missing-person-alerts?limit=${limit}`),
    acknowledge: (alertId: number) =>
      apiFetch<{ alert_id: number; acknowledged: boolean }>(`/api/missing-person-alerts/${alertId}/acknowledge`, {
        method: "PATCH",
      }),
  },
  eventTypes: {
    list: () => apiFetch<EventType[]>("/api/event-types"),
    create: (payload: EventType) =>
      apiFetch<EventType>("/api/event-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    update: (id: string, payload: EventType) =>
      apiFetch<EventType>(`/api/event-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    remove: (id: string) => apiFetch<{ deleted: string }>(`/api/event-types/${id}`, { method: "DELETE" }),
  },
  reports: {
    incidentLog: (limit = 200) => apiFetch<IncidentLogEntry[]>(`/api/reports/incident-log?limit=${limit}`),
  },
  alerts: {
    list: (limit = 20) => apiFetch<Alert[]>(`/api/alerts?limit=${limit}`),
    acknowledge: (alertId: number) =>
      apiFetch<{ alert_id: number; acknowledged: boolean }>(`/api/alerts/${alertId}/acknowledge`, {
        method: "PATCH",
      }),
  },
  dashboard: {
    recentEvents: (limit = 20) => apiFetch<RecentEvent[]>(`/api/dashboard/recent-events?limit=${limit}`),
  },
  sceneEvents: {
    list: (limit = 20) => apiFetch<SceneEvent[]>(`/api/scene-events?limit=${limit}`),
  },
  sceneAlerts: {
    list: (limit = 50, eventType?: string) =>
      apiFetch<SceneAlert[]>(`/api/scene-alerts?limit=${limit}${eventType ? `&event_type=${eventType}` : ""}`),
    acknowledge: (alertId: number) =>
      apiFetch<{ alert_id: number; acknowledged: boolean }>(`/api/scene-alerts/${alertId}/acknowledge`, {
        method: "PATCH",
      }),
  },
  detect: {
    frame: async (cameraName: string, blob: Blob): Promise<DetectFrameResponse> => {
      const formData = new FormData();
      formData.append("camera_name", cameraName);
      formData.append("image", blob, "frame.jpg");
      const res = await fetch(`${API_BASE}/api/detect/frame`, { method: "POST", body: formData, headers: authHeader() });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      return res.json();
    },
  },
  analytics: {
    summary: () => apiFetch<AnalyticsSummary>("/api/analytics/summary"),
  },
  cameras: {
    list: () => apiFetch<CameraInfo[]>("/api/cameras"),
    importCameras: async (file: File, dryRun: boolean): Promise<CameraImportResult> => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("dry_run", String(dryRun));
      const res = await fetch(`${API_BASE}/api/cameras/import`, { method: "POST", body: fd, headers: authHeader() });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(typeof body?.detail === "string" ? body.detail : `${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    create: (cameraName: string, purpose: string, enabledDetections: string[], source?: CameraSourceConfig) =>
      apiFetch<CameraInfo>("/api/cameras", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_name: cameraName,
          purpose,
          enabled_detections: enabledDetections,
          ...(source ?? {}),
        }),
      }),
    updateSettings: (cameraName: string, purpose: string, enabledDetections: string[], source?: CameraSourceConfig) =>
      apiFetch<CameraInfo>(`/api/cameras/${cameraName}/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          camera_name: cameraName,
          purpose,
          enabled_detections: enabledDetections,
          ...(source ?? {}),
        }),
      }),
    monitoringStatus: () => apiFetch<MonitoringStatus[]>("/api/cameras/monitoring/status"),
    startMonitoring: (name: string) =>
      apiFetch<{ started: boolean }>(`/api/cameras/${name}/monitoring/start`, { method: "POST" }),
    stopMonitoring: (name: string) =>
      apiFetch<{ stopped: boolean }>(`/api/cameras/${name}/monitoring/stop`, { method: "POST" }),
    startAllMonitoring: () =>
      apiFetch<{ started: string[]; skipped_no_source: string[] }>("/api/cameras/monitoring/start-all", {
        method: "POST",
      }),
    stopAllMonitoring: () =>
      apiFetch<{ stopped: number }>("/api/cameras/monitoring/stop-all", { method: "POST" }),
    getZones: (name: string) => apiFetch<{ camera_name: string; zones: Record<string, [number, number][]> }>(
      `/api/cameras/${name}/zones`
    ),
    saveZones: (name: string, zones: Record<string, [number, number][]>) =>
      apiFetch(`/api/cameras/zones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ camera_name: name, zones }),
      }),
    remove: (name: string) => apiFetch<{ deleted: string }>(`/api/cameras/${name}`, { method: "DELETE" }),
    suggestRoadZone: async (image: File | Blob, minConfidence = 0.5): Promise<ZoneSuggestion[]> => {
      const fd = new FormData();
      fd.append("image", image, "reference.jpg");
      const res = await fetch(`${API_BASE}/api/cameras/suggest-zones-segmentation?min_confidence=${minConfidence}`, {
        method: "POST",
        body: fd,
        headers: authHeader(),
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      return data.suggestions;
    },
  },
  unknownProfiles: {
    list: () => apiFetch<UnknownProfile[]>("/api/unknown-profiles"),
  },
};
