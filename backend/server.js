require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"]
  }
});

const PORT = process.env.PORT || 5000;

// ====================== MIDDLEWARE ======================
app.use(cors());
app.use(express.json({ limit: '50mb' })); // Large limit for file uploads (base64)
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ====================== MONGODB CONNECTION ======================
mongoose
  .connect(process.env.MONGODB_URI || process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log('✅ Successfully connected to MongoDB!');
    // Start server after successful DB connection
    server.listen(PORT, () => {
      console.log(`🚀 Student Portal Backend running on http://localhost:${PORT}`);
      console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
      // Run reminders immediately on startup (for testing, can be removed in production)
      setTimeout(() => {
        sendDailyReminders();
      }, 5000);
    });
    console.log('⏰ Daily reminder cron scheduled: Every day at 8:00 AM IST');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    console.log('⚠️  Backend will continue running in offline fallback mode.');
    // Still start server even if DB connection fails
    server.listen(PORT, () => {
      console.log(`🚀 Student Portal Backend running on http://localhost:${PORT}`);
      console.log(`📡 API Health: http://localhost:${PORT}/api/health`);
    });
  });
if (!process.env.MONGODB_URI && !process.env.MONGO_URI) { console.error('❌ No MongoDB URI provided in environment. Set MONGODB_URI or MONGO_URI.'); process.exit(1); } console.log('Mongo URI =', process.env.MONGODB_URI || process.env.MONGO_URI);
mongoose.connection.on('disconnected', () => {
  console.log('⚠️  MongoDB disconnected');
});

