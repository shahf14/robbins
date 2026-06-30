import {getDb} from './sqlite';

/** Run work under BEGIN IMMEDIATE so check-then-write sequences serialize. */
export function runImmediateTransaction<T>(fn: () => T): T {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
