const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const adminHTML = require('../admin.js');

const app = express();
app.use(express.json({ limit: '32kb' }));
app.use(cookieParser());
// Disable CSP in helmet to allow inline scripts & CDNs required by the constrained single-file frontend
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false })); 

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100, message: { success: false, message: "Too many requests." } });
app.use('/api/', apiLimiter);

// ==========================================
// MONGODB CONFIGURATION & SERVERLESS POOLING
// ==========================================
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB_NAME || 'smilecraft_dental';
const jwtSecret = process.env.SESSION_SECRET;
let cachedClient = null;
let cachedDb = null;

let connectionPromise = null;
async function connectDB() {
    if (cachedClient && cachedDb) return cachedDb;
    if (!uri) throw new Error('MONGODB_URI missing in environment');
    if (!connectionPromise) {
        connectionPromise = (async () => {
            const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000, maxPoolSize: 10 });
            try {
                await client.connect();
                const db = client.db(dbName);
                await seedDB(db);
                cachedClient = client; cachedDb = db;
                return db;
            } catch (error) { await client.close().catch(() => {}); throw error; }
            finally { connectionPromise = null; }
        })();
    }
    return connectionPromise;
}

// Auto-seed initial required data (Admin, Sample Dentists, Services)
async function seedDB(db) {
    const admins = db.collection('admins');
    if (await admins.countDocuments() === 0 && process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD) {
        const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
        await admins.insertOne({ email: process.env.ADMIN_EMAIL, password: hash, role: 'superadmin', active: true });
    }
    const services = db.collection('services');
    if (await services.countDocuments() === 0) {
        await services.insertMany([
            { name: 'General Consultation', description: 'Comprehensive checkup.', price: 2500, duration: 30, active: true },
            { name: 'Teeth Whitening', description: 'Professional laser whitening.', price: 15000, duration: 60, active: true },
            { name: 'Root Canal', description: 'Painless RCT treatment.', price: 8000, duration: 60, active: true }
        ]);
    }
    const dentists = db.collection('dentists');
    if (await dentists.countDocuments() === 0) {
        await dentists.insertMany([
            { name: 'Dr. Ayesha Malik', specialty: 'General & Cosmetic', active: true },
            { name: 'Dr. Hamza Ahmed', specialty: 'Orthodontic Care', active: true }
        ]);
    }
}

// ==========================================
// MIDDLEWARES
// ==========================================
const requireAdmin = async (req, res, next) => {
    try {
        if (!jwtSecret || jwtSecret.length < 32) return res.status(503).json({ success: false, message: 'Session security is not configured.' });
        const token = req.cookies.admin_token;
        if (!token) return res.status(401).json({ success: false, message: 'Unauthorized' });
        const decoded = jwt.verify(token, jwtSecret);
        req.adminId = decoded.adminId;
        next();
    } catch (err) { res.status(401).json({ success: false, message: 'Invalid session' }); }
};

// ==========================================
// PUBLIC API ROUTES
// ==========================================
app.get('/api/health', async (req, res) => {
    const configOk = Boolean(uri && jwtSecret && jwtSecret.length >= 32);
    if (!configOk) return res.status(503).json({ success: false, status: 'Misconfigured', checks: { config: false, database: 'not_checked' } });
    try {
        const db = await connectDB(); await db.command({ ping: 1 });
        return res.json({ success: true, status: 'Healthy', checks: { config: true, database: 'connected' } });
    } catch (error) {
        return res.status(503).json({ success: false, status: 'Degraded', checks: { config: true, database: 'disconnected' } });
    }
});

app.get('/api/services', async (req, res) => {
    try { const db = await connectDB(); const s = await db.collection('services').find({active: true}).toArray(); res.json({ success: true, data: s }); } 
    catch (e) { res.status(500).json({ success: false, message: 'DB Error' }); }
});

app.get('/api/dentists', async (req, res) => {
    try { const db = await connectDB(); const d = await db.collection('dentists').find({active: true}).toArray(); res.json({ success: true, data: d }); } 
    catch (e) { res.status(500).json({ success: false, message: 'DB Error' }); }
});

