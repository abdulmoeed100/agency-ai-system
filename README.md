# 🚀 PixelForge Agency Chatbot — Enterprise AI Sales Platform

Professional AI-powered lead generation chatbot with Groq AI, Supabase backend, and admin dashboard.

**Status:** ✅ Production Ready | **Version:** 1.0.0

---

## ✨ Key Features

### 🎯 Client-Facing Chatbot (index.html)
- **AI-Powered Sales** - Groq LLaMA 3.3 70B model for intelligent, context-aware responses
- **Lead Auto-Capture** - Extracts email, phone, name directly from conversation
- **100% Responsive** - Works perfectly on desktop, tablet, mobile
- **Quick Prompts** - Suggested questions to guide conversations  
- **Real-time Chat** - Instant AI responses with typing indicator
- **User Authentication** - Optional login/registration system
- **Conversation Memory** - Maintains full context across sessions

### 👨‍💼 Admin Dashboard (admin.html)
- **Live Statistics** - Active conversations, qualified leads, message counts, conversion metrics
- **Lead Management** - View, search, filter, and manually edit customer data
- **Conversation History** - Full message thread for each session
- **Status Tracking** - Mark conversations (active/pending/closed)
- **Bulk Updates** - Update multiple conversations at once
- **Real-time Sync** - Auto-refreshes every 30 seconds
- **Data Export** - CSV/Excel export for leads and conversations

### 🔐 Security & Compliance
- ✅ **Input Validation** - Email format, password strength, message length checks
- ✅ **XSS Protection** - Automatic HTML sanitization with XSS library
- ✅ **Rate Limiting** - Prevents spam (100 req/min global, 10 msg/min per user)
- ✅ **CORS Locked Down** - Whitelist specific origins only
- ✅ **JWT Authentication** - Secure admin sessions with expiration
- ✅ **Encrypted Credentials** - Environment-based config, no hardcoded secrets
- ✅ **Password Requirements** - Minimum 8 characters, uppercase, numbers

---

## 🛠️ Tech Stack

| Component | Technology |
|-----------|-----------|
| **Frontend** | HTML5, CSS3, Vanilla JavaScript (no build required!) |
| **Backend** | Node.js 18+, Express.js 4.18+ |
| **AI Engine** | Groq API (LLaMA 3.3 70B Versatile) |
| **Database** | Supabase (PostgreSQL with row-level security) |
| **Authentication** | Supabase Auth + JWT tokens |
| **Security** | validator.js, xss, express-rate-limit |
| **Deployment** | Docker-ready, scales to serverless |

---

## 📋 Quick Start (5 minutes)

