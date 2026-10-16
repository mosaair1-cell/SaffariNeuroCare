require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '64kb' }));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined,
});
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = Number(process.env.PORT || 8080);
const CLINIC_CODE = String(process.env.CLINIC_CODE || 'SAFFARI').trim().toUpperCase();
const DOCTOR_LOGIN = String(process.env.DOCTOR_LOGIN || 'SAFFARI').trim().toUpperCase();
const DOCTOR_PASSWORD_HASH = process.env.DOCTOR_PASSWORD_HASH;

if (!process.env.DATABASE_URL || !JWT_SECRET || JWT_SECRET.length < 32 || !DOCTOR_PASSWORD_HASH) {
  console.error('DATABASE_URL, a JWT_SECRET of at least 32 characters and DOCTOR_PASSWORD_HASH are required.');
  process.exit(1);
}

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});
const normalize = (v) => String(v || '').replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 0x06f0)).replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 0x0660)).replace(/\s/g, '');
const text = (v, max = 4000) => String(v == null ? '' : v).trim().slice(0, max);
const isMobile = (v) => /^09\d{9}$/.test(v);
const isNationalId = (v) => /^\d{10}$/.test(v);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isTime = (v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || ''));
const diseaseCodes = new Set(['migraine', 'ms', 'epilepsy', 'parkinson', 'cognition', 'unassigned']);
const appointmentStatuses = new Set(['requested', 'confirmed', 'rejected', 'completed', 'cancelled']);

function tokenFor(user) {
  return jwt.sign({ sub: String(user.id), role: user.role }, JWT_SECRET, {
    expiresIn: '8h',
    issuer: 'saffari-neurocare',
    audience: 'saffari-neurocare-client',
  });
}
function auth(roles = []) {
  return (req, res, next) => {
    try {
      const raw = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const payload = jwt.verify(raw, JWT_SECRET, {
        issuer: 'saffari-neurocare',
        audience: 'saffari-neurocare-client',
      });
      if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: 'forbidden' });
      if (!payload.sub) return res.status(401).json({ error: 'unauthorized' });
      req.auth = payload;
      next();
    } catch (_) {
      return res.status(401).json({ error: 'unauthorized' });
    }
  };
}
function safePatient(row, forDoctor = false) {
  const p = {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    mobile: row.mobile,
    diseaseCode: row.disease_code,
    status: row.status,
    createdAt: row.created_at,
  };
  if (forDoctor) p.nationalId = row.national_id ? '••••••' + String(row.national_id).slice(-4) : '';
  return p;
}
function safeAppointment(row) {
  return {
    id: row.id,
    patientId: row.patient_id,
    patientName: row.patient_name || undefined,
    patientMobile: row.patient_mobile || undefined,
    preferredDate: row.preferred_date,
    preferredTime: row.preferred_time,
    reason: row.reason,
    status: row.status,
    doctorNote: row.doctor_note || '',
    createdAt: row.created_at,
  };
}
async function audit(req, action, subjectType, subjectId, metadata = {}) {
  try {
    await pool.query(
      'INSERT INTO audit_events(actor_id, actor_role, action, subject_type, subject_id, metadata) VALUES($1,$2,$3,$4,$5,$6)',
      [String(req.auth.sub), req.auth.role, action, subjectType, String(subjectId), JSON.stringify(metadata)]
    );
  } catch (e) {
    console.error('audit write failed', e.message);
  }
}
async function getPatient(id) {
  const result = await pool.query('SELECT * FROM patients WHERE id=$1', [id]);
  return result.rowCount ? result.rows[0] : null;
}
async function activePatient(req, res) {
  const patient = await getPatient(req.auth.sub);
  if (!patient) {
    res.status(404).json({ error: 'patient_not_found' });
    return null;
  }
  if (patient.status !== 'active') {
    res.status(403).json({ error: patient.status === 'rejected' ? 'registration_rejected' : 'awaiting_doctor_approval' });
    return null;
  }
  return patient;
}
async function doctorPatientExists(id, res) {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ''))) {
    res.status(400).json({ error: 'invalid_patient_id' });
    return false;
  }
  const result = await pool.query('SELECT id FROM patients WHERE id=$1', [id]);
  if (!result.rowCount) {
    res.status(404).json({ error: 'patient_not_found' });
    return false;
  }
  return true;
}

app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', service: 'saffari-neurocare-api', version: '1.1.0' });
  } catch (_) {
    res.status(503).json({ status: 'unavailable' });
  }
});

