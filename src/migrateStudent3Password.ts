import bcrypt from 'bcryptjs';
import { fileURLToPath } from 'url';
import { db } from './db.js';

const TARGET_STUDENT_ID = 3;

export type MigrationStatus =
  | 'MIGRATION_SUCCESS'
  | 'ALREADY_MIGRATED'
  | 'MISSING_ENV'
  | 'STUDENT_NOT_FOUND'
  | 'UPDATE_FAILED';

export function migrateStudent3Password(): MigrationStatus {
  const password = process.env.MIGRATION_STUDENT_PASSWORD;

  if (!password || password.trim().length === 0) {
    console.error('[MIGRATION] Refusing to run: MIGRATION_STUDENT_PASSWORD is missing or empty.');
    return 'MISSING_ENV';
  }

  const existingStudent = db.findStudentById(TARGET_STUDENT_ID);
  if (!existingStudent) {
    console.error(`[MIGRATION] Aborting: Student id ${TARGET_STUDENT_ID} not found.`);
    return 'STUDENT_NOT_FOUND';
  }

  if (typeof existingStudent.password === 'string' && existingStudent.password.startsWith('$2')) {
    console.warn(`[MIGRATION] Refusing to run: Student id ${TARGET_STUDENT_ID} password is already a bcrypt hash.`);
    return 'ALREADY_MIGRATED';
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const updated = db.updateStudent(TARGET_STUDENT_ID, { password: passwordHash });

  if (!updated) {
    console.error(`[MIGRATION] Failed to update password for student id ${TARGET_STUDENT_ID}.`);
    return 'UPDATE_FAILED';
  }

  console.log(`[MIGRATION] Password successfully migrated to bcrypt for student id ${TARGET_STUDENT_ID}.`);
  return 'MIGRATION_SUCCESS';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const status = migrateStudent3Password();
  process.exit(status === 'MIGRATION_SUCCESS' ? 0 : 1);
}
