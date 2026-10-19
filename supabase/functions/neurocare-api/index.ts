import { createClient } from "npm:@supabase/supabase-js@2.58.0";
import bcrypt from "npm:bcryptjs@2.4.3";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SECRET_KEYS_TEXT = Deno.env.get("SUPABASE_SECRET_KEYS");
const SECRET_KEYS = SECRET_KEYS_TEXT ? JSON.parse(SECRET_KEYS_TEXT) : {};
const SUPABASE_SECRET_KEY = SECRET_KEYS.default || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
if (!SUPABASE_URL || !SUPABASE_SECRET_KEY) {
  throw new Error("SUPABASE_URL and a server-side Supabase secret key are required.");
}

const db = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
const ALLOWED_ORIGINS = new Set([
  "https://app.mhsaffari.ir",
  "https://doctor-app.mhsaffari.ir",
  "http://localhost:5500",
  "http://127.0.0.1:5500",
]);
const CLINIC_CODE = String(Deno.env.get("CLINIC_CODE") || "SAFFARI").trim().toUpperCase();
const DISEASES = new Set(["migraine", "ms", "epilepsy", "parkinson", "cognition", "unassigned"]);
const APPOINTMENT_STATUSES = new Set(["requested", "confirmed", "rejected", "completed", "cancelled"]);

class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}
type Session = { id: string; subject_id: string; role: "patient" | "doctor"; expires_at: string };

const enc = new TextEncoder();
const json = (body: unknown, status = 200, origin: string | null = null) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": origin || "https://app.mhsaffari.ir",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Vary": "Origin",
  },
});
const text = (value: unknown, max = 4000) => String(value ?? "").trim().slice(0, max);
const digits = (value: unknown) => String(value ?? "")
  .replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0))
  .replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660));
const normalizePhone = (value: unknown) => digits(value).replace(/[\s-]/g, "");
const isMobile = (value: string) => /^09\d{9}$/.test(value);
const isNationalId = (value: string) => /^\d{10}$/.test(value);
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const isTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
const diseaseOrNull = (value: unknown) => {
  const v = text(value || "unassigned", 30);
  return DISEASES.has(v) ? v : null;
};
const safePatient = (row: Record<string, any>, forDoctor = false) => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  mobile: row.mobile,
  nationalId: forDoctor ? "••••••" + String(row.national_id || "").slice(-4) : row.national_id,
  diseaseCode: row.disease_code,
  status: row.status,
  createdAt: row.created_at,
  requiresPasswordChange: !row.password_changed_at,
});
const safeAppointment = (row: Record<string, any>) => ({
  id: row.id,
  patientId: row.patient_id,
  patientName: row.patient_name || undefined,
  patientMobile: row.patient_mobile || undefined,
  preferredDate: row.preferred_date,
  preferredTime: row.preferred_time,
  reason: row.reason || "",
  status: row.status,
  doctorNote: row.doctor_note || "",
  createdAt: row.created_at,
});
const hashText = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(value));
  return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, "0")).join("");
};
const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(v => v.toString(16).padStart(2, "0")).join("");
};
function routeFor(url: URL) {
  const pathname = url.pathname;
  const functionMarker = "/functions/v1/neurocare-api";
  const functionIndex = pathname.indexOf(functionMarker);
  if (functionIndex >= 0) {
    const remainder = pathname.slice(functionIndex + functionMarker.length);
    if (remainder === "" || remainder === "/") return "/health";
    return remainder;
  }
  const versionIndex = pathname.lastIndexOf("/v1/");
  if (versionIndex >= 0) return pathname.slice(versionIndex);
  if (pathname.endsWith("/health")) return "/health";
  return pathname;
}
async function audit(session: { subject_id: string; role: string }, action: string, subjectType: string, subjectId: string, metadata: Record<string, unknown> = {}) {
  const { error } = await db.from("audit_events").insert({
    actor_id: session.subject_id, actor_role: session.role, action,
    subject_type: subjectType, subject_id: String(subjectId), metadata,
  });
  if (error) console.error("audit insert failed:", error.message);
}
function ipFrom(req: Request) {
  return req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}
