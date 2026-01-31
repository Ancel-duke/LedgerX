import { Injectable } from '@nestjs/common';

export interface JobRunRecord {
  name: string;
  lastRunAt: string | null;
  lastStatus: 'ok' | 'error';
  cronExpression?: string;
}

/**
 * Registry of scheduled jobs for visibility (list jobs + last run).
 * Schedulers call recordRun() after each execution.
 */
@Injectable()
export class ScheduledJobsRegistryService {
  private readonly jobs = new Map<string, { lastRunAt: number; lastStatus: 'ok' | 'error'; cronExpression?: string }>();

  /** Register a job (optional; recordRun will create entry if missing). */
  register(name: string, cronExpression?: string): void {
    const existing = this.jobs.get(name);
    if (!existing) {
      this.jobs.set(name, { lastRunAt: 0, lastStatus: 'ok', cronExpression });
    } else if (cronExpression !== undefined) {
      existing.cronExpression = cronExpression;
    }
  }

  /** Record a run. Call from each scheduler after execution. */
  recordRun(name: string, status: 'ok' | 'error'): void {
    const existing = this.jobs.get(name);
    const now = Date.now();
    if (existing) {
      existing.lastRunAt = now;
      existing.lastStatus = status;
    } else {
      this.jobs.set(name, { lastRunAt: now, lastStatus: status });
    }
  }

  /** List all registered jobs with last run time and status. */
  list(): JobRunRecord[] {
    const result: JobRunRecord[] = [];
    for (const [name, rec] of this.jobs) {
      result.push({
        name,
        lastRunAt: rec.lastRunAt > 0 ? new Date(rec.lastRunAt).toISOString() : null,
        lastStatus: rec.lastStatus,
        cronExpression: rec.cronExpression,
      });
    }
    return result.sort((a, b) => (a.name < b.name ? -1 : 1));
  }
}
