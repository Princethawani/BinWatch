export interface User {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

export interface SensorReading {
  id: string;
  distance: number;
  fillPercent: number;
  status: "safe" | "close" | "critical";
  timestamp: Date;
}

export interface AlertConfig {
  email: string;
  criticalThreshold: number;
  closeThreshold: number;
  enabled: boolean;
  binDepthCm: number;
}

export type ScheduleStatus = "pending" | "confirmed" | "completed" | "cancelled";

export interface CollectionSchedule {
  id: string;
  createdAt: Date;
  scheduledFor: Date;
  status: ScheduleStatus;
  fillPercentAtCreation: number;
  notes: string;
}

export interface AuthPayload {
  userId: string;
  username: string;
}