// ====================== SOCKET.IO ======================
io.on('connection', (socket) => {
  console.log(`🔌 Socket.IO client connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log(`🔌 Socket.IO client disconnected: ${socket.id}`);
  });
});

// ====================== SCHEMAS ======================

// Student Schema
const StudentSchema = new mongoose.Schema({
  id: { type: String },
  name: { type: String, required: true },
  registerNumber: { type: String, required: true, unique: true },
  email: { type: String, default: '' },
  college: { type: String, default: '' },
  department: { type: String, default: '' },
  year: { type: String, default: '' },
  semester: { type: String, default: '' },
  password: { type: String, required: true },
  joinedAt: { type: String, default: () => new Date().toISOString() },
  lastLogin: { type: String, default: null },
  typingHighScore: { type: Number, default: 0 },
  memoryBestTime: { type: Number, default: 0 },
  memoryBestFlips: { type: Number, default: 0 }
});

// Event Schema
const EventSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  college: String,
  location: String,
  type: { type: String, enum: ['inter-college', 'intra-college'] },
  department: String,
  paymentType: { type: String, enum: ['free', 'paid'], default: 'free' },
  payment: { amount: Number, upiId: String, bankDetails: String },
  date: String,
  time: String,
  registrationLimit: Number,
  description: String,
  registrationCount: { type: Number, default: 0 },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

// Event Registration Schema
const RegistrationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  eventId: String,
  eventName: String,
  eventType: String,
  name: String,
  registerNumber: String,
  email: { type: String, default: '' },
  department: String,
  year: String,
  college: String,
  paymentStatus: { type: String, default: 'pending' },
  paymentAmount: { type: Number, default: 0 },
  paymentMethod: String,
  razorpayOrderId: String,
  razorpayPaymentId: String,
  razorpaySignature: String,
  status: { type: String, default: 'Confirmed' },
  attendance: { type: String, default: 'absent' },
  registeredAt: { type: String, default: () => new Date().toISOString() },
  lastReminderSentAt: { type: String, default: null }
});

// Certificate Schema
const CertificateSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentName: String,
  studentRegisterNo: String,
  department: String,
  year: String,
  college: String,
  eventName: String,
  achievement: String,
  date: String,
  remarks: String,
  adminRemarks: { type: String, default: '' },
  status: { type: String, default: 'pending' },
  fileName: String,
  fileType: String,
  fileData: String, // base64
  uploadedAt: { type: String, default: () => new Date().toISOString() },
  verifiedAt: String
});

// OD Application Schema
const ODApplicationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  studentName: String,
  registerNumber: String,
  department: String,
  year: String,
  semester: String,
  college: String,
  type: String, // Inter-College / Intra-College
  odDate: String,
  fromTime: String,
  toTime: String,
  eventName: String,
  venue: String,
  organizer: String,
  contactPerson: String,
  contactNumber: String,
  reason: String,
  supportingDoc: {
    fileName: String,
    fileType: String,
    fileData: String
  },
  status: { type: String, default: 'pending' },
  adminStatus: { type: String, default: 'pending' },
  hodStatus: { type: String, default: 'pending' },
  adminRemarks: { type: String, default: '' },
  hodRemarks: { type: String, default: '' },
  adminApprovedAt: String,
  adminRejectedAt: String,
  hodApprovedAt: String,
  _adminNotifSent: { type: Boolean, default: false },
  _adminRejectNotifSent: { type: Boolean, default: false },
  _hodApproveNotifSent: { type: Boolean, default: false },
  _hodRejectNotifSent: { type: Boolean, default: false },
  submittedAt: { type: String, default: () => new Date().toISOString() }
});

// Student Notification Schema
const StudentNotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  registerNumber: String,
  title: String,
  message: String,
  timestamp: { type: String, default: () => new Date().toISOString() },
  read: { type: Boolean, default: false }
});

// HOD Notification Schema
const HODNotificationSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  applicationId: String,
  studentName: String,
  registerNumber: String,
  department: String,
  eventName: String,
  odDate: String,
  type: String,
  adminRemarks: String,
  timestamp: { type: String, default: () => new Date().toISOString() },
  status: { type: String, default: 'pending' }
});

// Activity Schema
const ActivitySchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: String,
  description: String,
  timestamp: { type: String, default: () => new Date().toISOString() }
});

// LoginLog Schema - records each successful student login
const LoginLogSchema = new mongoose.Schema({
  registerNumber: { type: String, required: true },
  loginAt: { type: String, default: () => new Date().toISOString() },
  ip: { type: String, default: '' }
});

// ====================== MODELS ======================
const Student = mongoose.model('Student', StudentSchema);
const Event = mongoose.model('Event', EventSchema);
const Registration = mongoose.model('Registration', RegistrationSchema);
const Certificate = mongoose.model('Certificate', CertificateSchema);
const ODApplication = mongoose.model('ODApplication', ODApplicationSchema);
const StudentNotification = mongoose.model('StudentNotification', StudentNotificationSchema);
const HODNotification = mongoose.model('HODNotification', HODNotificationSchema);
const Activity = mongoose.model('Activity', ActivitySchema);
const LoginLog = mongoose.model('LoginLog', LoginLogSchema);

// ====================== EMAIL SERVICE ======================
let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpUser && smtpPass) {
    // Real SMTP
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: smtpUser,
        pass: smtpPass
      }
    });
  } else {
    // Generate test SMTP service (Ethereal Email)
    try {
      console.log('⚠️ No SMTP credentials in .env. Creating Ethereal Test Account...');
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`✅ Ethereal Test Account Created! User: ${testAccount.user}`);
    } catch (err) {
      console.error('❌ Failed to create Ethereal test account, email sending will be logged to console only.', err.message);
      // Mock transporter that just logs
      transporter = {
        sendMail: async (mailOptions) => {
          console.log('\n==================================================');
          console.log('📧 MOCK EMAIL SENDLOG:');
          console.log(`To: ${mailOptions.to}`);
          console.log(`Subject: ${mailOptions.subject}`);
          console.log(`Body:\n${mailOptions.text}`);
          console.log('==================================================\n');
          return { messageId: 'mock-id-' + Date.now() };
        }
      };
    }
  }
  return transporter;
}

async function sendRegistrationEmail(registration) {
  try {
    const emailTo = registration.email || '';
    if (!emailTo || !emailTo.includes('@')) {
      console.log(`⚠️ Skip sending email. No valid email found for registration ${registration.id} (student: ${registration.name})`);
      return;
    }

    const t = await getTransporter();
    
    // Fetch Event Details
    const event = await Event.findOne({ id: registration.eventId });
    const eventDate = event ? new Date(event.date).toLocaleDateString() : 'N/A';
    const eventTime = event ? (event.time || 'N/A') : 'N/A';
    const eventLoc = event ? (event.location || 'N/A') : 'N/A';
    const eventCollege = event ? (event.college || 'N/A') : 'N/A';
    
    const subject = `Registration ${registration.status}: ${registration.eventName}`;
    
    const textBody = `
Dear ${registration.name},

Your registration for the event "${registration.eventName}" has been processed.

Registration Details:
------------------------------------------
Event: ${registration.eventName}
Date: ${eventDate}
Time: ${eventTime}
Venue: ${eventLoc} (${eventCollege})
Status: ${registration.status}
Payment Status: ${registration.paymentStatus.toUpperCase()}
Amount: ₹${registration.paymentAmount || 0}
Register Number: ${registration.registerNumber}
Department: ${registration.department}
------------------------------------------

Thank you for registering. Please save this email for future reference.

Best regards,
Event Management Team
    `;

    const htmlBody = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <div style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 24px; color: white; text-align: center;">
          <h2 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Registration ${registration.status}!</h2>
          <p style="margin: 8px 0 0 0; opacity: 0.9; font-size: 14px;">Event Confirmation Details</p>
        </div>
        <div style="padding: 24px; color: #1e293b; background-color: #ffffff;">
          <p style="font-size: 16px; margin-top: 0;">Dear <strong>${registration.name}</strong>,</p>
          <p style="font-size: 15px; line-height: 1.6; color: #475569;">
            Your registration for <strong>${registration.eventName}</strong> has been successfully processed with status: <span style="background-color: ${registration.status === 'Confirmed' ? '#dcfce7' : '#fef3c7'}; color: ${registration.status === 'Confirmed' ? '#166534' : '#92400e'}; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 14px;">${registration.status}</span>.
          </p>
          
          <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0; border: 1px solid #f1f5f9;">
            <h3 style="margin-top: 0; margin-bottom: 16px; font-size: 16px; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">Event & Registration Information</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 6px 0; color: #64748b; width: 35%;"><strong>Event Name:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${registration.eventName}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Date:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${eventDate}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Time:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${eventTime}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Venue:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${eventLoc}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>College:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${eventCollege}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Reg Number:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;">${registration.registerNumber}</td>
              </tr>
              <tr>
                <td style="padding: 6px 0; color: #64748b;"><strong>Payment Status:</strong></td>
                <td style="padding: 6px 0; color: #0f172a;"><span style="text-transform: uppercase; font-weight: bold; font-size:12px;">${registration.paymentStatus}</span> (₹${registration.paymentAmount || 0})</td>
              </tr>
            </table>
          </div>
          
          <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 0;">
            * This is an automated email confirmation. Please keep this email for reference. If you have any queries, contact the event coordinator.
          </p>
        </div>
        <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
          <p style="margin: 0;">&copy; ${new Date().getFullYear()} College Event Portal. All rights reserved.</p>
        </div>
      </div>
    `;

    const info = await t.sendMail({
      from: process.env.SMTP_FROM || '"College Event Portal" <no-reply@collegeportal.edu>',
      to: emailTo,
      subject: subject,
      text: textBody,
      html: htmlBody
    });

    console.log(`✉️ Email notification sent successfully for registration ${registration.id} to ${emailTo}. ID: ${info.messageId}`);
    if (info.messageId && info.messageId.includes('ethereal')) {
      console.log(`🔗 Preview Ethereal Email here: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (err) {
    console.error('❌ Error sending registration email notification:', err.message);
  }
}

// ====================== RAZORPAY INSTANCE ======================
let razorpayInstance = null;
try {
  const rzpKeyId = process.env.RAZORPAY_KEY_ID;
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET;
  if (rzpKeyId && rzpKeySecret && rzpKeySecret !== 'your_razorpay_key_secret_here') {
    razorpayInstance = new Razorpay({
      key_id: rzpKeyId,
      key_secret: rzpKeySecret
    });
    console.log('✅ Razorpay instance created with key:', rzpKeyId);
  } else {
    console.log('⚠️  Razorpay keys not configured. Server-side order creation disabled. Using client-side only mode.');
  }
} catch (err) {
  console.error('❌ Razorpay initialization failed:', err.message);
}

// ====================== ROUTES ======================

// Get API Configs
app.get('/api/config', (req, res) => {
  res.json({
    razorpayKeyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_default_key',
    razorpayEnabled: !!razorpayInstance
  });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Student Portal Backend is running', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// ---------- STUDENT ROUTES ----------
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find({}, '-password');
    res.json(students);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/students/register', async (req, res) => {
  try {
    const exists = await Student.findOne({ registerNumber: req.body.registerNumber });
    if (exists) return res.status(400).json({ message: 'Student already registered. Please login.' });
    const student = new Student({ ...req.body, id: req.body.id || ('stu-' + Date.now()) });
    await student.save();
    const { password, ...safeStudent } = student.toObject();
    io.emit('student_change', { action: 'register' });
    res.status(201).json(safeStudent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/students/login', async (req, res) => {
  try {
    const { registerNumber, password } = req.body;
    const student = await Student.findOne({ registerNumber });
    if (!student) {
      console.warn(`⚠️ Login attempt for unknown registerNumber: ${registerNumber}`);
      return res.status(404).json({ message: 'Student not found. Please register first.' });
    }
    if (student.password !== password) {
      console.warn(`⚠️ Invalid password for registerNumber: ${registerNumber}`);
      return res.status(401).json({ message: 'Invalid password' });
    }
    student.lastLogin = new Date().toISOString();
    await student.save();
    // Record login event
    try {
      const logEntry = new LoginLog({ registerNumber, ip: req.ip || '' });
      await logEntry.save();
      console.log(`✅ LoginLog created for ${registerNumber}`);
    } catch (logErr) {
      console.error('❌ Failed to create login log:', logErr.message);
    }
    const { password: pw, ...safeStudent } = student.toObject();
    res.json(safeStudent);
  } catch (e) {
    console.error('❌ Login route error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.put('/api/students/:registerNumber', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const student = await Student.findOneAndUpdate(
      { registerNumber: req.params.registerNumber },
      req.body,
      { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    const { password, ...safeStudent } = student.toObject();
    io.emit('student_change', { action: 'update', registerNumber: req.params.registerNumber });
    res.json(safeStudent);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk sync students from localStorage (for migration)
app.post('/api/students/sync', async (req, res) => {
  try {
    const students = req.body; // array of students
    let added = 0;
    for (const s of students) {
      const exists = await Student.findOne({ registerNumber: s.registerNumber });
      if (!exists) {
        await new Student({ ...s, id: s.id || ('stu-' + Date.now() + Math.random()) }).save();
        added++;
      }
    }
    res.json({ message: `Synced. ${added} new students added.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- EVENT ROUTES ----------
app.get('/api/events', async (req, res) => {
  try {
    const events = await Event.find({});
    res.json(events);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/events', async (req, res) => {
  try {
    const event = new Event(req.body);
    await event.save();
    io.emit('event_change', { action: 'create', id: event.id });
    res.status(201).json(event);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/events/:id', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const event = await Event.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    io.emit('event_change', { action: 'update', id: req.params.id });
    res.json(event);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/events/:id', async (req, res) => {
  try {
    await Event.findOneAndDelete({ id: req.params.id });
    io.emit('event_change', { action: 'delete', id: req.params.id });
    res.json({ message: 'Event deleted' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk sync events
app.post('/api/events/sync', async (req, res) => {
  try {
    const events = req.body;
    let added = 0;
    for (const ev of events) {
      const exists = await Event.findOne({ id: ev.id });
      if (!exists) { await new Event(ev).save(); added++; }
    }
    res.json({ message: `Synced. ${added} new events added.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- REGISTRATION ROUTES ----------
app.get('/api/registrations', async (req, res) => {
  try {
    const regs = await Registration.find({});
    res.json(regs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/registrations/student/:regNo', async (req, res) => {
  try {
    const regs = await Registration.find({ registerNumber: req.params.regNo });
    res.json(regs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/registrations', async (req, res) => {
  try {
    // Ensure a unique id exists
    if (!req.body.id) {
      req.body.id = 'reg-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5);
    }
    const reg = new Registration(req.body);
    await reg.save();
    
    // Send email alert asynchronously
    sendRegistrationEmail(reg).catch(err => console.error('Email alert failure:', err.message));
    io.emit('registration_change', { action: 'create', id: reg.id, eventId: reg.eventId });
    res.status(201).json(reg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/registrations/:id', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const reg = await Registration.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!reg) return res.status(404).json({ message: 'Registration not found' });
    
    // Send email alert asynchronously
    sendRegistrationEmail(reg).catch(err => console.error('Email alert failure:', err.message));
    io.emit('registration_change', { action: 'update', id: req.params.id });
    res.json(reg);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk sync registrations
app.post('/api/registrations/sync', async (req, res) => {
  try {
    const regs = req.body;
    let added = 0;
    for (const r of regs) {
      const exists = await Registration.findOne({ id: r.id });
      if (!exists) {
        await new Registration(r).save();
        added++;
      } else {
        await Registration.findOneAndUpdate({ id: r.id }, r);
      }
    }
    res.json({ message: `Synced. ${added} new registrations added.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- RAZORPAY PAYMENT ROUTES ----------
// Create a Razorpay order (server-side)
app.post('/api/payments/create-order', async (req, res) => {
  try {
    if (!razorpayInstance) {
      return res.status(503).json({ 
        message: 'Razorpay not configured on server. Using client-side mode.',
        fallback: true 
      });
    }
    const { amount, currency, eventId, registrationId, studentRegNo } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Invalid amount' });
    }
    const options = {
      amount: Math.round(amount * 100), // Convert to paise
      currency: currency || 'INR',
      receipt: `rcpt_${registrationId || Date.now()}`,
      notes: {
        event_id: eventId || '',
        registration_id: registrationId || '',
        student_reg_no: studentRegNo || ''
      }
    };
    const order = await razorpayInstance.orders.create(options);
    console.log(`💳 Razorpay Order created: ${order.id} for ₹${amount}`);
    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    });
  } catch (e) {
    console.error('❌ Razorpay order creation failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Verify Razorpay payment signature (server-side)
app.post('/api/payments/verify', async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, registrationId } = req.body;
    
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ message: 'Missing payment verification details' });
    }
    
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keySecret || keySecret === 'your_razorpay_key_secret_here') {
      // Cannot verify without secret, trust client response
      console.log('⚠️  No RAZORPAY_KEY_SECRET set. Accepting payment without server-side verification.');
      // Update registration
      if (registrationId) {
        const reg = await Registration.findOneAndUpdate(
          { id: registrationId },
          {
            paymentStatus: 'paid',
            status: 'Confirmed',
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id
          },
          { new: true }
        );
        if (reg) {
          sendRegistrationEmail(reg).catch(err => console.error('Email alert failure:', err.message));
        }
      }
      return res.json({ verified: true, message: 'Payment accepted (no server-side verification)' });
    }
    
    // Verify HMAC SHA256 signature
    const body = razorpay_order_id + '|' + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac('sha256', keySecret)
      .update(body)
      .digest('hex');
    
    const isValid = expectedSignature === razorpay_signature;
    
    if (isValid) {
      console.log(`✅ Payment verified: ${razorpay_payment_id} for order ${razorpay_order_id}`);
      // Update registration
      if (registrationId) {
        const reg = await Registration.findOneAndUpdate(
          { id: registrationId },
          {
            paymentStatus: 'paid',
            status: 'Confirmed',
            razorpayPaymentId: razorpay_payment_id,
            razorpayOrderId: razorpay_order_id,
            razorpaySignature: razorpay_signature
          },
          { new: true }
        );
        if (reg) {
          sendRegistrationEmail(reg).catch(err => console.error('Email alert failure:', err.message));
        }
      }
      res.json({ verified: true, message: 'Payment verified successfully' });
    } else {
      console.error('❌ Payment verification FAILED — signature mismatch');
      res.status(400).json({ verified: false, message: 'Payment verification failed — signature mismatch' });
    }
  } catch (e) {
    console.error('❌ Payment verification error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ---------- CERTIFICATE ROUTES ----------
app.get('/api/certificates', async (req, res) => {
  try {
    const certs = await Certificate.find({});
    res.json(certs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/certificates/student/:regNo', async (req, res) => {
  try {
    const certs = await Certificate.find({ studentRegisterNo: req.params.regNo });
    res.json(certs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/certificates', async (req, res) => {
  try {
    // Ensure a unique id exists for certificate
    if (!req.body.id) {
      req.body.id = 'cert-' + Date.now() + '-' + Math.random().toString(36).substr(2,5);
    }
    const cert = new Certificate(req.body);
    await cert.save();
    io.emit('certificate_change', { action: 'create', id: cert.id });
    res.status(201).json(cert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/certificates/:id', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const cert = await Certificate.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!cert) return res.status(404).json({ message: 'Certificate not found' });
    io.emit('certificate_change', { action: 'update', id: req.params.id });
    res.json(cert);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk sync certificates
app.post('/api/certificates/sync', async (req, res) => {
  try {
    const certs = req.body;
    let added = 0;
    for (const c of certs) {
      const exists = await Certificate.findOne({ id: c.id });
      if (!exists) {
        await new Certificate(c).save();
        added++;
      } else {
        await Certificate.findOneAndUpdate({ id: c.id }, c);
      }
    }
    res.json({ message: `Synced. ${added} new certificates added.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- OD APPLICATION ROUTES ----------
app.get('/api/od', async (req, res) => {
  try {
    const ods = await ODApplication.find({});
    res.json(ods);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/od/student/:regNo', async (req, res) => {
  try {
    const ods = await ODApplication.find({ registerNumber: req.params.regNo });
    res.json(ods);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/od', async (req, res) => {
  try {
    // Ensure a unique id exists for OD application
    if (!req.body.id) {
      req.body.id = 'od-' + Date.now() + '-' + Math.random().toString(36).substr(2,5);
    }
    const od = new ODApplication(req.body);
    await od.save();
    io.emit('od_change', { action: 'create', id: od.id });
    res.status(201).json(od);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/od/:id', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const od = await ODApplication.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!od) return res.status(404).json({ message: 'OD Application not found' });
    io.emit('od_change', { action: 'update', id: req.params.id });
    res.json(od);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Bulk sync OD applications
app.post('/api/od/sync', async (req, res) => {
  try {
    const ods = req.body;
    let added = 0;
    for (const od of ods) {
      const exists = await ODApplication.findOne({ id: od.id });
      if (!exists) { await new ODApplication(od).save(); added++; }
      else { await ODApplication.findOneAndUpdate({ id: od.id }, od); }
    }
    res.json({ message: `Synced. ${added} new OD applications added.` });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- STUDENT NOTIFICATIONS ----------
app.get('/api/notifications/student/:regNo', async (req, res) => {
  try {
    const notifs = await StudentNotification.find({ registerNumber: req.params.regNo });
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/student', async (req, res) => {
  try {
    const notif = new StudentNotification(req.body);
    await notif.save();
    io.emit('notification_change', { action: 'create', registerNumber: notif.registerNumber });
    res.status(201).json(notif);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/student/:id', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const notif = await StudentNotification.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    res.json(notif);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- HOD NOTIFICATIONS ----------
app.get('/api/notifications/hod', async (req, res) => {
  try {
    const notifs = await HODNotification.find({});
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/notifications/hod', async (req, res) => {
  try {
    const notif = new HODNotification(req.body);
    await notif.save();
    io.emit('hod_notification_change', { action: 'create' });
    res.status(201).json(notif);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/notifications/hod/:id', async (req, res) => {
  try {
    delete req.body._id;
    delete req.body.__v;
    const notif = await HODNotification.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (!notif) return res.status(404).json({ message: 'HOD notification not found' });
    res.json(notif);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ---------- ACTIVITIES ----------
app.get('/api/activities', async (req, res) => {
  try {
    const acts = await Activity.find({}).sort({ timestamp: -1 }).limit(20);
    res.json(acts);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/activities', async (req, res) => {
  try {
    const act = new Activity(req.body);
    await act.save();
    io.emit('activity_change', { action: 'create' });
    res.status(201).json(act);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ====================== DAILY EMAIL REMINDER CRON ======================
async function sendDailyReminders() {
  console.log('\n🔔 [CRON] Running daily event reminder job...');
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find all events that haven't happened yet (date >= today)
    const upcomingEvents = await Event.find({});
    const futureEvents = upcomingEvents.filter(ev => {
      const eventDate = new Date(ev.date);
      eventDate.setHours(0, 0, 0, 0);
      return eventDate >= today;
    });

    if (futureEvents.length === 0) {
      console.log('   No upcoming events found. Skipping reminders.');
      return;
    }

    let totalSent = 0;
    const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD

    for (const event of futureEvents) {
      const eventDate = new Date(event.date);
      eventDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.ceil((eventDate - today) / (1000 * 60 * 60 * 24));

      // Get all confirmed registrations for this event
      const registrations = await Registration.find({
        eventId: event.id,
        status: { $in: ['Confirmed', 'Waiting List'] }
      });

      for (const reg of registrations) {
        // Skip if no valid email
        const email = reg.email || '';
        if (!email || !email.includes('@')) continue;

        // Skip if reminder was already sent today
        if (reg.lastReminderSentAt) {
          const lastSentDate = reg.lastReminderSentAt.split('T')[0];
          if (lastSentDate === todayStr) continue;
        }

        // Send reminder email
        try {
          await sendReminderEmail(reg, event, daysUntil);

          // Update lastReminderSentAt
          await Registration.findOneAndUpdate(
            { id: reg.id },
            { lastReminderSentAt: new Date().toISOString() }
          );
          totalSent++;
        } catch (emailErr) {
          console.error(`   ❌ Failed to send reminder to ${email}:`, emailErr.message);
        }
      }
    }

    console.log(`   ✅ Daily reminders complete. ${totalSent} email(s) sent.`);
  } catch (err) {
    console.error('   ❌ Daily reminder cron error:', err.message);
  }
}

async function sendReminderEmail(registration, event, daysUntil) {
  const emailTo = registration.email;
  const t = await getTransporter();

  const eventDate = new Date(event.date).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });
  const eventTime = event.time || 'TBD';
  const eventLoc = event.location || 'TBD';
  const eventCollege = event.college || '';

  const urgencyText = daysUntil === 0 ? '🔴 TODAY' :
                      daysUntil === 1 ? '🟠 TOMORROW' :
                      `📅 In ${daysUntil} day${daysUntil > 1 ? 's' : ''}`;

  const subject = daysUntil === 0
    ? `🔴 REMINDER: "${event.name}" is TODAY!`
    : daysUntil === 1
      ? `🟠 REMINDER: "${event.name}" is TOMORROW!`
      : `📅 Event Reminder: "${event.name}" in ${daysUntil} days`;

  const textBody = `
Dear ${registration.name},

This is a friendly reminder about your upcoming event:

Event: ${event.name}
Date: ${eventDate} (${urgencyText})
Time: ${eventTime}
Venue: ${eventLoc} ${eventCollege ? '(' + eventCollege + ')' : ''}
Your Status: ${registration.status}
${registration.paymentStatus === 'unpaid' ? '\n⚠️ PAYMENT PENDING: Please complete your payment of ₹' + (registration.paymentAmount || 0) + ' before the event.\n' : ''}

Please ensure you arrive on time. Good luck!

Best regards,
Event Management Team
  `;

  const htmlBody = `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, ${daysUntil === 0 ? '#dc2626, #ef4444' : daysUntil === 1 ? '#ea580c, #f97316' : '#4f46e5, #7c3aed'}); padding: 24px; color: white; text-align: center;">
        <h2 style="margin: 0; font-size: 22px; font-weight: 700;">${urgencyText}</h2>
        <p style="margin: 8px 0 0 0; opacity: 0.95; font-size: 18px; font-weight: 600;">${event.name}</p>
      </div>
      <div style="padding: 24px; color: #1e293b; background-color: #ffffff;">
        <p style="font-size: 16px; margin-top: 0;">Dear <strong>${registration.name}</strong>,</p>
        <p style="font-size: 15px; line-height: 1.6; color: #475569;">This is a reminder about your registered event. Here are the details:</p>
        
        <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid ${daysUntil === 0 ? '#dc2626' : daysUntil === 1 ? '#ea580c' : '#4f46e5'};">
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; width: 30%;"><strong>📅 Date:</strong></td>
              <td style="padding: 8px 0; color: #0f172a; font-weight: 600;">${eventDate}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>🕐 Time:</strong></td>
              <td style="padding: 8px 0; color: #0f172a;">${eventTime}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>📍 Venue:</strong></td>
              <td style="padding: 8px 0; color: #0f172a;">${eventLoc}${eventCollege ? ' (' + eventCollege + ')' : ''}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #64748b;"><strong>📋 Status:</strong></td>
              <td style="padding: 8px 0;"><span style="background-color: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 6px; font-weight: 600; font-size: 13px;">${registration.status}</span></td>
            </tr>
          </table>
        </div>
        
        ${registration.paymentStatus === 'unpaid' ? `
        <div style="background-color: #fef3c7; border-radius: 8px; padding: 16px; margin: 16px 0; border: 1px solid #fde68a;">
          <p style="margin: 0; color: #92400e; font-weight: 600; font-size: 14px;">⚠️ Payment Pending: ₹${registration.paymentAmount || 0}</p>
          <p style="margin: 6px 0 0 0; color: #92400e; font-size: 13px;">Please complete your payment before the event to confirm your spot.</p>
        </div>` : ''}
        
        <p style="font-size: 14px; color: #64748b; line-height: 1.5; margin-bottom: 0;">Please arrive on time. We look forward to seeing you there!</p>
      </div>
      <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 12px; color: #94a3b8;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} College Event Portal. You're receiving this because you registered for this event.</p>
      </div>
    </div>
  `;

  const info = await t.sendMail({
    from: process.env.SMTP_FROM || '"College Event Portal" <no-reply@collegeportal.edu>',
    to: emailTo,
    subject: subject,
    text: textBody,
    html: htmlBody
  });

  console.log(`   📧 Reminder sent to ${emailTo} for "${event.name}" (${urgencyText}). ID: ${info.messageId}`);
  if (info.messageId && info.messageId.includes('ethereal')) {
    console.log(`   🔗 Preview: ${nodemailer.getTestMessageUrl(info)}`);
  }
}

// Schedule the daily reminder cron — runs every day at 8:00 AM
cron.schedule('0 8 * * *', () => {
  sendDailyReminders();
}, {
  timezone: 'Asia/Kolkata'
});
console.log('⏰ Daily reminder cron scheduled: Every day at 8:00 AM IST');