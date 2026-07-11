require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const validator = require('validator');
const xss = require('xss');
const { createClient } = require('@supabase/supabase-js');
const Groq   = require('groq-sdk');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const app = express();

// ─── CORS Configuration (Whitelist specific origins) ──────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin || allowedOrigins.some(allowed => {
      const normalizedOrigin = origin?.trim();
      const normalizedAllowed = allowed.trim();
      return normalizedOrigin === normalizedAllowed;
    })) {
      callback(null, true);
    } else {
      // In development, log but don't reject
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`⚠️  CORS request from ${origin} (allowed: ${allowedOrigins.join(', ')})`);
        callback(null, true); // Allow in development
      } else {
        callback(new Error('CORS not allowed'));
      }
    }
  },
  credentials: true
}));
app.use(express.json({ limit: '10kb' }));

// ─── Rate Limiting (Prevent abuse) ──────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  handler: (req, res) => res.status(429).json({ error: 'Too many requests from this IP, please try again later.' })
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 login attempts per 15 min
  skipSuccessfulRequests: true,
  handler: (req, res) => res.status(429).json({ error: 'Too many login attempts, please try again later.' })
});
const chatLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 messages per minute
  handler: (req, res) => res.status(429).json({ error: 'Messaging rate limited. Please wait before sending another message.' })
});

app.use('/api/', limiter);
app.use('/api/auth/', authLimiter);
app.use('/api/chat/', chatLimiter);

// ─── Supabase Client (single — anon key works for everything) ─────────────
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// ─── Groq Client ──────────────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

// ─── JWT Secret ───────────────────────────────────────────────────────────
const JWT_SECRET = process.env.JWT_SECRET || 'pixelforge-super-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

// ─── Input Validation Helper ──────────────────────────────────────────────
function validateEmail(email) {
  if (!email || !validator.isEmail(email)) {
    throw new Error('Invalid email address');
  }
  return validator.normalizeEmail(email);
}

function validatePassword(password) {
  if (!password || password.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  if (!/[A-Z]/.test(password)) {
    throw new Error('Password must contain an uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    throw new Error('Password must contain a number');
  }
  return password;
}

function sanitizeInput(input) {
  if (typeof input !== 'string') return input;
  return xss(input.trim(), { whiteList: {}, stripIgnoredTag: true });
}

// ─── Agency System Prompt ─────────────────────────────────────────────────
const AGENCY_SYSTEM_PROMPT = `You are Nova, an AI sales assistant for PixelForge Agency — a premium digital agency specializing in:

🎨 UI/UX Design — Beautiful, user-centric interfaces
💻 Web Development — Fast, scalable websites and web apps
📱 Mobile App Development — iOS and Android applications
📊 Digital Marketing — SEO, Social Media, PPC Campaigns
🎬 Video & Motion Graphics — Brand videos, animations
🛒 E-commerce Solutions — Complete online store setups

Your job is to:
1. Warmly greet clients and understand their business needs
2. Pitch PixelForge services based on what they need
3. Highlight our competitive pricing and quality
4. Collect their contact info (name, email, phone, business name)
5. Book a free consultation call

Pricing:
- Basic Website: $500–$1500
- Custom Web App: $2000–$8000
- Mobile App: $3000–$12000
- Marketing Package: $300–$1500/mo
- Logo & Branding: $200–$800

Always be friendly, professional, and persuasive. Keep responses concise and engaging.

Keep trying to get details which is email and phone number or atleast anyone of them of the user so that it can convert into hot leads.`;

// ═══════════════════════════════════════════════════════════════════════════
// AUTH MIDDLEWARE — Admin JWT Guard
// ═══════════════════════════════════════════════════════════════════════════
async function requireAdminAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token. Please login.' });
    }
    const token = authHeader.split(' ')[1];

    // Check fallback .env token first
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      if (decoded.includes(':pixelforge-admin')) {
        const [tokenEmail] = decoded.split(':');
        if (tokenEmail === process.env.ADMIN_EMAIL) {
          req.user = { id: 'env-admin', email: tokenEmail };
          return next();
        }
      }
    } catch (_) {}

    // Try Supabase JWT
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Auth check failed' });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/health', (req, res) => {
  res.json({ status: 'PixelForge API running 🚀', timestamp: new Date() });
});

