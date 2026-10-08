# Saffari NeuroCare — Patient Identity & Login Flow

## V1 account model

- OTP is not used.
- Patient creates an account with:
  - mobile number
  - national ID
  - first name
  - last name
- Mobile number is the patient username.
- National ID is the initial password in this prototype.
- National ID is also the primary patient-file identifier.

## Clinic connection

After account creation, the patient connects to the clinic using the clinic connection code (default demo code: SAFFARI). The patient national ID is shown as the file identifier and is the value the clinic uses to match the patient.

## Doctor workflow

- Doctor can search patients by national ID, name, or disease.
- National ID is immutable from the doctor edit screen.
- Doctor can correct first name and last name for a patient found by national ID.
- The corrected display name is immediately reflected in the patient list and patient detail screen during the app session.
- The final production implementation should persist the correction to the backend and write an audit log with doctor ID, patient ID, old name, new name, and timestamp.

## Production security requirement

Using national ID as a password is intentionally kept for the current prototype because the requested flow avoids OTP. Before real patient use, replace the initial national-ID password with a password-change step and secure password hashing, session management, RBAC, audit logging, HTTPS, encryption, backups, and secure storage.

## Data integrity

National ID should be normalized and validated as a 10-digit identifier. It must be unique per patient. It should not be silently editable because changing it would change the identity key of the medical record.
