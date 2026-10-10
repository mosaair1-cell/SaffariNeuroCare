require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: (process.env.CORS_ORIGINS || '').split(',').filter(Boolean) }));
app.use(express.json({ limit: '64kb' }));

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: true } : undefined });
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = Number(process.env.PORT || 8080);

if (!process.env.DATABASE_URL || !JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('DATABASE_URL and a JWT_SECRET of at least 32 characters are required.');
  process.exit(1);
}

const normalize = (v) => String(v || '').replace(/\s/g, '');
const isMobile = (v) => /^09\d{9}$/.test(v);
const isNationalId = (v) => /^\d{10}$/.test(v);
const diseaseCodes = new Set(['migraine', 'ms', 'epilepsy', 'parkinson', 'cognition', 'unassigned']);

function tokenFor(user) {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '8h', issuer: 'saffari-neurocare' });
}
function auth(roles = []) {
  return (req, res, next) => {
    try {
      const raw = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
      const payload = jwt.verify(raw, JWT_SECRET, { issuer: 'saffari-neurocare' });
      if (roles.length && !roles.includes(payload.role)) return res.status(403).json({ error: 'forbidden' });
      req.auth = payload;
      next();
    } catch (_) { return res.status(401).json({ error: 'unauthorized' }); }
  };
}
function safePatient(row) {
  return { id: row.id, firstName: row.first_name, lastName: row.last_name, mobile: row.mobile,
    nationalId: row.national_id, diseaseCode: row.disease_code, status: row.status,
    createdAt: row.created_at };
}

app.get('/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ status: 'ok', service: 'saffari-neurocare-api' }); }
  catch (_) { res.status(503).json({ status: 'unavailable' }); }
});

app.post('/v1/patients/register', async (req, res) => {
  try {
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const mobile = normalize(req.body.mobile);
    const nationalId = normalize(req.body.nationalId);
    const diseaseCode = String(req.body.diseaseCode || 'unassigned');
    const clinicCode = String(req.body.clinicCode || '').trim().toUpperCase();
    if (!firstName || !lastName || !isMobile(mobile) || !isNationalId(nationalId) || !diseaseCodes.has(diseaseCode))
      return res.status(400).json({ error: 'invalid_registration_data' });
    if (clinicCode !== (process.env.CLINIC_CODE || 'SAFFARI'))
      return res.status(400).json({ error: 'invalid_clinic_code' });

    const duplicate = await pool.query('SELECT id FROM patients WHERE mobile=$1 OR national_id=$2', [mobile, nationalId]);
    if (duplicate.rowCount) return res.status(409).json({ error: 'patient_already_registered' });

    // The national ID is only an initial password; only its salted hash is persisted.
    const passwordHash = await bcrypt.hash(nationalId, 12);
    const inserted = await pool.query(
      `INSERT INTO patients(first_name,last_name,mobile,national_id,password_hash,disease_code,status)
       VALUES($1,$2,$3,$4,$5,$6,'pending_review') RETURNING *`,
      [firstName,lastName,mobile,nationalId,passwordHash,diseaseCode]
    );
    const row = inserted.rows[0];
    res.status(201).json({ patient: safePatient(row), token: tokenFor({ id: row.id, role: 'patient' }) });
  } catch (e) {
    console.error('patient registration failed', e.message);
    res.status(500).json({ error: 'server_error' });
  }
});

app.post('/v1/patients/login', async (req, res) => {
  try {
    const mobile = normalize(req.body.mobile), nationalId = normalize(req.body.nationalId);
    if (!isMobile(mobile) || !isNationalId(nationalId)) return res.status(400).json({ error: 'invalid_credentials' });
    const found = await pool.query('SELECT * FROM patients WHERE mobile=$1', [mobile]);
    if (!found.rowCount || !(await bcrypt.compare(nationalId, found.rows[0].password_hash)))
      return res.status(401).json({ error: 'invalid_credentials' });
    const row = found.rows[0];
    res.json({ patient: safePatient(row), token: tokenFor({ id: row.id, role: 'patient' }) });
  } catch (e) { console.error('patient login failed', e.message); res.status(500).json({ error: 'server_error' }); }
});

app.post('/v1/doctor/login', async (req, res) => {
  try {
    const code = String(req.body.clinicCode || '').trim().toUpperCase();
    const password = String(req.body.password || '');
    const expectedCode = String(process.env.DOCTOR_LOGIN || 'SAFFARI');
    const hash = process.env.DOCTOR_PASSWORD_HASH;
    if (code !== expectedCode || !hash || !(await bcrypt.compare(password, hash)))
      return res.status(401).json({ error: 'invalid_credentials' });
    res.json({ token: tokenFor({ id: 'doctor-saffari', role: 'doctor' }) });
  } catch (e) { console.error('doctor login failed', e.message); res.status(500).json({ error: 'server_error' }); }
});

app.get('/v1/doctor/patients', auth(['doctor']), async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,first_name,last_name,mobile,national_id,disease_code,status,created_at FROM patients ORDER BY created_at DESC LIMIT 200'
    );
    res.json({ patients: result.rows.map(safePatient) });
  } catch (e) { console.error('patient list failed', e.message); res.status(500).json({ error: 'server_error' }); }
});

app.patch('/v1/doctor/patients/:id/status', auth(['doctor']), async (req, res) => {
  const status = String(req.body.status || '');
  if (!['pending_review','active','rejected'].includes(status)) return res.status(400).json({ error: 'invalid_status' });
  try {
    const result = await pool.query(
      'UPDATE patients SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING id,first_name,last_name,mobile,national_id,disease_code,status,created_at',
      [status, req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'not_found' });
    res.json({ patient: safePatient(result.rows[0]) });
  } catch (e) { console.error('patient status update failed', e.message); res.status(500).json({ error: 'server_error' }); }
});

app.listen(PORT, () => console.log(`Saffari NeuroCare API listening on ${PORT}`));