// Calculate availability
app.get('/api/availability', async (req, res) => {
    try {
        const { date, dentistId } = req.query;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !ObjectId.isValid(String(dentistId || ''))) return res.status(400).json({ success: false, message: 'A valid date and dentist are required.' });
        const parsedDate = new Date(`${date}T00:00:00Z`);
        if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) return res.status(400).json({ success: false, message: 'Invalid appointment date.' });
        const db = await connectDB();
        
        // Clinic hours: 9 AM to 8 PM
        const slots = [];
        for(let hour = 9; hour < 20; hour++) {
            slots.push(`${hour.toString().padStart(2, '0')}:00`);
            slots.push(`${hour.toString().padStart(2, '0')}:30`);
        }
        
        const startOfDay = new Date(`${date}T00:00:00Z`);
        const endOfDay = new Date(`${date}T23:59:59Z`);
        
        const booked = await db.collection('appointments').find({
            dentistId: new ObjectId(dentistId),
            status: { $in: ['pending', 'confirmed'] },
            startTime: { $gte: startOfDay,$lte: endOfDay }
        }).toArray();
        
        const bookedTimes = booked.map(b => {
            const d = new Date(b.startTime);
            return `${d.getUTCHours().toString().padStart(2, '0')}:${d.getUTCMinutes().toString().padStart(2, '0')}`;
        });
        
        const available = slots.filter(s => !bookedTimes.includes(s));
        res.json({ success: true, data: available });
    } catch (e) { res.status(500).json({ success: false, message: e.message }); }
});

// Book Appointment
app.post('/api/appointments', async (req, res) => {
    try {
        const { patientName, email, phone, serviceId, dentistId, date, time } = req.body || {};
        const cleanName = typeof patientName === 'string' ? patientName.trim() : '';
        const cleanEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';
        const cleanPhone = typeof phone === 'string' ? phone.trim() : '';
        if (cleanName.length < 2 || cleanName.length > 120 || !/^\S+@\S+\.\S+$/.test(cleanEmail) || cleanPhone.length < 7 || cleanPhone.length > 24 || !ObjectId.isValid(String(serviceId || '')) || !ObjectId.isValid(String(dentistId || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(date || '')) || !/^(?:09|1[0-9]):(?:00|30)$/.test(String(time || ''))) return res.status(400).json({ success: false, message: 'Please provide valid patient, service, dentist, date and time details.' });
        const parsedDate = new Date(`${date}T00:00:00Z`);
        const startDateTime = new Date(`${date}T${time}:00Z`);
        if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date || Number.isNaN(startDateTime.getTime()) || startDateTime <= new Date()) return res.status(400).json({ success: false, message: 'Please choose a valid future appointment date and time.' });
        
        const db = await connectDB();

        // Concurrency Check
        const overlapping = await db.collection('appointments').findOne({
            dentistId: new ObjectId(dentistId),
            status: { $in: ['pending', 'confirmed'] },
            startTime: startDateTime
        });
        
        if (overlapping) return res.status(409).json({ success: false, message: 'Slot already booked. Please choose another.' });
        
        const service = await db.collection('services').findOne({ _id: new ObjectId(serviceId), active: true });
        const dentist = await db.collection('dentists').findOne({ _id: new ObjectId(dentistId), active: true });
        if (!service || !dentist) return res.status(400).json({ success: false, message: 'Selected service or dentist is unavailable.' });
        
        // Register/Find Patient
        let patient = await db.collection('patients').findOne({ phone: cleanPhone });
        if (!patient) {
            const pRes = await db.collection('patients').insertOne({ name: cleanName, email: cleanEmail, phone: cleanPhone, createdAt: new Date() });
            patient = { _id: pRes.insertedId };
        }
        
        const ref = 'BK-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const appt = {
            reference: ref, patientId: patient._id, patientName, patientPhone: phone,
            serviceId: service._id, serviceName: service.name, priceSnapshot: service.price,
            dentistId: dentist._id, dentistName: dentist.name,
            startTime: startDateTime,
            status: 'pending', createdAt: new Date()
        };
        
        await db.collection('appointments').insertOne(appt);
        res.json({ success: true, message: 'Appointment Confirmed', data: { reference: ref } });
    } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.post('/api/contact', async (req, res) => {
    try {
        const db = await connectDB();
        await db.collection('contactMessages').insertOne({ ...req.body, createdAt: new Date(), status: 'unread' });
        res.json({ success: true, message: 'Message received.' });
    } catch (e) { res.status(500).json({ success: false }); }
});

// ==========================================
// ADMIN API ROUTES
// ==========================================
app.post('/api/admin/login', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!jwtSecret || jwtSecret.length < 32) return res.status(503).json({ success: false, message: 'Session security is not configured.' });
        if (typeof email !== 'string' || typeof password !== 'string' || !email.trim() || !password) return res.status(400).json({ success: false, message: 'Email and password are required.' });
        const db = await connectDB();
        const admin = await db.collection('admins').findOne({ email, active: true });
        if (!admin || !(await bcrypt.compare(password, admin.password))) return res.status(401).json({ success: false, message: 'Invalid credentials' });
        
        const token = jwt.sign({ adminId: admin._id }, jwtSecret, { expiresIn: '8h' });
        res.cookie('admin_token', token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false, message: 'Server error' }); }
});

