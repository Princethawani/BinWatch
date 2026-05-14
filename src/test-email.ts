import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || "587"),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

console.log("Testing SMTP connection...");
console.log("Host:", process.env.SMTP_HOST);
console.log("Port:", process.env.SMTP_PORT);
console.log("User:", process.env.SMTP_USER);
console.log("Pass:", process.env.SMTP_PASS ? "[set - " + process.env.SMTP_PASS.length + " chars]" : "[NOT SET]");

transporter.verify((error, success) => {
  if (error) {
    console.error("SMTP connection FAILED:", error.message);
    process.exit(1);
  }
  console.log("SMTP connection OK - sending test email...");
  transporter.sendMail({
    from: process.env.SMTP_USER,
    to: process.env.SMTP_USER,
    subject: "Waste Collection Managment Sys Test Email - " + new Date().toLocaleTimeString(),
    html: "<h2>Waste Collection Managment Sys is working!</h2><p>SMTP connection verified successfully.</p><p>Sent at: " + new Date().toLocaleString() + "</p>",
  }, (err, info) => {
    if (err) { console.error("Send FAILED:", err.message); process.exit(1); }
    console.log("Email sent!", info.messageId);
    console.log("Check your inbox at:", process.env.SMTP_USER);
  });
});