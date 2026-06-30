import {getDb} from './sqlite';

export type CronJobStatus = 'success' | 'partial' | 'failed';

export function logCronRun(opts: {
  job: string;
  status: CronJobStatus;
  generatedCount: number;
  failedCount: number;
  errors: {userId: string; error: string}[];
}): void {
  getDb()
    .prepare(
      `CREATE TABLE IF NOT EXISTS cron_job_logs (
         id INTEGER PRIMARY KEY AUTOINCREMENT,
         job TEXT NOT NULL,
         status TEXT NOT NULL,
         generated_count INTEGER NOT NULL DEFAULT 0,
         failed_count INTEGER NOT NULL DEFAULT 0,
         errors TEXT,
         ran_at INTEGER NOT NULL
       )`
    )
    .run();

  getDb()
    .prepare(
      `INSERT INTO cron_job_logs (job, status, generated_count, failed_count, errors, ran_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(
      opts.job,
      opts.status,
      opts.generatedCount,
      opts.failedCount,
      opts.errors.length > 0 ? JSON.stringify(opts.errors) : null,
      Date.now()
    );
}
