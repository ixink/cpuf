const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const { nanoid } = require('nanoid');
const { LowSync, JSONFileSync } = require('lowdb');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.static('public'));

// Database Setup
const adapter = new JSONFileSync('db.json');
const db = new LowSync(adapter, {
  news: [],
  events: [],
  resources: [],
  joinEvents: [],
  registrations: [],
  admins: [],
  polls: [],
  donations: [],
  settings: { logo: null }
});

// Initialize DB
db.read();
db.write();

// Initialize Admin User
async function initAdmin() {
  db.read();
  const adminExists = db.data.admins.some(admin => admin.username === 'admin');
  if (!adminExists) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    db.data.admins.push({
      id: nanoid(),
      username: 'admin',
      password: hashedPassword
    });
    db.write();
  }
}
initAdmin();

// File Upload Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    if (file.fieldname === 'logo') {
      uploadPath = 'public/uploads/logos/';
    } else if (file.fieldname === 'image') {
      uploadPath = 'public/uploads/images/';
    } else if (file.fieldname === 'pdf') {
      uploadPath = 'public/uploads/pdfs/';
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    cb(null, `${nanoid()}${path.extname(file.originalname)}`);
  }
});
const upload = multer({ storage });

// Middleware to Verify JWT
function authenticateToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
}

// API Endpoints
// Admin Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  db.read();
  const admin = db.data.admins.find(admin => admin.username === username);
  if (!admin) return res.status(401).json({ error: 'Invalid credentials' });
  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: admin.id, username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Settings (Logo)
app.get('/api/settings', (req, res) => {
  db.read();
  res.json(db.data.settings);
});

app.post('/api/settings/logo', authenticateToken, upload.single('logo'), async (req, res) => {
  db.read();
  let logoPath = req.body.logoUrl || db.data.settings.logo;
  if (req.file) {
    logoPath = `/uploads/logos/${req.file.filename}`;
  }
  db.data.settings.logo = logoPath;
  db.write();
  res.json({ logo: logoPath });
});

// News
app.get('/api/news', (req, res) => {
  db.read();
  res.json(db.data.news);
});

app.post('/api/news', authenticateToken, upload.single('image'), async (req, res) => {
  const { title, date, description, imageUrl } = req.body;
  let imagePath = imageUrl;
  if (req.file) {
    imagePath = `/uploads/images/${req.file.filename}`;
  }
  db.read();
  db.data.news.push({ id: nanoid(), title, date, description, image: imagePath });
  db.write();
  res.status(201).json({ message: 'News added' });
});

app.put('/api/news/:id', authenticateToken, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, date, description, imageUrl } = req.body;
  db.read();
  const news = db.data.news.find(n => n.id === id);
  if (!news) return res.status(404).json({ error: 'News not found' });
  let imagePath = imageUrl || news.image;
  if (req.file) {
    imagePath = `/uploads/images/${req.file.filename}`;
  }
  news.title = title;
  news.date = date;
  news.description = description;
  news.image = imagePath;
  db.write();
  res.json({ message: 'News updated' });
});

app.delete('/api/news/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.read();
  db.data.news = db.data.news.filter(n => n.id !== id);
  db.write();
  res.json({ message: 'News deleted' });
});

// Events
app.get('/api/events', (req, res) => {
  db.read();
  const now = new Date();
  const events = {
    running: db.data.events.filter(e => new Date(e.date) <= now && new Date(e.date).setDate(new Date(e.date).getDate() + 1) >= now),
    upcoming: db.data.events.filter(e => new Date(e.date) > now),
    past: db.data.events.filter(e => new Date(e.date) < now)
  };
  res.json(events);
});

app.post('/api/events', authenticateToken, upload.single('image'), async (req, res) => {
  const { title, date, description, imageUrl } = req.body;
  let imagePath = imageUrl;
  if (req.file) {
    imagePath = `/uploads/images/${req.file.filename}`;
  }
  db.read();
  db.data.events.push({ id: nanoid(), title, date, description, image: imagePath });
  db.write();
  res.status(201).json({ message: 'Event added' });
});

app.put('/api/events/:id', authenticateToken, upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const { title, date, description, imageUrl } = req.body;
  db.read();
  const event = db.data.events.find(e => e.id === id);
  if (!event) return res.status(404).json({ error: 'Event not found' });
  let imagePath = imageUrl || event.image;
  if (req.file) {
    imagePath = `/uploads/images/${req.file.filename}`;
  }
  event.title = title;
  event.date = date;
  event.description = description;
  event.image = imagePath;
  db.write();
  res.json({ message: 'Event updated' });
});

app.delete('/api/events/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.read();
  db.data.events = db.data.events.filter(e => e.id !== id);
  db.write();
  res.json({ message: 'Event deleted' });
});

// Resources
app.get('/api/resources', (req, res) => {
  db.read();
  res.json(db.data.resources);
});

