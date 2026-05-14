import dotenv from "dotenv";
dotenv.config();
import express from "express";
import cors from "cors";
import { registerUser, loginUser, authMiddleware } from "./auth";
import { getAlertConfig, setAlertConfig, sendAlert, sendScheduleAlert } from "./mailer";
import { SensorReading, CollectionSchedule } from "./types";
import { SerialPort } from "serialport";
import { ReadlineParser } from "@serialport/parser-readline";

const app = express();
app.use(cors());
app.use(express.json());

const readings: SensorReading[] = [];
const schedules: CollectionSchedule[] = [];

const generateId = (): string => Date.now().toString(36) + Math.random().toString(36).substr(2);

/* ---- BIN LOGIC ---- */
const getStatus = (d: number): SensorReading["status"] => {
  if (d > 0 && d < 8) return "critical";
  if (d < 15) return "close";
  return "safe";
};

// Lower distance = bin more full (sensor at top, measures to trash)
const getFillPercent = (distanceCm: number): number => {
  const cfg = getAlertConfig();
  const depth = cfg.binDepthCm || 50;
  const fill = ((depth - distanceCm) / depth) * 100;
  return Math.min(100, Math.max(0, fill));
};

/* Auto-schedule: if bin >= 80% full and no pending schedule, create one */
const maybeAutoSchedule = async (fillPct: number): Promise<void> => {
  if (fillPct < 80) return;
  const hasPending = schedules.some(s => s.status === "pending" || s.status === "confirmed");
  if (hasPending) return;
  const scheduledFor = new Date();
  scheduledFor.setDate(scheduledFor.getDate() + 1);
  scheduledFor.setHours(8, 0, 0, 0);
  const schedule: CollectionSchedule = {
    id: generateId(),
    createdAt: new Date(),
    scheduledFor,
    status: "pending",
    fillPercentAtCreation: fillPct,
    notes: "Auto-scheduled: bin reached " + Math.round(fillPct) + "% capacity",
  };
  schedules.unshift(schedule);
  console.log("Auto-scheduled collection for", scheduledFor.toLocaleString());
  await sendScheduleAlert(fillPct, scheduledFor);
};

const processReading = async (distance: number): Promise<SensorReading> => {
  const status = getStatus(distance);
  const fillPercent = getFillPercent(distance);
  const reading: SensorReading = { id: generateId(), distance, fillPercent, status, timestamp: new Date() };
  readings.unshift(reading);
  if (readings.length > 500) readings.pop();
  if (status !== "safe") await sendAlert(distance, status);
  await maybeAutoSchedule(fillPercent);
  return reading;
};

/* ---- SERIAL PORT ---- */
const SERIAL_PORT_PATH = process.env.SERIAL_PORT || "/dev/ttyUSB0";
try {
  const port = new SerialPort({ path: SERIAL_PORT_PATH, baudRate: 9600 });
  const parser = port.pipe(new ReadlineParser({ delimiter: "\n" }));
  parser.on("data", async (line: string) => {
    const distance = parseFloat(line.replace(/[^0-9.]/g, "").trim());
    if (!isNaN(distance) && distance > 0) { await processReading(distance); console.log("Serial:", distance, "cm"); }
  });
  port.on("open", () => console.log("Serial connected:", SERIAL_PORT_PATH));
  port.on("error", (e: Error) => console.error("Serial error:", e.message));
} catch (e) { console.warn("Serial port not available:", e); }

/* ---- AUTH ---- */
app.post("/auth/register", async (req, res) => { try { res.json(await registerUser(req.body.username, req.body.email, req.body.password)); } catch (e: any) { res.status(400).json({ error: e.message }); } });
app.post("/auth/login", async (req, res) => { try { res.json(await loginUser(req.body.username, req.body.password)); } catch (e: any) { res.status(401).json({ error: e.message }); } });

/* ---- READINGS ---- */
app.post("/readings", authMiddleware, async (req, res) => {
  if (typeof req.body.distance !== "number") { res.status(400).json({ error: "distance required" }); return; }
  res.json(await processReading(req.body.distance));
});
app.get("/readings", authMiddleware, (req, res) => { res.json(readings.slice(0, 100)); });
app.get("/readings/latest", authMiddleware, (req, res) => { res.json(readings[0] || null); });

/* ---- SCHEDULES ---- */
app.get("/schedules", authMiddleware, (req, res) => { res.json(schedules); });

app.post("/schedules", authMiddleware, (req, res) => {
  const { scheduledFor, notes } = req.body;
  if (!scheduledFor) { res.status(400).json({ error: "scheduledFor required" }); return; }
  const latest = readings[0];
  const schedule: CollectionSchedule = {
    id: generateId(),
    createdAt: new Date(),
    scheduledFor: new Date(scheduledFor),
    status: "pending",
    fillPercentAtCreation: latest ? latest.fillPercent : 0,
    notes: notes || "Manual schedule",
  };
  schedules.unshift(schedule);
  res.status(201).json(schedule);
});

app.patch("/schedules/:id", authMiddleware, (req, res) => {
  const schedule = schedules.find(s => s.id === req.params.id);
  if (!schedule) { res.status(404).json({ error: "Not found" }); return; }
  if (req.body.status) schedule.status = req.body.status;
  if (req.body.scheduledFor) schedule.scheduledFor = new Date(req.body.scheduledFor);
  if (req.body.notes) schedule.notes = req.body.notes;
  res.json(schedule);
});

app.delete("/schedules/:id", authMiddleware, (req, res) => {
  const idx = schedules.findIndex(s => s.id === req.params.id);
  if (idx === -1) { res.status(404).json({ error: "Not found" }); return; }
  schedules.splice(idx, 1);
  res.json({ ok: true });
});

/* ---- ALERTS CONFIG ---- */
app.get("/alerts/config", authMiddleware, (req, res) => { res.json(getAlertConfig()); });
app.put("/alerts/config", authMiddleware, (req, res) => { setAlertConfig(req.body); res.json(getAlertConfig()); });

/* ---- HEALTH ---- */
app.get("/health", (req, res) => { res.json({ status: "ok", timestamp: new Date() }); });

const PORT = process.env.PORT || 9001;
app.listen(PORT, () => console.log("Server running on port " + PORT));