### Prerequisites
- ✅ **Node.js 18+** — [Download](https://nodejs.org/)
- ✅ **Supabase Account** — [Free Sign Up](https://supabase.com/)
- ✅ **Groq API Key** — [Free API Key](https://console.groq.com/keys)

### Step 1: Clone & Install

```bash
git clone <your-repo-url>
cd agency-chatbot/backend
npm install
```

### Step 2: Configure Environment

```bash
cp .env.example .env
nano .env  # Edit with your credentials
```

Required secrets:
```env
GROQ_API_KEY=gsk_your_key_here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
ADMIN_EMAIL=admin@pixelforge.com
ADMIN_PASSWORD=ChangeMe123!
```

### Step 3: Start Backend

```bash
npm start
```

Output should be:
```
🚀 PixelForge Agency Chatbot API
✅ Server running on http://localhost:3001
```

### Step 4: Start Frontend (new terminal)

```bash
cd frontend
node server.js
```

### Step 5: Access App

- **Chatbot Client:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin.html
- **Login:** admin@pixelforge.com / ChangeMe123!

---

## 📚 API Documentation

### Public Endpoints

```bash
# Create chat session
POST /api/chat/session
# Response: { "sessionId": "uuid", "conversationId": 1 }

# Send message & get AI reply
POST /api/chat/message
# Body: { "sessionId": "uuid", "message": "...", "conversationHistory": [] }
# Response: { "reply": "AI response..." }

# Health check
GET /api/health
# Response: { "status": "PixelForge API running 🚀" }
```

### Admin Endpoints (requires Authorization header)

```bash
# Admin login
POST /api/admin/login
# Body: { "email": "admin@...", "password": "..." }
# Response: { "success": true, "token": "jwt_token", "admin": {...} }

# Get dashboard stats
GET /api/admin/stats
# Headers: Authorization: Bearer {token}
# Response: { "total_conversations": 42, "qualified_leads": 28, ... }

# List all conversations
GET /api/admin/conversations
# Headers: Authorization: Bearer {token}

# Get conversation messages
GET /api/admin/conversations/:sessionId/messages
# Headers: Authorization: Bearer {token}

# Update conversation status
PUT /api/admin/conversations/:sessionId/status
# Body: { "status": "active|pending|closed" }

# Update client info
PUT /api/admin/conversations/:sessionId/client
# Body: { "client_name": "...", "client_email": "...", "client_phone": "...", "business_name": "..." }

# Delete conversation
DELETE /api/admin/conversations/:sessionId
```

---

## 🗄️ Database Schema

Created automatically via `supabase_schema.sql`:

```sql
-- Conversations (client sessions)
CREATE TABLE conversations (
  id BIGINT PRIMARY KEY,
  session_id UUID UNIQUE,
  client_name TEXT,
  client_email TEXT,
  client_phone TEXT,
  business_name TEXT,
  status TEXT DEFAULT 'active', -- active, pending, closed
  created_at TIMESTAMP,
  last_message_at TIMESTAMP
);

-- Messages (full chat history)
CREATE TABLE messages (
  id BIGINT PRIMARY KEY,
  session_id UUID,
  role TEXT, -- 'user' or 'assistant'
  content TEXT,
  created_at TIMESTAMP
);
```

---

## 📁 Project Structure

```
agency-chatbot/
├── backend/
│   ├── server.js              # Express API + Groq integration
│   ├── package.json           # Dependencies (with security packages)
│   ├── .env                   # SECRETS (never commit!)
│   ├── .env.example           # Template for .env
│   └── node_modules/
├── frontend/
│   ├── index.html             # Chatbot UI
│   ├── login.html             # Auth page
│   ├── admin.html             # Admin dashboard
│   ├── server.js              # Static file server
│   ├── js/
│   │   ├── chat.js            # Chat logic + error handling
│   │   └── admin.js           # Admin logic + auth
│   └── css/
│       └── style.css          # Responsive styles (mobile-first)
├── supabase_schema.sql        # Database initialization
├── .gitignore                 # Exclude .env, node_modules
└── README.md                  # This file
```

---

## 🚢 Production Deployment

### Pre-Deployment Checklist

- [ ] Change all API keys to production values in `.env`
- [ ] Generate new `ADMIN_PASSWORD` (strong: 12+ chars, mixed case, numbers, symbols)
- [ ] Set `NODE_ENV=production`
- [ ] Configure `ALLOWED_ORIGINS` for your domain(s)
- [ ] Enable HTTPS (SSL/TLS certificates)
- [ ] Test all endpoints with curl
- [ ] Set up database backups (Supabase auto-backups)
- [ ] Configure error monitoring (Sentry, DataDog)
- [ ] Set up logging aggregation
- [ ] Test rate limiting under load
- [ ] Review security settings in Supabase console

### Environment Variables (Production)

```env
NODE_ENV=production
PORT=3001
FRONTEND_URL=https://yourdomain.com
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com

# Generate new keys in Supabase for production
GROQ_API_KEY=gsk_prod_key_here
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=prod_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=prod_service_key_here

# Strong password (12+ chars, mixed case, numbers, symbols)
ADMIN_PASSWORD=Pr0d!P@ssw0rd#2024
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app

# Copy backend only
COPY backend/ ./

# Install production dependencies
RUN npm ci --only=production

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/api/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Start server
CMD ["node", "server.js"]
```

Deploy:
```bash
docker build -t pixelforge-chatbot:1.0 .
docker run -p 3001:3001 \
  --env-file .env \
  --restart unless-stopped \
  pixelforge-chatbot:1.0
```

### Hosting Options

| Provider | Best For | Tier |
|----------|----------|------|
| **Heroku** | Quick deployment | Free → $50/mo |
| **Railway** | Modern DevOps | Free → $10/mo |
| **Vercel + Backend** | Serverless + Edge | Free → $50/mo |
| **AWS EC2** | High-scale | $3.50+/mo |
| **DigitalOcean** | Simplicity | $4+/mo |

---

## 📊 Admin Dashboard Guide

### 📈 Dashboard Tab
- **Total Conversations** - All chat sessions since launch
- **Active Conversations** - Ongoing chats (status = 'active')
- **Qualified Leads** - Visitors who provided email/phone
- **Message Count** - Total user + AI messages

### 💬 Conversations Tab
- View all chat sessions with participant info
- Click to expand and see full message thread
- Edit client info (name, email, phone, business)
- Update status (active → closed)
- Delete conversations

### 👥 Leads Tab
- Table view of all qualified leads
- Sortable by name, email, phone, date
- Copy email addresses for bulk outreach
- Filter by conversation status
- Export to CSV (todo)

---

## 🎯 AI Chatbot Customization

Edit the system prompt in `backend/server.js` (line ~22):

```javascript
const AGENCY_SYSTEM_PROMPT = `You are Nova, an AI sales assistant...
// Customize:
// - Services offered
// - Pricing
// - Tone (formal, casual, technical, etc.)
// - Call-to-action (book call, trial, etc.)
`;
```

Example for different industries:

**🏥 Healthcare Clinic:**
```
You are Dr. Assistant, helping patients schedule appointments...
Services: Consultations, Diagnostics, Surgery
```

**🍕 Restaurant:**
```
You are our Food Guide, helping customers order online...
Specialties: Pizza, Pasta, Desserts
```

**💼 Consulting Firm:**
```
You are our Strategy Partner, helping businesses grow...
Services: Strategy, Implementation, Training
```

---

## 🔒 Security Best Practices

### For Development
✅ Use `.env.example` as template  
✅ Add `.env` to `.gitignore`  
✅ Never commit API keys  
✅ Rotate keys regularly  
✅ Test with invalid inputs  

### For Production
✅ Use managed secrets (AWS Secrets Manager, HashiCorp Vault)  
✅ Enable HTTPS only  
✅ Set `Secure`, `HttpOnly`, `SameSite` cookies  
✅ Enable Supabase RLS (row-level security)  
✅ Monitor rate limiting in logs  
✅ Regular security audits  
✅ Keep dependencies updated (`npm audit fix`)

---

## 📈 Metrics to Track

**User Engagement:**
- Messages per session
- Session duration
- Bounce rate (% who leave without messaging)
- Return visitor rate

**Lead Quality:**
- Email capture rate
- Phone capture rate
- Average lead response time
- Conversion rate (leads → customers)

**System Health:**
- API uptime %
- Average response time
- Error rate
- Rate limit hits

---

## ❓ Troubleshooting

### Backend Won't Start
```bash
# Check port 3001 is available
lsof -i :3001  # macOS/Linux
netstat -ano | findstr :3001  # Windows

# Clear and reinstall
rm -rf node_modules package-lock.json
npm install
```

### "Cannot connect to server"
- Ensure backend is running: `npm start`
- Check `.env` has valid Supabase credentials
- Verify `ALLOWED_ORIGINS` includes your frontend URL
- Test with: `curl http://localhost:3001/api/health`

### "Invalid admin credentials"
- Double-check `.env` ADMIN_EMAIL and ADMIN_PASSWORD
- Try the fallback test credentials from `.env.example`
- Check Supabase database is online

### Groq API slow/down
- Check status: https://status.groq.com
- Fall back to static greeting
- Monitor Groq dashboard for usage limits

### Database connection errors
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY`
- Check Supabase project is active
- Ensure tables exist: run `supabase_schema.sql` again
- Check network/firewall allows Supabase connection

---

## 📚 Additional Resources

- [Groq API Docs](https://console.groq.com/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [CSS Media Queries](https://developer.mozilla.org/en-US/docs/Web/CSS/Media_Queries)

---

## 📄 Version History

| Version | Date | Changes |
|---------|------|---------|
| **1.0.0** | June 2026 | Initial release - Security hardened |
| **0.9.0** | June 2026 | Beta - Core features complete |
| **0.1.0** | June 2026 | Alpha - Foundation |

---

## 🤝 Support

For issues:
1. Check troubleshooting section above
2. Review error logs: `console.error()` in browser
3. Test API directly: use curl/Postman
4. Check Supabase dashboard for database issues
5. Verify environment variables in `.env`

---

## ✅ Production Checklist

Before going live:
- [ ] All security fixes applied
- [ ] Mobile responsive tested on real devices
- [ ] Admin dashboard fully functional
- [ ] Database backups configured
- [ ] SSL certificate installed
- [ ] Rate limiting tested
- [ ] Error handling tested
- [ ] Performance tested under load
- [ ] Documentation complete
- [ ] Team trained on platform

---

**Built with ❤️ for PixelForge Agency**

**Last Updated:** June 2026  
**Maintained By:** Dev Team  
**License:** Proprietary