async function limitAttempt(identifier: string, limit: number, windowSeconds = 900) {
  const identifierHash = await hashText(identifier);
  const { data, error } = await db.rpc("consume_auth_rate_limit", {
    p_identifier_hash: identifierHash,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });
  if (error) {
    console.error("rate limit check failed:", error.message);
    throw new HttpError(503, "rate_limit_unavailable");
  }
  if (data !== true) throw new HttpError(429, "too_many_attempts");
}
async function limitAuth(req: Request, identifier: string, scope: "patient" | "doctor" | "register") {
  const ip = ipFrom(req);
  await limitAttempt(scope + ":ip:" + ip, scope === "doctor" ? 30 : 40);
  await limitAttempt(scope + ":identity:" + identifier, scope === "doctor" ? 10 : 8);
}
async function makeSession(subjectId: string, role: "patient" | "doctor") {
  const token = randomToken();
  const tokenHash = await hashText(token);
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString();
  const { error } = await db.from("sessions").insert({
    token_hash: tokenHash, subject_id: subjectId, role, expires_at: expiresAt,
  });
  if (error) {
    console.error("session creation failed:", error.message);
    throw new HttpError(500, "server_error");
  }
  // Opportunistic cleanup keeps the free-tier database compact.
  await db.from("sessions").delete().lt("expires_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  return token;
}
async function getSession(req: Request): Promise<Session> {
  const header = req.headers.get("authorization") || "";
  const token = header.replace(/^Bearer\s+/i, "").trim();
  if (!token || token.length < 32) throw new HttpError(401, "unauthorized");
  const tokenHash = await hashText(token);
  const { data, error } = await db.from("sessions")
    .select("id,subject_id,role,expires_at")
    .eq("token_hash", tokenHash)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error || !data) throw new HttpError(401, "unauthorized");
  return data as Session;
}
async function patientById(id: string) {
  const { data, error } = await db.from("patients").select("*").eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, "server_error");
  if (!data) throw new HttpError(404, "patient_not_found");
  return data;
}
async function requireActivePatient(session: Session) {
  const patient = await patientById(session.subject_id);
  if (patient.status !== "active") {
    throw new HttpError(403, patient.status === "rejected" ? "registration_rejected" : "awaiting_doctor_approval");
  }
  if (!patient.password_changed_at) throw new HttpError(403, "password_change_required");
  return patient;
}
async function requireDoctor(session: Session) {
  if (session.role !== "doctor") throw new HttpError(403, "forbidden");
  const { data, error } = await db.from("doctor_accounts").select("id,display_name,active")
    .eq("id", session.subject_id).maybeSingle();
  if (error || !data || !data.active) throw new HttpError(401, "unauthorized");
  return data;
}
async function validatePatientId(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(400, "invalid_patient_id");
  const { data, error } = await db.from("patients").select("id").eq("id", id).maybeSingle();
  if (error) throw new HttpError(500, "server_error");
  if (!data) throw new HttpError(404, "patient_not_found");
}
async function bodyJson(req: Request) {
  try {
    return await req.json();
  } catch {
    throw new HttpError(400, "invalid_json");
  }
}
async function handle(req: Request, route: string): Promise<{ body: unknown; status?: number }> {
  if ((route === "/health" || route === "/v1/health") && req.method === "GET") {
    const { error } = await db.from("patients").select("id").limit(1);
    if (error) {
      console.error("health check failed:", error.message);
      throw new HttpError(503, "database_unavailable");
    }
    return { body: { status: "ok", service: "saffari-neurocare-supabase", version: "1.0.0" } };
  }

  // Public registration and login.
  if (req.method === "POST" && route === "/v1/patients/register") {
    const b = await bodyJson(req);
    const firstName = text(b.firstName, 100);
    const lastName = text(b.lastName, 100);
    const mobile = normalizePhone(b.mobile);
    const nationalId = normalizePhone(b.nationalId);
    const diseaseCode = diseaseOrNull(b.diseaseCode);
    const clinicCode = text(b.clinicCode, 40).toUpperCase();
    if (!firstName || !lastName || !isMobile(mobile) || !isNationalId(nationalId) || !diseaseCode) {
      throw new HttpError(400, "invalid_registration_data");
    }
    if (clinicCode !== CLINIC_CODE) throw new HttpError(400, "invalid_clinic_code");
    await limitAuth(req, mobile, "register");
    const { data: duplicate, error: duplicateError } = await db.from("patients").select("id")
      .or("mobile.eq." + mobile + ",national_id.eq." + nationalId).limit(1);
    if (duplicateError) throw new HttpError(500, "server_error");
    if (duplicate?.length) throw new HttpError(409, "patient_already_registered");
    const passwordHash = await bcrypt.hash(nationalId, 12);
    const { data: row, error } = await db.from("patients").insert({
      first_name: firstName, last_name: lastName, mobile, national_id: nationalId,
      password_hash: passwordHash, password_changed_at: null,
      disease_code: diseaseCode, status: "pending_review",
    }).select("*").single();
    if (error) {
      if (error.code === "23505") throw new HttpError(409, "patient_already_registered");
      console.error("patient registration failed:", error.message);
      throw new HttpError(500, "server_error");
    }
    const session: Session = { id: "", subject_id: row.id, role: "patient", expires_at: "" };
    await audit(session, "patient.register", "patient", row.id);
    return { status: 201, body: { patient: safePatient(row), token: await makeSession(row.id, "patient") } };
  }

  if (req.method === "POST" && route === "/v1/patients/login") {
    const b = await bodyJson(req);
    const mobile = normalizePhone(b.mobile);
    // Old mobile builds still send nationalId; new web builds send password.
    const password = text(b.password ?? b.nationalId, 100);
    if (!isMobile(mobile) || !password) throw new HttpError(400, "invalid_credentials");
    await limitAuth(req, mobile, "patient");
    const { data: row, error } = await db.from("patients").select("*").eq("mobile", mobile).maybeSingle();
    if (error) throw new HttpError(500, "server_error");
    if (!row || !(await bcrypt.compare(password, row.password_hash))) throw new HttpError(401, "invalid_credentials");
    const session: Session = { id: "", subject_id: row.id, role: "patient", expires_at: "" };
    await audit(session, "patient.login", "patient", row.id);
    return { body: { patient: safePatient(row), token: await makeSession(row.id, "patient") } };
  }

  if (req.method === "POST" && route === "/v1/doctor/login") {
    const b = await bodyJson(req);
    const code = text(b.clinicCode, 40).toUpperCase();
    const password = String(b.password || "");
    if (!code || !password) throw new HttpError(400, "invalid_credentials");
    await limitAuth(req, code, "doctor");
    const { data: doctor, error } = await db.from("doctor_accounts").select("*").eq("clinic_code", code).maybeSingle();
    if (error) throw new HttpError(500, "server_error");
    if (!doctor || !doctor.active || !(await bcrypt.compare(password, doctor.password_hash))) {
      throw new HttpError(401, "invalid_credentials");
    }
    const session: Session = { id: "", subject_id: doctor.id, role: "doctor", expires_at: "" };
    await audit(session, "doctor.login", "session", doctor.id);
    return { body: { token: await makeSession(doctor.id, "doctor") } };
  }

  const session = await getSession(req);

  if (req.method === "POST" && route === "/v1/logout") {
    await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("id", session.id);
    return { body: { ok: true } };
  }

  if (session.role === "patient" && req.method === "GET" && route === "/v1/patients/me") {
    const row = await patientById(session.subject_id);
    return { body: { patient: safePatient(row) } };
  }

  if (session.role === "patient" && req.method === "POST" && route === "/v1/patients/change-password") {
    const b = await bodyJson(req);
    const currentPassword = text(b.currentPassword, 100);
    const newPassword = String(b.newPassword || "");
    if (newPassword.length < 12 || newPassword.length > 128) throw new HttpError(400, "password_min_length_12");
    const row = await patientById(session.subject_id);
    if (!currentPassword || !(await bcrypt.compare(currentPassword, row.password_hash))) throw new HttpError(401, "current_password_invalid");
    if (newPassword === row.national_id) throw new HttpError(400, "password_must_not_be_national_id");
    const newHash = await bcrypt.hash(newPassword, 12);
    const { error } = await db.from("patients").update({ password_hash: newHash, password_changed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", row.id);
    if (error) throw new HttpError(500, "server_error");
    await db.from("sessions").update({ revoked_at: new Date().toISOString() }).eq("subject_id", row.id).eq("role", "patient");
    const newToken = await makeSession(row.id, "patient");
    await audit(session, "patient.password.change", "patient", row.id);
    return { body: { ok: true, token: newToken } };
  }

  if (session.role === "patient" && req.method === "GET" && route === "/v1/patients/appointments") {
    await requireActivePatient(session);
    const { data, error } = await db.from("appointments").select("*").eq("patient_id", session.subject_id)
      .order("preferred_date", { ascending: false }).order("preferred_time", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, "server_error");
    return { body: { appointments: (data || []).map(safeAppointment) } };
  }

  if (session.role === "patient" && req.method === "POST" && route === "/v1/patients/appointments") {
    await requireActivePatient(session);
    const b = await bodyJson(req);
    const preferredDate = text(b.preferredDate, 10);
    const preferredTime = text(b.preferredTime, 5);
    const reason = text(b.reason, 1000);
    if (!isDate(preferredDate) || !isTime(preferredTime) || !reason) throw new HttpError(400, "invalid_appointment_request");
    if (preferredDate < new Date().toISOString().slice(0, 10)) throw new HttpError(400, "appointment_date_in_past");
    const { data, error } = await db.from("appointments").insert({
      patient_id: session.subject_id, preferred_date: preferredDate, preferred_time: preferredTime, reason,
    }).select("*").single();
    if (error) throw new HttpError(500, "server_error");
    await audit(session, "appointment.request", "appointment", data.id);
    return { status: 201, body: { appointment: safeAppointment(data) } };
  }

  if (session.role === "doctor" && req.method === "GET" && route === "/v1/doctor/appointments") {
    await requireDoctor(session);
    const { data, error } = await db.from("appointments")
      .select("*, patients(first_name,last_name,mobile)")
      .order("preferred_date", { ascending: true }).order("preferred_time", { ascending: true }).limit(300);
    if (error) throw new HttpError(500, "server_error");
    const rows = (data || []).map((a: Record<string, any>) => ({
      ...a,
      patient_name: a.patients ? a.patients.first_name + " " + a.patients.last_name : "",
      patient_mobile: a.patients?.mobile || "",
    }));
    rows.sort((a: Record<string, any>, b: Record<string, any>) => Number(a.status !== "requested") - Number(b.status !== "requested"));
    return { body: { appointments: rows.map(safeAppointment) } };
  }

  const doctorAppointmentStatus = route.match(/^\/v1\/doctor\/appointments\/([^/]+)\/status$/);
  if (session.role === "doctor" && req.method === "PATCH" && doctorAppointmentStatus) {
    await requireDoctor(session);
    const id = doctorAppointmentStatus[1];
    const b = await bodyJson(req);
    const status = text(b.status, 20);
    const doctorNote = text(b.doctorNote, 1000);
    if (!APPOINTMENT_STATUSES.has(status)) throw new HttpError(400, "invalid_appointment_status");
    const { data, error } = await db.from("appointments").update({ status, doctor_note: doctorNote, updated_at: new Date().toISOString() })
      .eq("id", id).select("*").maybeSingle();
    if (error) throw new HttpError(500, "server_error");
    if (!data) throw new HttpError(404, "appointment_not_found");
    await audit(session, "appointment.status.update", "appointment", id, { status });
    return { body: { appointment: safeAppointment(data) } };
  }

  if (session.role === "patient" && req.method === "GET" && route === "/v1/patients/reports") {
    await requireActivePatient(session);
    const { data, error } = await db.from("symptom_reports").select("id,report_type,severity,symptoms,notes,occurred_on,submitted_at")
      .eq("patient_id", session.subject_id).order("submitted_at", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, "server_error");
    return { body: { reports: data || [] } };
  }

  if (session.role === "patient" && req.method === "POST" && route === "/v1/patients/reports") {
    await requireActivePatient(session);
    const b = await bodyJson(req);
    const reportType = text(b.reportType || "pre_visit", 20);
    const severity = b.severity == null || b.severity === "" ? null : Number(b.severity);
    const notes = text(b.notes, 4000);
    const occurredOn = text(b.occurredOn, 10);
    const symptoms = Array.isArray(b.symptoms) ? b.symptoms.map((x: unknown) => text(x, 60)).filter(Boolean).slice(0, 30) : [];
    if (!["symptom", "pre_visit"].includes(reportType) ||
        (severity != null && (!Number.isInteger(severity) || severity < 1 || severity > 10)) ||
        (!notes && symptoms.length === 0)) throw new HttpError(400, "invalid_report");
    if (occurredOn && !isDate(occurredOn)) throw new HttpError(400, "invalid_report_date");
    const { data, error } = await db.from("symptom_reports").insert({
      patient_id: session.subject_id, report_type: reportType, severity, symptoms, notes, occurred_on: occurredOn || null,
    }).select("id,report_type,severity,symptoms,notes,occurred_on,submitted_at").single();
    if (error) throw new HttpError(500, "server_error");
    await audit(session, "patient.report.create", "symptom_report", data.id, { reportType });
    return { status: 201, body: { report: data } };
  }

  const doctorReports = route.match(/^\/v1\/doctor\/patients\/([^/]+)\/reports$/);
  if (session.role === "doctor" && req.method === "GET" && doctorReports) {
    await requireDoctor(session);
    const id = doctorReports[1]; await validatePatientId(id);
    const { data, error } = await db.from("symptom_reports").select("id,report_type,severity,symptoms,notes,occurred_on,submitted_at")
      .eq("patient_id", id).order("submitted_at", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, "server_error");
    return { body: { reports: data || [] } };
  }

  if (session.role === "patient" && req.method === "GET" && route === "/v1/patients/notes") {
    await requireActivePatient(session);
    const { data, error } = await db.from("clinical_notes").select("id,doctor_label,note_text,created_at")
      .eq("patient_id", session.subject_id).eq("visible_to_patient", true).order("created_at", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, "server_error");
    return { body: { notes: data || [] } };
  }

  const doctorNotes = route.match(/^\/v1\/doctor\/patients\/([^/]+)\/notes$/);
  if (session.role === "doctor" && doctorNotes && req.method === "GET") {
    await requireDoctor(session);
    const id = doctorNotes[1]; await validatePatientId(id);
    const { data, error } = await db.from("clinical_notes").select("id,doctor_label,note_text,visible_to_patient,created_at")
      .eq("patient_id", id).order("created_at", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, "server_error");
    return { body: { notes: data || [] } };
  }
  if (session.role === "doctor" && doctorNotes && req.method === "POST") {
    const doctor = await requireDoctor(session);
    const id = doctorNotes[1]; await validatePatientId(id);
    const b = await bodyJson(req);
    const noteText = text(b.noteText, 5000);
    const visible = b.visibleToPatient === true;
    if (noteText.length < 3) throw new HttpError(400, "note_too_short");
    const { data, error } = await db.from("clinical_notes").insert({
      patient_id: id, doctor_label: doctor.display_name, note_text: noteText, visible_to_patient: visible,
    }).select("id,doctor_label,note_text,visible_to_patient,created_at").single();
    if (error) throw new HttpError(500, "server_error");
    await audit(session, "clinical_note.create", "clinical_note", data.id, { patientId: id, visibleToPatient: visible });
    return { status: 201, body: { note: data } };
  }

  if (session.role === "patient" && req.method === "GET" && route === "/v1/patients/treatment-plan") {
    await requireActivePatient(session);
    const { data, error } = await db.from("treatment_plans").select("id,title,instructions,follow_up_date,created_at,updated_at")
      .eq("patient_id", session.subject_id).eq("active", true).order("created_at", { ascending: false }).limit(50);
    if (error) throw new HttpError(500, "server_error");
    return { body: { plans: data || [] } };
  }

  const doctorPlan = route.match(/^\/v1\/doctor\/patients\/([^/]+)\/treatment-plan$/);
  if (session.role === "doctor" && req.method === "POST" && doctorPlan) {
    await requireDoctor(session);
    const id = doctorPlan[1]; await validatePatientId(id);
    const b = await bodyJson(req);
    const title = text(b.title, 200);
    const instructions = text(b.instructions, 4000);
    const followUpDate = text(b.followUpDate, 10);
    if (!title || !instructions || (followUpDate && !isDate(followUpDate))) throw new HttpError(400, "invalid_treatment_plan");
    const { data, error } = await db.from("treatment_plans").insert({
      patient_id: id, title, instructions, follow_up_date: followUpDate || null,
    }).select("id,title,instructions,follow_up_date,created_at,updated_at").single();
    if (error) throw new HttpError(500, "server_error");
    await audit(session, "treatment_plan.create", "treatment_plan", data.id, { patientId: id });
    return { status: 201, body: { plan: data } };
  }

  if (session.role === "patient" && req.method === "GET" && route === "/v1/patients/medications") {
    await requireActivePatient(session);
    const { data, error } = await db.from("medications").select("id,name,dose,instructions,active,created_at,updated_at")
      .eq("patient_id", session.subject_id).eq("active", true).order("created_at", { ascending: false }).limit(100);
    if (error) throw new HttpError(500, "server_error");
    return { body: { medications: data || [] } };
  }

  const doctorMeds = route.match(/^\/v1\/doctor\/patients\/([^/]+)\/medications$/);
  if (session.role === "doctor" && req.method === "POST" && doctorMeds) {
    await requireDoctor(session);
    const id = doctorMeds[1]; await validatePatientId(id);
    const b = await bodyJson(req);
    const name = text(b.name, 200), dose = text(b.dose, 200), instructions = text(b.instructions, 1000);
    if (!name || !dose) throw new HttpError(400, "invalid_medication");
    const { data, error } = await db.from("medications").insert({ patient_id: id, name, dose, instructions })
      .select("id,name,dose,instructions,active,created_at,updated_at").single();
    if (error) throw new HttpError(500, "server_error");
    await audit(session, "medication.create", "medication", data.id, { patientId: id });
    return { status: 201, body: { medication: data } };
  }

  const medicationStatus = route.match(/^\/v1\/doctor\/medications\/([^/]+)\/status$/);
  if (session.role === "doctor" && req.method === "PATCH" && medicationStatus) {
    await requireDoctor(session);
    const id = medicationStatus[1];
    const b = await bodyJson(req);
    const active = b.active === true;
    const { data, error } = await db.from("medications").update({ active, updated_at: new Date().toISOString() })
      .eq("id", id).select("id,name,dose,instructions,active,created_at,updated_at").maybeSingle();
    if (error) throw new HttpError(500, "server_error");
    if (!data) throw new HttpError(404, "medication_not_found");
    await audit(session, "medication.status.update", "medication", id, { active });
    return { body: { medication: data } };
  }

  if (session.role === "doctor" && req.method === "GET" && route === "/v1/doctor/patients") {
    await requireDoctor(session);
    const { data, error } = await db.from("patients").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) throw new HttpError(500, "server_error");
    return { body: { patients: (data || []).map((p: Record<string, any>) => safePatient(p, true)) } };
  }

  const doctorPatient = route.match(/^\/v1\/doctor\/patients\/([^/]+)$/);
  if (session.role === "doctor" && req.method === "GET" && doctorPatient) {
    await requireDoctor(session);
    const row = await patientById(doctorPatient[1]);
    return { body: { patient: safePatient(row, true) } };
  }

  const patientStatus = route.match(/^\/v1\/doctor\/patients\/([^/]+)\/status$/);
  if (session.role === "doctor" && req.method === "PATCH" && patientStatus) {
    await requireDoctor(session);
    const id = patientStatus[1]; await validatePatientId(id);
    const b = await bodyJson(req);
    const status = text(b.status, 30);
    if (!["pending_review", "active", "rejected"].includes(status)) throw new HttpError(400, "invalid_status");
    const { data, error } = await db.from("patients").update({ status, updated_at: new Date().toISOString() })
      .eq("id", id).select("*").single();
    if (error) throw new HttpError(500, "server_error");
    await audit(session, "patient.status.update", "patient", id, { status });
    return { body: { patient: safePatient(data, true) } };
  }

  throw new HttpError(404, "route_not_found");
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ error: "origin_not_allowed" }, 403, "https://app.mhsaffari.ir");
  }
  if (req.method === "OPTIONS") return json({}, 200, origin);
  try {
    const route = routeFor(new URL(req.url));
    const result = await handle(req, route);
    return json(result.body, result.status || 200, origin);
  } catch (error) {
    if (error instanceof HttpError) {
      return json({ error: error.code }, error.status, origin);
    }
    console.error("unhandled API error:", error instanceof Error ? error.message : String(error));
    return json({ error: "server_error" }, 500, origin);
  }
});
