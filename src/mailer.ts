import nodemailer from "nodemailer";
import { AlertConfig } from "./types";

let cfg: AlertConfig = { email: "", criticalThreshold: 8, closeThreshold: 15, enabled: false, binDepthCm: 50 };

export const getAlertConfig = (): AlertConfig => cfg;
export const setAlertConfig = (c: Partial<AlertConfig>): void => { cfg = { ...cfg, ...c }; };

const mkT = () => nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: 587, secure: false,
  auth: { user: process.env.SMTP_USER || "", pass: process.env.SMTP_PASS || "" },
});

let lastDistAlert = 0;
let lastFillAlert = 0;
const COOLDOWN = 60000;

export const sendAlert = async (distance: number, status: string): Promise<void> => {
  if (!cfg.enabled || !cfg.email) return;
  if (Date.now() - lastDistAlert < COOLDOWN) return;
  lastDistAlert = Date.now();
  await mkT().sendMail({
    from: process.env.SMTP_USER,
    to: cfg.email,
    subject: "[ALERT] Bin Sensor - " + status.toUpperCase(),
    html: "<h2>Sensor Alert</h2><p>Status: <b>" + status + "</b></p><p>Distance: <b>" + distance + " cm</b></p><p>" + new Date().toLocaleString() + "</p>",
  });
  console.log("Distance alert sent to", cfg.email);
};

export const sendScheduleAlert = async (fillPct: number, scheduledFor: Date): Promise<void> => {
  if (!cfg.enabled || !cfg.email) return;
  if (Date.now() - lastFillAlert < COOLDOWN * 10) return;
  lastFillAlert = Date.now();
  await mkT().sendMail({
    from: process.env.SMTP_USER,
    to: cfg.email,
    subject: "[ACTION] Bin Collection Scheduled - " + Math.round(fillPct) + "% full",
    html: "<h2>Bin Collection Scheduled</h2><p>Your bin is <b>" + Math.round(fillPct) + "% full</b>.</p><p>A collection has been scheduled for: <b>" + scheduledFor.toLocaleString() + "</b></p><p>Please ensure the bin is accessible at the collection time.</p><br><p>" + new Date().toLocaleString() + "</p>",
  });
  console.log("Schedule alert sent to", cfg.email);
};