// ─── Client Register ───────────────────────────────────────────────────────
app.post('/api/auth/register', async (req, res) => {
  try {
    let { email, password, name } = req.body;
    
    // Validate inputs
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Name, email and password required' });
    }

    // Sanitize & validate
    try {
      email = validateEmail(email);
      password = validatePassword(password);
      name = sanitizeInput(name);
    } catch (validationErr) {
      return res.status(400).json({ error: validationErr.message });
    }

    if (name.length < 2 || name.length > 100) {
      return res.status(400).json({ error: 'Name must be between 2-100 characters' });
    }

    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: name, role: 'client' } }
    });
    if (error) throw error;
    res.json({ success: true, message: 'Account created! You can now login.' });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(400).json({ error: err.message || 'Registration failed' });
  }
});

// ─── Client Login ──────────────────────────────────────────────────────────
app.post('/api/auth/login', async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    // Validate email format (don't validate password strength on login)
    try {
      email = validateEmail(email);
    } catch (validationErr) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({
      success: true,
      token: data.session.access_token,
      user: {
        id:    data.user.id,
        email: data.user.email,
        name:  data.user.user_metadata?.full_name || 'Client'
      }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

// ─── Admin Login ───────────────────────────────────────────────────────────
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required' });

    // Fallback: match .env credentials directly
    if (email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      const token = Buffer.from(`${email}:${Date.now()}:pixelforge-admin`).toString('base64');
      return res.json({ success: true, token, admin: { id: 'env-admin', email, name: 'Admin' } });
    }

    // Try Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    res.json({
      success: true,
      token: data.session.access_token,
      admin: { id: data.user.id, email: data.user.email, name: 'Admin' }
    });
  } catch (err) {
    res.status(401).json({ error: 'Invalid email or password' });
  }
});

