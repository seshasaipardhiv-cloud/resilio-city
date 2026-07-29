/**
 * Auth & Petition Engine
 * Handles user registration, login, admin auth, petitions, and email notifications
 * Admin: Pardhiv / Pardhiv@2008
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const DATA_DIR = path.join(process.cwd(), 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const PETITIONS_FILE = path.join(DATA_DIR, 'petitions.json');

const JWT_SECRET = 'resilio_city_jwt_secret_2026_national_digital_twin';

// Admin credentials (hardcoded)
const ADMIN_USERNAME = 'Pardhiv';
const ADMIN_PASSWORD_HASH = bcrypt.hashSync('Pardhiv@2008', 10);

// Ensure data dir exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, '[]', 'utf-8');
if (!fs.existsSync(PETITIONS_FILE)) fs.writeFileSync(PETITIONS_FILE, '[]', 'utf-8');

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  created_at: string;
}

export interface Petition {
  id: string;
  user_name: string;
  user_email: string;
  user_phone: string;
  city_name: string;
  state: string;
  country: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
  admin_comment?: string;
  created_at: string;
  resolved_at?: string;
  city_id?: string; // generated after acceptance
}

// ── User Store ────────────────────────────────────────────────────────────────
function readUsers(): User[] {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8')); } catch { return []; }
}
function writeUsers(users: User[]) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

// ── Petition Store ────────────────────────────────────────────────────────────
function readPetitions(): Petition[] {
  try { return JSON.parse(fs.readFileSync(PETITIONS_FILE, 'utf-8')); } catch { return []; }
}
function writePetitions(petitions: Petition[]) {
  fs.writeFileSync(PETITIONS_FILE, JSON.stringify(petitions, null, 2), 'utf-8');
}

// ── Email Transporter (using Gmail via env or console fallback) ───────────────
function getTransporter() {
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });
  }
  // Development: log emails to console
  return nodemailer.createTransport({ jsonTransport: true });
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER || 'noreply@resiliocity.in',
      to,
      subject,
      html
    });
    if (!process.env.EMAIL_USER) {
      console.log(`[Email Dev] Would send email to ${to}: Subject="${subject}"`);
      console.log('[Email Dev] Content preview:', html.replace(/<[^>]+>/g, '').substring(0, 200));
    } else {
      console.log(`[Email] Sent to ${to}: ${subject} (${info.messageId})`);
    }
  } catch (err: any) {
    console.warn(`[Email] Failed to send to ${to}: ${err.message}`);
  }
}

function generatePetitionAcceptedEmail(petition: Petition): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', sans-serif; background: #030610; color: #e0f0ff; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background: #060c1a; border: 1px solid rgba(0,212,255,0.3); border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #00d4ff20, #00ff9d10); padding: 32px; text-align: center; border-bottom: 1px solid rgba(0,212,255,0.2); }
  .logo { font-size: 32px; font-weight: 900; background: linear-gradient(90deg, #00d4ff, #00ff9d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px; }
  .badge { display: inline-block; background: rgba(0,255,157,0.15); border: 1px solid #00ff9d; border-radius: 20px; padding: 6px 18px; font-size: 12px; color: #00ff9d; font-weight: 700; margin-top: 12px; }
  .body { padding: 32px; }
  .city-box { background: rgba(0,212,255,0.08); border: 1px solid rgba(0,212,255,0.3); border-radius: 12px; padding: 20px; margin: 20px 0; }
  .city-name { font-size: 24px; font-weight: 800; color: #00d4ff; margin-bottom: 8px; }
  .detail { font-size: 14px; color: rgba(200,230,255,0.7); margin-bottom: 6px; }
  .footer { padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: rgba(200,230,255,0.4); text-align: center; }
  .highlight { color: #00ff9d; font-weight: 700; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏙️ RESILIO CITY</div>
      <div style="font-size: 13px; color: rgba(0,212,255,0.7); margin-top: 6px; letter-spacing: 1px;">NATIONAL DIGITAL TWIN PLATFORM</div>
      <div class="badge">✅ PETITION ACCEPTED</div>
    </div>
    <div class="body">
      <p>Dear <span class="highlight">${petition.user_name}</span>,</p>
      <p>Great news! Your petition to add <strong>${petition.city_name}</strong> to the Resilio City National Digital Twin Platform has been <span class="highlight">accepted</span> by our administrators.</p>
      <div class="city-box">
        <div class="city-name">🗺️ ${petition.city_name}</div>
        <div class="detail">📍 ${petition.state}, ${petition.country}</div>
        <div class="detail">📋 Your reason: "${petition.reason}"</div>
      </div>
      <p>Our AI engine is now processing the complete road network, municipal boundaries, and infrastructure data for <strong>${petition.city_name}</strong> using OpenStreetMap and satellite data. The city will be visible on the Resilio City dashboard once fully ingested.</p>
      <p>You can now visit the platform and search for <strong>${petition.city_name}</strong> in the city selector.</p>
      <p style="margin-top: 24px; color: rgba(200,230,255,0.6);">Thank you for helping us build a more resilient India, one city at a time.</p>
    </div>
    <div class="footer">
      © 2026 Resilio City · National Urban Digital Twin Platform · ZERO FAKE DATA
    </div>
  </div>
</body>
</html>`;
}

function generatePetitionRejectedEmail(petition: Petition): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><style>
  body { font-family: 'Segoe UI', sans-serif; background: #030610; color: #e0f0ff; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background: #060c1a; border: 1px solid rgba(255,59,107,0.3); border-radius: 16px; overflow: hidden; }
  .header { background: linear-gradient(135deg, #ff3b6b20, #ff000010); padding: 32px; text-align: center; border-bottom: 1px solid rgba(255,59,107,0.2); }
  .logo { font-size: 32px; font-weight: 900; background: linear-gradient(90deg, #00d4ff, #00ff9d); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 2px; }
  .badge { display: inline-block; background: rgba(255,59,107,0.15); border: 1px solid #ff3b6b; border-radius: 20px; padding: 6px 18px; font-size: 12px; color: #ff3b6b; font-weight: 700; margin-top: 12px; }
  .body { padding: 32px; }
  .comment-box { background: rgba(255,59,107,0.08); border: 1px solid rgba(255,59,107,0.3); border-radius: 12px; padding: 20px; margin: 20px 0; }
  .footer { padding: 24px 32px; border-top: 1px solid rgba(255,255,255,0.05); font-size: 12px; color: rgba(200,230,255,0.4); text-align: center; }
  .highlight { color: #ff3b6b; font-weight: 700; }
</style></head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">🏙️ RESILIO CITY</div>
      <div style="font-size: 13px; color: rgba(0,212,255,0.7); margin-top: 6px; letter-spacing: 1px;">NATIONAL DIGITAL TWIN PLATFORM</div>
      <div class="badge">❌ PETITION REVIEWED</div>
    </div>
    <div class="body">
      <p>Dear <span style="color:#00d4ff; font-weight:700">${petition.user_name}</span>,</p>
      <p>Thank you for your petition to add <strong>${petition.city_name}</strong>. After careful review, our administrators were unable to approve this request at this time.</p>
      ${petition.admin_comment ? `<div class="comment-box"><strong>Admin Note:</strong><br><em>${petition.admin_comment}</em></div>` : ''}
      <p>You are welcome to re-submit your petition with additional details or at a later time. We are continuously expanding our coverage across India.</p>
      <p style="margin-top: 24px; color: rgba(200,230,255,0.6);">Thank you for your interest in making India more resilient.</p>
    </div>
    <div class="footer">
      © 2026 Resilio City · National Urban Digital Twin Platform
    </div>
  </div>
</body>
</html>`;
}

// ── Auth Functions ────────────────────────────────────────────────────────────
export function registerUser(name: string, email: string, phone: string, password: string): { success: boolean; message: string; token?: string } {
  const users = readUsers();
  if (users.find(u => u.email === email)) {
    return { success: false, message: 'Email already registered' };
  }
  const id = `user_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const password_hash = bcrypt.hashSync(password, 10);
  const user: User = { id, name, email, phone, password_hash, created_at: new Date().toISOString() };
  users.push(user);
  writeUsers(users);
  const token = jwt.sign({ id, email, name, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  return { success: true, message: 'Account created successfully', token };
}

export function loginUser(email: string, password: string): { success: boolean; message: string; token?: string; user?: any } {
  const users = readUsers();
  const user = users.find(u => u.email === email);
  if (!user) return { success: false, message: 'No account found with this email' };
  if (!bcrypt.compareSync(password, user.password_hash)) return { success: false, message: 'Incorrect password' };
  const token = jwt.sign({ id: user.id, email: user.email, name: user.name, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  return { success: true, message: 'Login successful', token, user: { id: user.id, name: user.name, email: user.email, phone: user.phone } };
}

export function loginAdmin(username: string, password: string): { success: boolean; message: string; token?: string } {
  if (username !== ADMIN_USERNAME) return { success: false, message: 'Invalid admin credentials' };
  if (!bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)) return { success: false, message: 'Invalid admin credentials' };
  const token = jwt.sign({ id: 'admin', username: ADMIN_USERNAME, role: 'admin' }, JWT_SECRET, { expiresIn: '24h' });
  return { success: true, message: 'Admin login successful', token };
}

export function verifyToken(token: string): any {
  try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
}

export function getTokenFromHeader(authHeader: string | undefined): string | null {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  return authHeader.substring(7);
}

// ── Petition Functions ────────────────────────────────────────────────────────
export function createPetition(data: { user_name: string; user_email: string; user_phone: string; city_name: string; state: string; country: string; reason: string }): Petition {
  const petitions = readPetitions();
  const id = `petition_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  const petition: Petition = {
    id,
    ...data,
    status: 'pending',
    created_at: new Date().toISOString()
  };
  petitions.push(petition);
  writePetitions(petitions);
  return petition;
}

export function getAllPetitions(): Petition[] {
  return readPetitions();
}

export function getPetitionById(id: string): Petition | undefined {
  return readPetitions().find(p => p.id === id);
}

export async function acceptPetition(id: string, adminComment?: string): Promise<{ success: boolean; message: string; city_id?: string }> {
  const petitions = readPetitions();
  const idx = petitions.findIndex(p => p.id === id);
  if (idx === -1) return { success: false, message: 'Petition not found' };
  
  const petition = petitions[idx]!;
  // Generate a safe city_id from city_name
  const city_id = petition.city_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  
  petition.status = 'accepted';
  if (adminComment !== undefined) petition.admin_comment = adminComment;
  petition.resolved_at = new Date().toISOString();
  petition.city_id = city_id;
  petitions[idx] = petition;
  writePetitions(petitions);

  // Send acceptance email
  await sendEmail(
    petition.user_email,
    `✅ Your petition for ${petition.city_name} has been accepted - Resilio City`,
    generatePetitionAcceptedEmail(petition)
  );

  console.log(`[Admin] Petition ACCEPTED for city: ${petition.city_name} → ID: ${city_id}`);
  return { success: true, message: `Petition accepted. City '${petition.city_name}' will be added.`, city_id };
}

export async function rejectPetition(id: string, adminComment?: string): Promise<{ success: boolean; message: string }> {
  const petitions = readPetitions();
  const idx = petitions.findIndex(p => p.id === id);
  if (idx === -1) return { success: false, message: 'Petition not found' };
  
  const petition = petitions[idx]!;
  petition.status = 'rejected';
  if (adminComment !== undefined) petition.admin_comment = adminComment;
  petition.resolved_at = new Date().toISOString();
  petitions[idx] = petition;
  writePetitions(petitions);

  // Send rejection email
  await sendEmail(
    petition.user_email,
    `Update on your petition for ${petition.city_name} - Resilio City`,
    generatePetitionRejectedEmail(petition)
  );

  console.log(`[Admin] Petition REJECTED for city: ${petition.city_name}`);
  return { success: true, message: 'Petition rejected and user notified' };
}