app.post('/api/admin/logout', (req, res) => {
    res.clearCookie('admin_token'); res.json({ success: true });
});

app.get('/api/admin/me', requireAdmin, (req, res) => res.json({ success: true }));

app.get('/api/admin/dashboard', requireAdmin, async (req, res) => {
    try {
        const db = await connectDB();
        const [total, pending, confirmed, completed, cancelled, patients] = await Promise.all([
            db.collection('appointments').countDocuments(),
            db.collection('appointments').countDocuments({ status: 'pending' }),
            db.collection('appointments').countDocuments({ status: 'confirmed' }),
            db.collection('appointments').countDocuments({ status: 'completed' }),
            db.collection('appointments').countDocuments({ status: 'cancelled' }),
            db.collection('patients').countDocuments()
        ]);
        res.json({ success: true, data: { totalAppointments: total, pending, confirmed, completed, cancelled, totalPatients: patients } });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/admin/appointments', requireAdmin, async (req, res) => {
    try {
        const db = await connectDB();
        const appts = await db.collection('appointments').find().sort({ startTime: -1 }).limit(50).toArray();
        res.json({ success: true, data: appts });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.patch('/api/admin/appointments/:id/status', requireAdmin, async (req, res) => {
    try {
        const allowedStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];
        if (!ObjectId.isValid(req.params.id) || !allowedStatuses.includes(req.body?.status)) return res.status(400).json({ success: false, message: 'Invalid appointment ID or status.' });
        const db = await connectDB();
        const result = await db.collection('appointments').updateOne({ _id: new ObjectId(req.params.id) }, { $set: { status: req.body.status, updatedAt: new Date() } });
        if (!result.matchedCount) return res.status(404).json({ success: false, message: 'Appointment not found.' });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ success: false }); }
});

app.get('/api/admin/patients', requireAdmin, async (req, res) => {
    try { const db = await connectDB(); const p = await db.collection('patients').find().sort({createdAt: -1}).limit(50).toArray(); res.json({ success: true, data: p }); } catch(e) { res.status(500).json({success:false}); }
});

// ==========================================
// FRONTEND SERVING
// ==========================================
app.get('/admin', (req, res) => res.send(adminHTML));

app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmileCraft Dental Studio | Your Smile, Our Passion</title>
    <meta name="description" content="Premium family and cosmetic dental clinic located in Bahria Town Phase 8, Rawalpindi.">
    <script src="https://unpkg.com/lucide@latest"></script>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap');
        :root { --primary: #8B7CF6; --sky: #71C9F8; --mint: #8BE0C1; --peach: #FFB58A; --coral: #FF8FA3; --bg: #FFF9F2; --text: #25304A; --white: #FFFFFF; }
        * { box-sizing: border-box; margin: 0; padding: 0; scroll-behavior: smooth; }
        body { font-family: 'Inter', sans-serif; background: var(--bg); color: var(--text); overflow-x: hidden; }
        h1, h2, h3, h4 { font-family: 'Plus Jakarta Sans', sans-serif; color: var(--text); }
        
        /* Claymorphism Utilities */
        .clay-card { background: var(--white); border-radius: 24px; padding: 30px; box-shadow: 10px 10px 20px #e6e0d8, -10px -10px 20px #ffffff; transition: transform 0.3s; }
        .clay-card:hover { transform: translateY(-5px); }
        .clay-btn { display: inline-block; background: var(--primary); color: white; border: none; border-radius: 50px; padding: 14px 28px; font-weight: 600; font-size: 1rem; cursor: pointer; text-decoration: none; box-shadow: inset 4px 4px 8px rgba(255,255,255,0.3), inset -4px -4px 8px rgba(0,0,0,0.1), 4px 4px 10px rgba(139,124,246,0.3); transition: all 0.2s; }
        .clay-btn:active { box-shadow: inset 4px 4px 8px rgba(0,0,0,0.2), inset -4px -4px 8px rgba(255,255,255,0.2); transform: scale(0.97); }
        .clay-input { width: 100%; padding: 15px; border: none; border-radius: 16px; background: #f4f5f7; box-shadow: inset 4px 4px 8px #d1d5db, inset -4px -4px 8px #ffffff; font-size: 1rem; margin-bottom: 20px; outline: none; transition: 0.3s; }
        .clay-input:focus { box-shadow: inset 6px 6px 10px #d1d5db, inset -6px -6px 10px #ffffff; }

        /* Layout & Sections */
        nav { position: sticky; top: 0; background: rgba(255, 249, 242, 0.9); backdrop-filter: blur(10px); display: flex; justify-content: space-between; align-items: center; padding: 20px 5%; z-index: 100; }
        .logo { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 1.5rem; font-weight: 800; color: var(--primary); display: flex; align-items: center; gap: 10px; }
        .nav-links { display: flex; gap: 20px; }
        .nav-links a { text-decoration: none; color: var(--text); font-weight: 500; transition: color 0.2s; }
        .nav-links a:hover { color: var(--primary); }
        
        .hero { display: flex; align-items: center; justify-content: space-between; padding: 60px 5%; min-height: 80vh; position: relative; overflow: hidden; }
        .hero-content { max-width: 500px; z-index: 2; }
        .hero h1 { font-size: 3.5rem; line-height: 1.2; margin-bottom: 20px; }
        .hero p { font-size: 1.1rem; margin-bottom: 30px; opacity: 0.8; }
        .hero-shapes { position: absolute; right: 5%; top: 10%; width: 500px; height: 500px; background: radial-gradient(circle, var(--sky) 0%, transparent 70%); opacity: 0.4; border-radius: 50%; z-index: 0; animation: float 6s infinite ease-in-out; }
        @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-20px); } 100% { transform: translateY(0px); } }

        section { padding: 80px 5%; }
        .section-title { text-align: center; font-size: 2.5rem; margin-bottom: 50px; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 40px; }

        /* Booking Modal */
        #booking-modal { position: fixed; inset: 0; background: rgba(37,48,74,0.4); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 1000; opacity: 0; pointer-events: none; transition: 0.3s; }
        #booking-modal.active { opacity: 1; pointer-events: auto; }
        .modal-content { background: var(--bg); border-radius: 32px; padding: 40px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.1); position: relative; }
        .close-modal { position: absolute; top: 20px; right: 20px; background: none; border: none; cursor: pointer; color: var(--text); }
        .step { display: none; animation: fadeIn 0.4s; }
        .step.active { display: block; }
        @keyframes fadeIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        
        .radio-card { display: block; padding: 15px; border-radius: 16px; background: var(--white); margin-bottom: 15px; cursor: pointer; border: 2px solid transparent; box-shadow: 4px 4px 8px #e6e0d8; transition: 0.2s; }
        .radio-card:hover { border-color: var(--mint); }
        input[type="radio"]:checked + .radio-card { border-color: var(--primary); background: #f0f0ff; }
        input[type="radio"] { display: none; }
        
        .time-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 10px; margin-top: 15px; }
        .time-slot { text-align: center; padding: 10px; background: var(--white); border-radius: 12px; cursor: pointer; font-weight: 500; border: 2px solid transparent; }
        .time-slot.selected { border-color: var(--primary); background: var(--primary); color: white; }

        footer { background: var(--text); color: white; padding: 60px 5% 20px; border-top-left-radius: 40px; border-top-right-radius: 40px; text-align: center; }
        
        @media(max-width: 768px) { .nav-links { display: none; } .hero { flex-direction: column; text-align: center; } .hero h1 { font-size: 2.5rem; } }
    </style>
</head>
<body>

    <nav>
        <div class="logo"><i data-lucide="smile" style="color: var(--primary);"></i> SmileCraft</div>
        <div class="nav-links">
            <a href="#services">Services</a>
            <a href="#dentists">Our Dentists</a>
            <a href="#about">About</a>
            <a href="#contact">Contact</a>
        </div>
        <button class="clay-btn" onclick="openBooking()">Book Appointment</button>
    </nav>

    <header class="hero">
        <div class="hero-content">
            <div class="clay-card" style="display:inline-block; padding: 10px 20px; border-radius: 50px; color: var(--primary); font-weight: bold; margin-bottom: 20px;">Modern Dentistry</div>
            <h1>A Healthier Smile Starts Here.</h1>
            <p>Experience comfortable, personalized dental care in a state-of-the-art clinic. We bring confidence to your smile.</p>
            <div style="display: flex; gap: 15px; flex-wrap: wrap;">
                <button class="clay-btn" onclick="openBooking()">Book Your Appointment</button>
                <a href="#services" class="clay-btn" style="background: var(--white); color: var(--text);">Explore Services</a>
            </div>
        </div>
        <div class="hero-shapes"></div>
        <img src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?auto=format&fit=crop&w=600&q=80" alt="Smiling Patient" style="border-radius: 40px; z-index: 2; width: 100%; max-width: 450px; box-shadow: 10px 10px 30px rgba(0,0,0,0.1);">
    </header>

    <section id="services">
        <h2 class="section-title">Our Premium Services</h2>
        <div class="grid" id="services-grid">
            <!-- Populated via API -->
        </div>
    </section>

    <section id="dentists" style="background: var(--white);">
        <h2 class="section-title">Meet Our Specialists</h2>
        <div class="grid" id="dentists-grid">
            <!-- Populated via API -->
        </div>
    </section>

    <!-- Booking Modal -->
    <div id="booking-modal">
        <div class="modal-content">
            <button class="close-modal" onclick="closeBooking()"><i data-lucide="x"></i></button>
            <h2 style="margin-bottom: 20px; color: var(--primary);">Book Appointment</h2>
            
            <form id="booking-form">
                <!-- Step 1: Service -->
                <div class="step active" id="step1">
                    <h3>Select Service</h3>
                    <p style="margin-bottom: 20px; opacity: 0.7;">What do you need help with?</p>
                    <div id="b-services"></div>
                    <button type="button" class="clay-btn" onclick="nextStep(1)" style="margin-top: 20px;">Next Step</button>
                </div>

                <!-- Step 2: Dentist -->
                <div class="step" id="step2">
                    <h3>Select Dentist</h3>
                    <div id="b-dentists" style="margin-top: 20px;"></div>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button type="button" class="clay-btn" style="background: #ccc; color: #333;" onclick="prevStep(2)">Back</button>
                        <button type="button" class="clay-btn" onclick="nextStep(2)">Next Step</button>
                    </div>
                </div>

                <!-- Step 3: Date & Time -->
                <div class="step" id="step3">
                    <h3>Select Date & Time</h3>
                    <input type="date" id="b-date" class="clay-input" style="margin-top: 20px;" min="" onchange="fetchSlots()">
                    <div class="time-grid" id="b-slots"></div>
                    <input type="hidden" id="b-time">
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button type="button" class="clay-btn" style="background: #ccc; color: #333;" onclick="prevStep(3)">Back</button>
                        <button type="button" class="clay-btn" onclick="nextStep(3)">Next Step</button>
                    </div>
                </div>

                <!-- Step 4: Details -->
                <div class="step" id="step4">
                    <h3>Patient Details</h3>
                    <div style="margin-top:20px;">
                        <input type="text" id="b-name" class="clay-input" placeholder="Full Name" required>
                        <input type="email" id="b-email" class="clay-input" placeholder="Email Address" required>
                        <input type="tel" id="b-phone" class="clay-input" placeholder="Phone Number (03xxxxxxxxx)" required>
                    </div>
                    <div style="display:flex; gap:10px; margin-top:20px;">
                        <button type="button" class="clay-btn" style="background: #ccc; color: #333;" onclick="prevStep(4)">Back</button>
                        <button type="submit" class="clay-btn" id="b-submit">Confirm Booking</button>
                    </div>
                </div>

                <!-- Step 5: Success -->
                <div class="step" id="step5" style="text-align: center; padding: 40px 0;">
                    <i data-lucide="check-circle" style="width: 80px; height: 80px; color: var(--mint); margin-bottom: 20px;"></i>
                    <h2>Booking Confirmed!</h2>
                    <p style="margin: 20px 0;">Your reference number is: <strong id="b-ref" style="font-size: 1.2rem; color: var(--primary);"></strong></p>
                    <button type="button" class="clay-btn" onclick="closeBooking()">Back to Home</button>
                </div>
            </form>
        </div>
    </div>

    <footer>
        <h2>SmileCraft Dental Studio</h2>
        <p>Bahria Town Phase 8, Rawalpindi, Pakistan</p>
        <p style="margin-top: 20px; opacity: 0.6;">© 2026 SmileCraft. Demo Project.</p>
    </footer>

    <script>
        lucide.createIcons();

        // Set min date for date picker
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('b-date').min = today;

        let selectedService = '';
        let selectedDentist = '';
        let selectedTime = '';

        async function init() {
            // Load Services
            const sRes = await fetch('/api/services').then(r => { if (!r.ok) throw new Error('Services are temporarily unavailable. Please try again shortly.'); return r.json(); }).catch(() => ({ success: false, message: 'Services could not be loaded. Check the database connection and try again.' }));
            if (sRes.success) {
                document.getElementById('services-grid').innerHTML = sRes.data.map(s => 
                    \`<div class="clay-card">
                        <i data-lucide="activity" style="color: var(--mint); width:40px; height:40px;"></i>
                        <h3 style="margin: 15px 0;">\${s.name}</h3>
                        <p>\${s.description}</p>
                        <p style="font-weight: bold; margin-top: 15px; color: var(--primary);">PKR \${s.price.toLocaleString()}</p>
                        <button class="clay-btn" style="margin-top: 15px; width: 100%;" onclick="openBooking('\${s._id}')">Book This</button>
                    </div>\`
                ).join('');
                document.getElementById('b-services').innerHTML = sRes.data.map(s => 
                    \`<label>
                        <input type="radio" name="service" value="\${s._id}">
                        <div class="radio-card">\${s.name} - PKR \${s.price.toLocaleString()}</div>
                    </label>\`
                ).join('');
            } else {
                const message = sRes.message || 'Services are temporarily unavailable.';
                document.getElementById('services-grid').innerHTML = \`<div class="clay-card" role="status"><h3>Services temporarily unavailable</h3><p style="margin-top:10px;">\${message}</p><button class="clay-btn" style="margin-top:16px;" onclick="init()">Try again</button></div>\`;
                document.getElementById('b-services').innerHTML = \`<p role="status">\${message}</p>\`;
            }

            // Load Dentists
            const dRes = await fetch('/api/dentists').then(r => { if (!r.ok) throw new Error('Dentists are temporarily unavailable. Please try again shortly.'); return r.json(); }).catch(() => ({ success: false, message: 'Dentist information could not be loaded. Check the database connection and try again.' }));
            if (dRes.success) {
                document.getElementById('dentists-grid').innerHTML = dRes.data.map(d => 
                    \`<div class="clay-card" style="text-align:center;">
                        <div style="width:100px; height:100px; background:var(--primary); border-radius:50%; margin:0 auto 15px; display:flex; align-items:center; justify-content:center; color:white;"><i data-lucide="user" style="width:50px; height:50px;"></i></div>
                        <h3>\${d.name}</h3>
                        <p style="color: var(--mint); font-weight: 500;">\${d.specialty}</p>
                    </div>\`
                ).join('');
                document.getElementById('b-dentists').innerHTML = dRes.data.map(d => 
                    \`<label>
                        <input type="radio" name="dentist" value="\${d._id}">
                        <div class="radio-card">\${d.name} (\${d.specialty})</div>
                    </label>\`
                ).join('');
            } else {
                const message = dRes.message || 'Dentist information is temporarily unavailable.';
                document.getElementById('dentists-grid').innerHTML = \`<div class="clay-card" role="status"><h3>Our specialists are temporarily unavailable</h3><p style="margin-top:10px;">\${message}</p><button class="clay-btn" style="margin-top:16px;" onclick="init()">Try again</button></div>\`;
                document.getElementById('b-dentists').innerHTML = \`<p role="status">\${message}</p>\`;
            }
            lucide.createIcons();
        }

        function openBooking(preselectService = null) {
            document.getElementById('booking-modal').classList.add('active');
            if (preselectService) {
                const radio = document.querySelector(\`input[name="service"][value="\${preselectService}"]\`);
                if(radio) radio.checked = true;
            }
        }
        function closeBooking() { document.getElementById('booking-modal').classList.remove('active'); setTimeout(()=> { document.querySelectorAll('.step').forEach(s => s.classList.remove('active')); document.getElementById('step1').classList.add('active'); document.getElementById('booking-form').reset(); }, 300); }

        function nextStep(current) {
            if (current === 1) {
                const s = document.querySelector('input[name="service"]:checked');
                if (!s) return alert('Please select a service');
                selectedService = s.value;
            }
            if (current === 2) {
                const d = document.querySelector('input[name="dentist"]:checked');
                if (!d) return alert('Please select a dentist');
                selectedDentist = d.value;
            }
            if (current === 3) {
                if (!document.getElementById('b-date').value || !document.getElementById('b-time').value) return alert('Please select date and time');
            }
            document.getElementById(\`step\${current}\`).classList.remove('active');
            document.getElementById(\`step\${current+1}\`).classList.add('active');
        }

        function prevStep(current) {
            document.getElementById(\`step\${current}\`).classList.remove('active');
            document.getElementById(\`step\${current-1}\`).classList.add('active');
        }

        async function fetchSlots() {
            const date = document.getElementById('b-date').value;
            if(!date || !selectedDentist) return;
            const res = await fetch(\`/api/availability?date=\${date}&dentistId=\${selectedDentist}\`).then(r => r.json());
            if (res.success) {
                const container = document.getElementById('b-slots');
                container.innerHTML = res.data.length ? res.data.map(t => \`<div class="time-slot" onclick="selectTime(this, '\${t}')">\${t}</div>\`).join('') : '<p>No slots available on this date.</p>';
            }
        }

        function selectTime(el, time) {
            document.querySelectorAll('.time-slot').forEach(n => n.classList.remove('selected'));
            el.classList.add('selected');
            document.getElementById('b-time').value = time;
        }

        document.getElementById('booking-form').onsubmit = async (e) => {
            e.preventDefault();
            const btn = document.getElementById('b-submit'); btn.innerText = 'Processing...'; btn.disabled = true;
            
            const payload = {
                serviceId: selectedService, dentistId: selectedDentist,
                date: document.getElementById('b-date').value, time: document.getElementById('b-time').value,
                patientName: document.getElementById('b-name').value, email: document.getElementById('b-email').value, phone: document.getElementById('b-phone').value
            };
            
            const res = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then(r => r.json());
            
            btn.innerText = 'Confirm Booking'; btn.disabled = false;
            if (res.success) {
                document.getElementById('step4').classList.remove('active');
                document.getElementById('step5').classList.add('active');
                document.getElementById('b-ref').innerText = res.data.reference;
            } else { alert(res.message || 'Error occurred'); }
        };

        init();
    </script>
</body>
</html>`);
});

// Vercel Serverless Export / Local Fallback
if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => console.log(`SmileCraft Server running on port ${PORT}`));
}
module.exports = app;