app.post('/api/resources', authenticateToken, upload.single('pdf'), async (req, res) => {
  const { title, description, pdfUrl } = req.body;
  let pdfPath = pdfUrl;
  if (req.file) {
    pdfPath = `/uploads/pdfs/${req.file.filename}`;
  }
  db.read();
  db.data.resources.push({ id: nanoid(), title, description, pdf: pdfPath });
  db.write();
  res.status(201).json({ message: 'Resource added' });
});

app.put('/api/resources/:id', authenticateToken, upload.single('pdf'), async (req, res) => {
  const { id } = req.params;
  const { title, description, pdfUrl } = req.body;
  db.read();
  const resource = db.data.resources.find(r => r.id === id);
  if (!resource) return res.status(404).json({ error: 'Resource not found' });
  let pdfPath = pdfUrl || resource.pdf;
  if (req.file) {
    pdfPath = `/uploads/pdfs/${req.file.filename}`;
  }
  resource.title = title;
  resource.description = description;
  resource.pdf = pdfPath;
  db.write();
  res.json({ message: 'Resource updated' });
});

app.delete('/api/resources/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.read();
  db.data.resources = db.data.resources.filter(r => r.id !== id);
  db.write();
  res.json({ message: 'Resource deleted' });
});

// Polls
app.get('/api/polls', (req, res) => {
  db.read();
  res.json(db.data.polls);
});

app.post('/api/polls', authenticateToken, (req, res) => {
  const { question, options } = req.body;
  if (!question || !options || options.length < 2) {
    return res.status(400).json({ error: 'Question and at least two options required' });
  }
  db.read();
  const votes = {};
  options.forEach(opt => { votes[opt] = 0; });
  db.data.polls.push({ id: nanoid(), question, options, votes });
  db.write();
  res.status(201).json({ message: 'Poll added' });
});

app.put('/api/polls/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { question, options } = req.body;
  if (!question || !options || options.length < 2) {
    return res.status(400).json({ error: 'Question and at least two options required' });
  }
  db.read();
  const poll = db.data.polls.find(p => p.id === id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  const votes = {};
  options.forEach(opt => { votes[opt] = poll.votes[opt] || 0; });
  poll.question = question;
  poll.options = options;
  poll.votes = votes;
  db.write();
  res.json({ message: 'Poll updated' });
});

app.delete('/api/polls/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  db.read();
  db.data.polls = db.data.polls.filter(p => p.id !== id);
  db.write();
  res.json({ message: 'Poll deleted' });
});

app.post('/api/polls/:id/vote', (req, res) => {
  const { id } = req.params;
  const { candidate } = req.body;
  db.read();
  const poll = db.data.polls.find(p => p.id === id);
  if (!poll) return res.status(404).json({ error: 'Poll not found' });
  if (!poll.options.includes(candidate)) return res.status(400).json({ error: 'Invalid candidate' });
  poll.votes[candidate]++;
  db.write();
  res.json({ message: 'Vote recorded', votes: poll.votes });
});

// Registrations
app.post('/api/register', (req, res) => {
  const { name, email, phone, idNumber, university } = req.body;
  db.read();
  db.data.registrations.push({ id: nanoid(), name, email, phone, idNumber, university });
  db.write();
  res.status(201).json({ message: 'Registration successful' });
});

app.get('/api/registrations', authenticateToken, (req, res) => {
  db.read();
  res.json(db.data.registrations);
});

// Donations
app.post('/api/donations', (req, res) => {
  const { phone, transactionId } = req.body;
  db.read();
  db.data.donations.push({ id: nanoid(), phone: phone || 'Anonymous', transactionId, timestamp: new Date().toISOString() });
  db.write();
  res.status(201).json({ message: 'Donation recorded' });
});

app.get('/api/donations', authenticateToken, (req, res) => {
  db.read();
  res.json(db.data.donations);
});

// Join Events
app.post('/api/join-event', (req, res) => {
  const { eventId, name, email, phone } = req.body;
  db.read();
  db.data.joinEvents.push({ id: nanoid(), eventId, name, email, phone });
  db.write();
  res.status(201).json({ message: 'Event joined' });
});

app.get('/api/join-events', authenticateToken, (req, res) => {
  db.read();
  res.json(db.data.joinEvents);
});

// Analytics
app.get('/api/analytics', authenticateToken, (req, res) => {
  db.read();
  const analytics = {
    totalMembers: db.data.registrations.length,
    totalEventJoins: db.data.joinEvents.length,
    totalDonations: db.data.donations.length,
    totalVotes: db.data.polls.reduce((sum, poll) => sum + Object.values(poll.votes).reduce((a, b) => a + b, 0), 0),
    eventJoinBreakdown: db.data.joinEvents.reduce((acc, join) => {
      acc[join.eventId] = (acc[join.eventId] || 0) + 1;
      return acc;
    }, {})
  };
  res.json(analytics);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));