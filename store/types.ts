import type { EventRow, PhotoRow, EmailSettingsRow } from '@/lib/database';

export interface Preferences {
  activeEventId?: string;
  lastPrintSize?: string;
  defaultCopies?: number;
}

export type { EventRow, PhotoRow, EmailSettingsRow };