// ─── Chat Session ──────────────────────────────────────────────────────────
app.post('/api/chat/session', async (req, res) => {
  try {
    const sessionId = uuidv4();

    const { data, error } = await supabase
      .from('conversations')
      .insert([{
        session_id:    sessionId,
        client_name:   null,
        client_email:  null,
        client_phone:  null,
        business_name: null,
        status:        'active',
        created_at:    new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;
    res.json({ sessionId, conversationId: data.id });
  } catch (err) {
    console.error('Session error:', err);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// ─── Chat Message ──────────────────────────────────────────────────────────
app.post('/api/chat/message', async (req, res) => {
  try {
    const { sessionId, message, conversationHistory } = req.body;
    if (!sessionId || !message)
      return res.status(400).json({ error: 'sessionId and message required' });

    // Validate sessionId format (UUID)
    if (!validator.isUUID(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    // Sanitize message input
    const sanitizedMessage = sanitizeInput(message);
    
    if (sanitizedMessage.length === 0 || sanitizedMessage.length > 5000) {
      return res.status(400).json({ error: 'Message must be 1-5000 characters' });
    }

    // Sanitize conversation history
    const cleanHistory = (conversationHistory || []).map(msg => ({
      role: ['user', 'assistant'].includes(msg.role) ? msg.role : 'user',
      content: sanitizeInput(msg.content || '').substring(0, 5000)
    }));

    const messages = [
      { role: 'system', content: AGENCY_SYSTEM_PROMPT },
      ...cleanHistory,
      { role: 'user', content: sanitizedMessage }
    ];

    const completion = await groq.chat.completions.create({
      model: GROQ_MODEL,
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const aiResponse = completion.choices[0].message.content;

    // Save to Supabase (don't block response on save errors)
    supabase.from('messages').insert([
      { session_id: sessionId, role: 'user',      content: sanitizedMessage, created_at: new Date().toISOString() },
      { session_id: sessionId, role: 'assistant', content: aiResponse, created_at: new Date().toISOString() }
    ]).then(({ error }) => { if (error) console.error('Msg save error:', error.message); });

    supabase.from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('session_id', sessionId)
      .then(() => {});

    extractClientInfo(sessionId, sanitizedMessage);

    res.json({ reply: aiResponse });
  } catch (err) {
    console.error('Chat error:', err.message);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

// Extract client contact info from message
function extractClientInfo(sessionId, msg) {
  try {
    const emailMatch = msg.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const phoneMatch = msg.match(/(\+?[\d\s\-().]{10,})/);
    const nameMatch  = msg.match(/(?:i'm|my name is|i am|call me)\s+([A-Za-z]+)/i);
    const update = {};
    if (emailMatch) update.client_email = emailMatch[0];
    if (phoneMatch) update.client_phone = phoneMatch[0].trim();
    if (nameMatch)  update.client_name  = nameMatch[1];
    if (Object.keys(update).length > 0) {
      supabase.from('conversations').update(update).eq('session_id', sessionId).then(() => {});
    }
  } catch (_) {}
}

// ═══════════════════════════════════════════════════════════════════════════
// PROTECTED ADMIN ROUTES
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/admin/conversations', requireAdminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('conversations').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ conversations: data });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch conversations' }); }
});

app.get('/api/admin/conversations/:sessionId/messages', requireAdminAuth, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('messages').select('*')
      .eq('session_id', req.params.sessionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    res.json({ messages: data });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch messages' }); }
});

app.put('/api/admin/conversations/:sessionId/status', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { status } = req.body;

    // Validate sessionId
    if (!validator.isUUID(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    // Validate status
    const validStatuses = ['active', 'closed', 'pending'];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ error: `Status must be one of: ${validStatuses.join(', ')}` });
    }

    const { error } = await supabase
      .from('conversations').update({ status })
      .eq('session_id', sessionId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: 'Failed to update status' }); }
});

app.put('/api/admin/conversations/:sessionId/client', requireAdminAuth, async (req, res) => {
  try {
    const { sessionId } = req.params;
    let { client_name, client_email, client_phone, business_name } = req.body;

    // Validate sessionId
    if (!validator.isUUID(sessionId)) {
      return res.status(400).json({ error: 'Invalid sessionId' });
    }

    // Sanitize and validate inputs
    const update = {};
    if (client_name !== undefined) {
      client_name = sanitizeInput(client_name);
      if (client_name && (client_name.length < 2 || client_name.length > 100)) {
        return res.status(400).json({ error: 'Name must be 2-100 characters' });
      }
      update.client_name = client_name || null;
    }

    if (client_email !== undefined) {
      client_email = sanitizeInput(client_email);
      if (client_email && !validator.isEmail(client_email)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      update.client_email = client_email || null;
    }

    if (client_phone !== undefined) {
      client_phone = sanitizeInput(client_phone);
      if (client_phone && client_phone.length > 50) {
        return res.status(400).json({ error: 'Phone too long' });
      }
      update.client_phone = client_phone || null;
    }

    if (business_name !== undefined) {
      business_name = sanitizeInput(business_name);
      if (business_name && business_name.length > 150) {
        return res.status(400).json({ error: 'Business name too long' });
      }
      update.business_name = business_name || null;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    const { error } = await supabase.from('conversations')
      .update(update)
      .eq('session_id', sessionId);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) { 
    console.error('Client update error:', err.message);
    res.status(500).json({ error: 'Failed to update client info' }); 
  }
});

app.delete('/api/admin/conversations/:sessionId', requireAdminAuth, async (req, res) => {
  try {
    // Due to ON DELETE CASCADE on the foreign key, deleting the conversation 
    // should also delete associated messages.
    const { error } = await supabase
      .from('conversations')
      .delete()
      .eq('session_id', req.params.sessionId);
    if (error) throw error;
    res.json({ success: true, message: 'Conversation deleted successfully' });
  } catch (err) { res.status(500).json({ error: 'Failed to delete conversation' }); }
});

app.get('/api/admin/stats', requireAdminAuth, async (req, res) => {
  try {
    const { data: convs }  = await supabase.from('conversations').select('*');
    const { data: msgs }   = await supabase.from('messages').select('id');
    res.json({
      total_conversations:  convs?.length || 0,
      active_conversations: convs?.filter(c => c.status === 'active').length || 0,
      qualified_leads:      convs?.filter(c => c.client_email || c.client_phone).length || 0,
      closed_deals:         convs?.filter(c => c.status === 'closed').length || 0,
      total_messages:       msgs?.length  || 0
    });
  } catch (err) { res.status(500).json({ error: 'Failed to fetch stats' }); }
});

// ─── Start Server ──────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 PixelForge Agency Chatbot API`);
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`🔐 Admin Email: ${process.env.ADMIN_EMAIL}`);
  console.log(`🤖 Groq AI: llama-3.3-70b-versatile`);
  console.log(`🗄️  Supabase: ${process.env.SUPABASE_URL}\n`);
});