app.post('/v1/patients/register', loginLimiter, async (req, res) => {
  try {
    const firstName = text(req.body.firstName, 100);
    const lastName = text(req.body.lastName, 100);
    const mobile = normalize(req.body.mobile);
    const nationalId = normalize(req.body.nationalId);
    const diseaseCode = text(req.body.diseaseCode || 'unassigned', 30);
    const clinicCode = text(req.body.clinicCode, 40).toUpperCase();
    if (!firstName || !lastName || !isMobile(mobile) || !isNationalId(nationalId) || !diseaseCodes.has(diseaseCode)) {
      return res.status(400).json({ error: 'invalid_registration_data' });
    }
    if (clinicCode !== CLINIC_CODE) return res.status(400).json({ error: 'invalid_clinic_code' });

    const duplicate = await pool.query('SELECT id FROM patients WHERE mobile=$1 OR national_id=$2', [mobile, nationalId]);
    if (duplicate.rowCount) return res.status(409).json({ error: 'patient_already_registered' });

    // Compatibility flow: national ID is the initial credential. Replace this flow before clinical production.
    const passwordHash = await bcrypt.hash(nationalId, 12);
    const inserted = await pool.query(
      'INSERT INTO patients(first_name,last_name,mobile,national_id,password_hash,disease_code,status) VALUES($1,$2,$3,$4,$5,$6,\'pending_review\') RETURNING *',
      [firstName, lastName, mobile, nationalId, passwordHash, diseaseCode]
    );
    const row = inserted.rows[0];
    const patient = safePatient(row);
    await audit({ auth: { sub: row.id, role: 'patient' } }, 'patient.register', 'patient', row.id);
    res.status(201).json({ patient, token: tokenFor({ id: row.id, role: 'patient' }) });
  } catch (e) {
    console.error('patient registration failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/patients/login', loginLimiter, async (req, res) => {
  try {
    const mobile = normalize(req.body.mobile);
    const nationalId = normalize(req.body.nationalId);
    if (!isMobile(mobile) || !isNationalId(nationalId)) return res.status(400).json({ error: 'invalid_credentials' });
    const found = await pool.query('SELECT * FROM patients WHERE mobile=$1', [mobile]);
    if (!found.rowCount || !(await bcrypt.compare(nationalId, found.rows[0].password_hash))) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const row = found.rows[0];
    await audit({ auth: { sub: row.id, role: 'patient' } }, 'patient.login', 'patient', row.id);
    res.json({ patient: safePatient(row), token: tokenFor({ id: row.id, role: 'patient' }) });
  } catch (e) {
    console.error('patient login failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/doctor/login', loginLimiter, async (req, res) => {
  try {
    const code = text(req.body.clinicCode, 40).toUpperCase();
    const password = String(req.body.password || '');
    if (code !== DOCTOR_LOGIN || !(await bcrypt.compare(password, DOCTOR_PASSWORD_HASH))) {
      return res.status(401).json({ error: 'invalid_credentials' });
    }
    const token = tokenFor({ id: 'doctor-saffari', role: 'doctor' });
    await audit({ auth: { sub: 'doctor-saffari', role: 'doctor' } }, 'doctor.login', 'session', 'doctor-saffari');
    res.json({ token });
  } catch (e) {
    console.error('doctor login failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/patients/me', auth(['patient']), async (req, res) => {
  try {
    const row = await getPatient(req.auth.sub);
    if (!row) return res.status(404).json({ error: 'patient_not_found' });
    res.json({ patient: safePatient(row) });
  } catch (e) {
    console.error('patient profile read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/doctor/patients', auth(['doctor']), async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,first_name,last_name,mobile,national_id,disease_code,status,created_at FROM patients ORDER BY created_at DESC LIMIT 300'
    );
    res.json({ patients: result.rows.map(row => safePatient(row, true)) });
  } catch (e) {
    console.error('patient list failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/doctor/patients/:id', auth(['doctor']), async (req, res) => {
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query('SELECT * FROM patients WHERE id=$1', [req.params.id]);
    res.json({ patient: safePatient(result.rows[0], true) });
  } catch (e) {
    console.error('patient detail failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/v1/doctor/patients/:id/status', auth(['doctor']), async (req, res) => {
  const status = text(req.body.status, 30);
  if (!['pending_review', 'active', 'rejected'].includes(status)) return res.status(400).json({ error: 'invalid_status' });
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query(
      'UPDATE patients SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, req.params.id]
    );
    await audit(req, 'patient.status.update', 'patient', req.params.id, { status });
    res.json({ patient: safePatient(result.rows[0], true) });
  } catch (e) {
    console.error('patient status update failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/patients/appointments', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const result = await pool.query(
      'SELECT * FROM appointments WHERE patient_id=$1 ORDER BY preferred_date DESC, preferred_time DESC LIMIT 100',
      [req.auth.sub]
    );
    res.json({ appointments: result.rows.map(safeAppointment) });
  } catch (e) {
    console.error('patient appointments read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/patients/appointments', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const preferredDate = text(req.body.preferredDate, 10);
    const preferredTime = text(req.body.preferredTime, 5);
    const reason = text(req.body.reason, 1000);
    if (!isDate(preferredDate) || !isTime(preferredTime) || !reason) return res.status(400).json({ error: 'invalid_appointment_request' });
    if (preferredDate < new Date().toISOString().slice(0, 10)) return res.status(400).json({ error: 'appointment_date_in_past' });
    const result = await pool.query(
      'INSERT INTO appointments(patient_id,preferred_date,preferred_time,reason) VALUES($1,$2,$3,$4) RETURNING *',
      [req.auth.sub, preferredDate, preferredTime, reason]
    );
    await audit(req, 'appointment.request', 'appointment', result.rows[0].id);
    res.status(201).json({ appointment: safeAppointment(result.rows[0]) });
  } catch (e) {
    console.error('appointment request failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/doctor/appointments', auth(['doctor']), async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT a.*, p.first_name || \' \' || p.last_name AS patient_name, p.mobile AS patient_mobile FROM appointments a JOIN patients p ON p.id=a.patient_id ORDER BY CASE WHEN a.status=\'requested\' THEN 0 ELSE 1 END, a.preferred_date, a.preferred_time LIMIT 300'
    );
    res.json({ appointments: result.rows.map(safeAppointment) });
  } catch (e) {
    console.error('doctor appointments read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/v1/doctor/appointments/:id/status', auth(['doctor']), async (req, res) => {
  const status = text(req.body.status, 20);
  const doctorNote = text(req.body.doctorNote, 1000);
  if (!appointmentStatuses.has(status)) return res.status(400).json({ error: 'invalid_appointment_status' });
  try {
    const result = await pool.query(
      'UPDATE appointments SET status=$1,doctor_note=$2,updated_at=NOW() WHERE id=$3 RETURNING *',
      [status, doctorNote, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'appointment_not_found' });
    await audit(req, 'appointment.status.update', 'appointment', req.params.id, { status });
    res.json({ appointment: safeAppointment(result.rows[0]) });
  } catch (e) {
    console.error('appointment status update failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/patients/reports', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const result = await pool.query(
      'SELECT id,report_type,severity,symptoms,notes,occurred_on,submitted_at FROM symptom_reports WHERE patient_id=$1 ORDER BY submitted_at DESC LIMIT 100',
      [req.auth.sub]
    );
    res.json({ reports: result.rows });
  } catch (e) {
    console.error('patient reports read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/patients/reports', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const reportType = text(req.body.reportType || 'pre_visit', 20);
    const severity = req.body.severity == null || req.body.severity === '' ? null : Number(req.body.severity);
    const notes = text(req.body.notes, 4000);
    const occurredOn = text(req.body.occurredOn, 10);
    const symptoms = Array.isArray(req.body.symptoms) ? req.body.symptoms.map(x => text(x, 60)).filter(Boolean).slice(0, 30) : [];
    if (!['symptom', 'pre_visit'].includes(reportType) || (severity != null && (!Number.isInteger(severity) || severity < 1 || severity > 10)) || (!notes && symptoms.length === 0)) {
      return res.status(400).json({ error: 'invalid_report' });
    }
    if (occurredOn && !isDate(occurredOn)) return res.status(400).json({ error: 'invalid_report_date' });
    const result = await pool.query(
      'INSERT INTO symptom_reports(patient_id,report_type,severity,symptoms,notes,occurred_on) VALUES($1,$2,$3,$4,$5,$6) RETURNING id,report_type,severity,symptoms,notes,occurred_on,submitted_at',
      [req.auth.sub, reportType, severity, JSON.stringify(symptoms), notes, occurredOn || null]
    );
    await audit(req, 'patient.report.create', 'symptom_report', result.rows[0].id, { reportType });
    res.status(201).json({ report: result.rows[0] });
  } catch (e) {
    console.error('patient report create failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/doctor/patients/:id/reports', auth(['doctor']), async (req, res) => {
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query(
      'SELECT id,report_type,severity,symptoms,notes,occurred_on,submitted_at FROM symptom_reports WHERE patient_id=$1 ORDER BY submitted_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json({ reports: result.rows });
  } catch (e) {
    console.error('doctor patient reports read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/patients/notes', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const result = await pool.query(
      'SELECT id,doctor_label,note_text,created_at FROM clinical_notes WHERE patient_id=$1 AND visible_to_patient=TRUE ORDER BY created_at DESC LIMIT 100',
      [req.auth.sub]
    );
    res.json({ notes: result.rows });
  } catch (e) {
    console.error('patient notes read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/doctor/patients/:id/notes', auth(['doctor']), async (req, res) => {
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query(
      'SELECT id,doctor_label,note_text,visible_to_patient,created_at FROM clinical_notes WHERE patient_id=$1 ORDER BY created_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json({ notes: result.rows });
  } catch (e) {
    console.error('doctor patient notes read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/doctor/patients/:id/notes', auth(['doctor']), async (req, res) => {
  const noteText = text(req.body.noteText, 5000);
  const visible = req.body.visibleToPatient === true;
  if (noteText.length < 3) return res.status(400).json({ error: 'note_too_short' });
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query(
      'INSERT INTO clinical_notes(patient_id,doctor_label,note_text,visible_to_patient) VALUES($1,$2,$3,$4) RETURNING id,doctor_label,note_text,visible_to_patient,created_at',
      [req.params.id, text(process.env.DOCTOR_DISPLAY_NAME || 'پزشک معالج', 120), noteText, visible]
    );
    await audit(req, 'clinical_note.create', 'clinical_note', result.rows[0].id, { patientId: req.params.id, visibleToPatient: visible });
    res.status(201).json({ note: result.rows[0] });
  } catch (e) {
    console.error('clinical note create failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/patients/treatment-plan', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const result = await pool.query(
      'SELECT id,title,instructions,follow_up_date,created_at,updated_at FROM treatment_plans WHERE patient_id=$1 AND active=TRUE ORDER BY created_at DESC LIMIT 50',
      [req.auth.sub]
    );
    res.json({ plans: result.rows });
  } catch (e) {
    console.error('patient treatment plan read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/doctor/patients/:id/treatment-plan', auth(['doctor']), async (req, res) => {
  const title = text(req.body.title, 200);
  const instructions = text(req.body.instructions, 4000);
  const followUpDate = text(req.body.followUpDate, 10);
  if (!title || !instructions || (followUpDate && !isDate(followUpDate))) return res.status(400).json({ error: 'invalid_treatment_plan' });
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query(
      'INSERT INTO treatment_plans(patient_id,title,instructions,follow_up_date) VALUES($1,$2,$3,$4) RETURNING id,title,instructions,follow_up_date,created_at,updated_at',
      [req.params.id, title, instructions, followUpDate || null]
    );
    await audit(req, 'treatment_plan.create', 'treatment_plan', result.rows[0].id, { patientId: req.params.id });
    res.status(201).json({ plan: result.rows[0] });
  } catch (e) {
    console.error('treatment plan create failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.get('/v1/patients/medications', auth(['patient']), async (req, res) => {
  try {
    if (!await activePatient(req, res)) return;
    const result = await pool.query(
      'SELECT id,name,dose,instructions,active,created_at,updated_at FROM medications WHERE patient_id=$1 AND active=TRUE ORDER BY created_at DESC LIMIT 100',
      [req.auth.sub]
    );
    res.json({ medications: result.rows });
  } catch (e) {
    console.error('patient medication read failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/doctor/patients/:id/medications', auth(['doctor']), async (req, res) => {
  const name = text(req.body.name, 200);
  const dose = text(req.body.dose, 200);
  const instructions = text(req.body.instructions, 1000);
  if (!name || !dose) return res.status(400).json({ error: 'invalid_medication' });
  try {
    if (!await doctorPatientExists(req.params.id, res)) return;
    const result = await pool.query(
      'INSERT INTO medications(patient_id,name,dose,instructions) VALUES($1,$2,$3,$4) RETURNING id,name,dose,instructions,active,created_at,updated_at',
      [req.params.id, name, dose, instructions]
    );
    await audit(req, 'medication.create', 'medication', result.rows[0].id, { patientId: req.params.id });
    res.status(201).json({ medication: result.rows[0] });
  } catch (e) {
    console.error('medication create failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.patch('/v1/doctor/medications/:id/status', auth(['doctor']), async (req, res) => {
  const active = req.body.active === true;
  try {
    const result = await pool.query(
      'UPDATE medications SET active=$1,updated_at=NOW() WHERE id=$2 RETURNING id,name,dose,instructions,active,created_at,updated_at',
      [active, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'medication_not_found' });
    await audit(req, 'medication.status.update', 'medication', req.params.id, { active });
    res.json({ medication: result.rows[0] });
  } catch (e) {
    console.error('medication status update failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.use((err, _req, res, _next) => {
  if (err && err.message === 'Origin not allowed by CORS') return res.status(403).json({ error: 'origin_not_allowed' });
  console.error('unhandled request error', err && err.message ? err.message : 'unknown');
  return res.status(500).json({ error: 'server_error' });
});

const server = app.listen(PORT, () => console.log('Saffari NeuroCare API listening on ' + PORT));
server.requestTimeout = 15000;
server.headersTimeout = 20000;
