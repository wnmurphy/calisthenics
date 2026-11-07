export type Mode = 'ordered' | 'shuffled' | 'free-select';
export type Unit = 'reps' | 'seconds';
export interface Variant { level: 1 | 2 | 3 | 4; label: string; howTo: string; }
export interface Exercise {
  id: string; name: string; equipment?: string;
  variants: Variant[]; createdAt: number;
}
export interface LogEntry {
  id: string; exerciseId: string; variantLevel: 1 | 2 | 3 | 4;
  count: number; unit: Unit; performedAt: number; sessionId: string;
}
export interface Session {
  id: string; mode: Mode; queue: string[];
  status: 'active' | 'ended'; startedAt: number; endedAt?: number;
}
export interface Deck { session: Session; performed: LogEntry[]; }
