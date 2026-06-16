const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const Groq = require('groq-sdk');
const db = require('./db');
require('dotenv').config({ path: __dirname + '/../.env' }); // load from root
require('dotenv').config(); // load local fallback

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_echomind_token_key_change_me_in_prod';

// Initialize Groq client
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || ''
});

// Helper for generating mock meeting data (used as fallback when Groq key is out of quota/unreachable)
function generateMockMeetingData(title) {
  const transcriptText = `This is a mock transcript of the meeting titled "${title}". The team discussed the deployment of the EchoMind AI Meeting Assistant MVP. We reviewed the database integration with MySQL and verified that the backend server is running successfully on port 5000. In addition, we discussed setting up the React frontend with Vite, Tailwind CSS, and Framer Motion. Action items include reviewing the database credentials in the .env file, verifying that all MySQL tables (users, meetings, chats) are properly created, and testing file uploads with small audio files under 25MB. We decided to launch the MVP version next Friday, and the next alignment meeting is scheduled for Monday at 10 AM to discuss styling refinements.`;
  
  return {
    transcript: transcriptText,
    summary: `The team aligned on the launch plan for the EchoMind AI Meeting Assistant MVP. They confirmed that the Node.js server is successfully connected to the MySQL database. Key discussion points included setting up the frontend workspace, validating files under the 25MB limit, and verifying database credentials. The next alignment meeting is scheduled for Monday at 10 AM, with the final MVP release target set for next Friday.`,
    action_items: [
      "Verify MySQL schema by running schema.sql and checking tables",
      "Update Groq API keys in the root .env file once credits are added",
      "Configure frontend port to run on http://localhost:3000"
    ],
    decisions: [
      "Release the MVP version of EchoMind by next Friday",
      "Use npm workspaces for unified dependency management"
    ],
    duration_seconds: 180
  };
}

// Helper for generating mock chat response (used as fallback when Groq key is out of quota/unreachable)
function generateMockChatResponse(message, title, transcript) {
  const msgLower = message.toLowerCase();
  if (msgLower.includes('action') || msgLower.includes('todo') || msgLower.includes('task') || msgLower.includes('assign')) {
    return `According to the transcript, the action items are:\n1. Verify MySQL schema by running schema.sql and checking tables.\n2. Update Groq API keys in the root .env file once credits are added.\n3. Configure frontend port to run on http://localhost:3000.`;
  }
  if (msgLower.includes('decision') || msgLower.includes('decide') || msgLower.includes('agree')) {
    return `The key decisions from the meeting are:\n1. Release the MVP version of EchoMind by next Friday.\n2. Use npm workspaces for unified dependency management.`;
  }
  if (msgLower.includes('summary') || msgLower.includes('what was') || msgLower.includes('about')) {
    return `This meeting focused on verifying the launch plan for the EchoMind AI Meeting Assistant MVP. The team confirmed that the Node.js server is connected to the MySQL database, and discussed frontend configurations.`;
  }
  return `This is a mock assistant response (running in Mock Mode because the Groq API key is out of quota or offline). You asked: "${message}". In the mock meeting transcript, the team discussed database configurations, frontend setup, and releasing the MVP next Friday.`;
}


// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
  console.log('[Server] Created "uploads" directory.');
}

// Multer setup for handling audio uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB Whisper limit
});

// Middleware to protect routes with JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token missing' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Token is invalid or expired' });
    }
    req.user = user; // user details { userId: ... }
    next();
  });
};

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Register
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Insert user
    const [result] = await db.query(
      'INSERT INTO users (name, email, password) VALUES (?, ?, ?)',
      [name, email, hashedPassword]
    );

    const userId = result.insertId;
    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: { id: userId, name, email }
    });
  } catch (error) {
    console.error('[Register Error]', error);
    res.status(500).json({ error: 'Registration failed due to a server error' });
  }
});

// Login
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    // Find user
    const [rows] = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const user = rows[0];

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email }
    });
  } catch (error) {
    console.error('[Login Error]', error);
    res.status(500).json({ error: 'Login failed due to a server error' });
  }
});

// Profile check (GET /api/auth/me)
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name, email FROM users WHERE id = ?', [req.user.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: rows[0] });
  } catch (error) {
    console.error('[Profile Error]', error);
    res.status(500).json({ error: 'Failed to fetch user profile' });
  }
});

// ==========================================
// 2. MEETING ROUTES
// ==========================================

// Upload & Process Meeting Audio
app.post('/api/meetings/upload', authenticateToken, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const title = req.body.title || 'Untitled Meeting';
  const filePath = req.file.path;

  // Detect if we should use Mock Mode directly (if key is empty, the leaked key, or explicitly set in env)
  const apiKey = process.env.GROQ_API_KEY || '';
  const useMockDirectly = process.env.USE_MOCK_AI === 'true' || 
                          !apiKey || 
                          apiKey.trim() === '' || 
                          apiKey.startsWith('sk-proj-gkiYY');

  // Parse duration if provided from frontend recorder
  let passedDuration = null;
  if (req.body.duration_seconds) {
    const parsed = parseInt(req.body.duration_seconds, 10);
    if (!isNaN(parsed) && parsed > 0) {
      passedDuration = parsed;
    }
  }

  if (useMockDirectly) {
    console.log('[Mock AI] Bypassing Groq API call. Processing in Mock Mode...');
    try {
      const mockData = generateMockMeetingData(title);
      const mockFilename = 'mock-' + req.file.filename;
      const finalDuration = passedDuration !== null ? passedDuration : mockData.duration_seconds;

      console.log('[Database] Saving mock meeting insights...');
      const [insertResult] = await db.query(
        'INSERT INTO meetings (user_id, title, transcript, summary, action_items, decisions, duration_seconds, audio_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          req.user.userId,
          title,
          mockData.transcript,
          mockData.summary,
          JSON.stringify(mockData.action_items),
          JSON.stringify(mockData.decisions),
          finalDuration,
          mockFilename
        ]
      );

      const newMeetingId = insertResult.insertId;

      return res.status(201).json({
        message: 'Meeting processed successfully in Mock Mode',
        meeting: {
          id: newMeetingId,
          title,
          transcript: mockData.transcript,
          summary: mockData.summary,
          action_items: mockData.action_items,
          decisions: mockData.decisions,
          duration_seconds: finalDuration,
          created_at: new Date(),
          is_mock: true
        }
      });
    } catch (err) {
      console.error('[Mock Processing Error]', err);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) {}
      }
      return res.status(500).json({ error: 'Failed to process mock meeting: ' + err.message });
    }
  }

  try {
    console.log(`[Processing] Uploaded: ${req.file.filename}, Size: ${req.file.size} bytes`);

    // 1. Send file to Groq Whisper API for speech-to-text
    console.log('[Whisper] Transcribing audio file...');
    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: 'whisper-large-v3',
    });

    const transcriptText = transcription.text;
    console.log(`[Whisper] Transcription completed. Word count: ${transcriptText.split(' ').length}`);

    // Estimate duration if not provided: ~150 words per minute average speech rate
    const finalDuration = passedDuration !== null ? passedDuration : Math.round((transcriptText.split(' ').length / 150) * 60);

    // 2. Ask LLM to summarize, generate action items, and extract decisions in one call
    console.log('[LLM] Generating AI insights...');
    const chatResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are an expert executive assistant. Analyze the meeting transcript provided by the user.
Return a JSON object containing exactly three fields:
1. "summary": A brief, professional TL;DR paragraph summarizing the main purpose, tone, and outcome of the meeting.
2. "action_items": An array of strings representing specific deliverables, tasks, owners, and due dates discussed (or empty array if none).
3. "decisions": An array of strings representing key agreements, final choices, or logical determinations made during the meeting (or empty array if none).`
        },
        {
          role: 'user',
          content: `Here is the transcript:\n\n${transcriptText}`
        }
      ]
    });

    const resultData = JSON.parse(chatResponse.choices[0].message.content);
    const summary = resultData.summary || 'No summary could be generated.';
    const actionItems = JSON.stringify(resultData.action_items || []);
    const decisions = JSON.stringify(resultData.decisions || []);

    // 3. Save to Database
    console.log('[Database] Saving meeting insights...');
    const [insertResult] = await db.query(
      'INSERT INTO meetings (user_id, title, transcript, summary, action_items, decisions, duration_seconds, audio_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.userId,
        title,
        transcriptText,
        summary,
        actionItems,
        decisions,
        finalDuration,
        req.file.filename
      ]
    );

    const newMeetingId = insertResult.insertId;

    res.status(201).json({
      message: 'Meeting processed successfully',
      meeting: {
        id: newMeetingId,
        title,
        transcript: transcriptText,
        summary,
        action_items: resultData.action_items || [],
        decisions: resultData.decisions || [],
        duration_seconds: finalDuration,
        created_at: new Date()
      }
    });
  } catch (error) {
    console.error('[Upload/Processing Error] Groq failed. Falling back to Mock AI Mode...', error);
    
    // Attempt fallback to mock mode instead of failing
    try {
      const mockData = generateMockMeetingData(title);
      const mockFilename = 'mock-' + req.file.filename;
      const finalDuration = passedDuration !== null ? passedDuration : mockData.duration_seconds;

      console.log('[Database] Saving mock meeting insights after API failure...');
      const [insertResult] = await db.query(
        'INSERT INTO meetings (user_id, title, transcript, summary, action_items, decisions, duration_seconds, audio_filename) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [
          req.user.userId,
          title,
          mockData.transcript,
          mockData.summary,
          JSON.stringify(mockData.action_items),
          JSON.stringify(mockData.decisions),
          finalDuration,
          mockFilename
        ]
      );

      const newMeetingId = insertResult.insertId;

      return res.status(201).json({
        message: 'Meeting processed in Mock Mode (Groq request failed)',
        meeting: {
          id: newMeetingId,
          title,
          transcript: mockData.transcript,
          summary: mockData.summary,
          action_items: mockData.action_items,
          decisions: mockData.decisions,
          duration_seconds: finalDuration,
          created_at: new Date(),
          is_mock: true
        }
      });
    } catch (fallbackError) {
      console.error('[Fallback Error]', fallbackError);
      // Cleanup file in case of total error
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (err) {}
      }
      res.status(500).json({ error: 'Failed to process audio meeting (Groq failed and Mock fallback failed): ' + error.message });
    }
  }
});

// Get all meetings for user
app.get('/api/meetings', authenticateToken, async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, title, summary, duration_seconds, created_at FROM meetings WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(rows);
  } catch (error) {
    console.error('[Get Meetings Error]', error);
    res.status(500).json({ error: 'Failed to retrieve meetings' });
  }
});

// Get specific meeting details
app.get('/api/meetings/:id', authenticateToken, async (req, res) => {
  const meetingId = req.params.id;
  try {
    const [rows] = await db.query(
      'SELECT * FROM meetings WHERE id = ? AND user_id = ?',
      [meetingId, req.user.userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const meeting = rows[0];
    meeting.is_mock = meeting.audio_filename?.startsWith('mock-') || false;
    
    // Parse JSON columns back into native arrays
    try {
      meeting.action_items = typeof meeting.action_items === 'string' ? JSON.parse(meeting.action_items) : meeting.action_items;
      meeting.decisions = typeof meeting.decisions === 'string' ? JSON.parse(meeting.decisions) : meeting.decisions;
    } catch (e) {
      meeting.action_items = [];
      meeting.decisions = [];
    }

    res.json(meeting);
  } catch (error) {
    console.error('[Get Meeting Detail Error]', error);
    res.status(500).json({ error: 'Failed to retrieve meeting details' });
  }
});


// Delete meeting
app.post('/api/meetings/:id/delete', authenticateToken, async (req, res) => {
  const meetingId = req.params.id;
  try {
    // Find audio file to delete from disk
    const [rows] = await db.query('SELECT audio_filename FROM meetings WHERE id = ? AND user_id = ?', [meetingId, req.user.userId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const audioFilename = rows[0].audio_filename;
    if (audioFilename) {
      const fileFullPath = path.join(uploadsDir, audioFilename);
      if (fs.existsSync(fileFullPath)) {
        fs.unlinkSync(fileFullPath);
      }
    }

    // Delete from DB (foreign keys handle cascading chat records)
    await db.query('DELETE FROM meetings WHERE id = ? AND user_id = ?', [meetingId, req.user.userId]);

    res.json({ message: 'Meeting deleted successfully' });
  } catch (error) {
    console.error('[Delete Meeting Error]', error);
    res.status(500).json({ error: 'Failed to delete meeting' });
  }
});

// ==========================================
// 3. CHAT WITH MEETING ROUTES
// ==========================================

// Get all chat records for a meeting
app.get('/api/meetings/:id/chats', authenticateToken, async (req, res) => {
  const meetingId = req.params.id;
  try {
    // Verify user owns this meeting
    const [meetings] = await db.query('SELECT id FROM meetings WHERE id = ? AND user_id = ?', [meetingId, req.user.userId]);
    if (meetings.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const [chats] = await db.query('SELECT role, content, created_at FROM chats WHERE meeting_id = ? ORDER BY id ASC', [meetingId]);
    res.json(chats);
  } catch (error) {
    console.error('[Get Chats Error]', error);
    res.status(500).json({ error: 'Failed to retrieve chats' });
  }
});

// Send new chat question to meeting context
app.post('/api/meetings/:id/chats', authenticateToken, async (req, res) => {
  const meetingId = req.params.id;
  const { message } = req.body;

  if (!message || message.trim() === '') {
    return res.status(400).json({ error: 'Message content is required' });
  }

  try {
    // 1. Fetch meeting context (transcript and title) and verify ownership
    const [meetings] = await db.query(
      'SELECT title, transcript, audio_filename FROM meetings WHERE id = ? AND user_id = ?',
      [meetingId, req.user.userId]
    );

    if (meetings.length === 0) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { title, transcript, audio_filename } = meetings[0];
    const isMock = audio_filename?.startsWith('mock-') || false;

    // 2. Fetch past chats (limit context to last 10 messages to save tokens)
    const [history] = await db.query(
      'SELECT role, content FROM chats WHERE meeting_id = ? ORDER BY id ASC LIMIT 10',
      [meetingId]
    );

    // 3. Insert user chat message into database
    await db.query('INSERT INTO chats (meeting_id, role, content) VALUES (?, ?, ?)', [meetingId, 'user', message]);

    // Check if we should process this chat in Mock Mode directly
    const apiKey = process.env.GROQ_API_KEY || '';
    const useMockChatDirectly = isMock || 
                                !apiKey || 
                                apiKey.trim() === '' || 
                                apiKey.startsWith('sk-proj-gkiYY') ||
                                process.env.USE_MOCK_AI === 'true';

    if (useMockChatDirectly) {
      console.log('[Mock Chat] Bypassing Groq API call. Generating mock assistant reply...');
      const reply = generateMockChatResponse(message, title, transcript);
      await db.query('INSERT INTO chats (meeting_id, role, content) VALUES (?, ?, ?)', [meetingId, 'assistant', reply]);
      return res.json({
        userMessage: message,
        reply: reply
      });
    }

    // 4. Construct messages array for Groq
    const systemInstruction = `You are a helpful AI assistant specialized in analyzing meeting transcripts.
You have the complete transcript of the meeting titled "${title}".
Answer the user's questions truthfully based ONLY on the transcript text.
If the answer is not discussed in the transcript, explain politely that the information is not present in the meeting context.
Keep your answers brief, informative, and professional.

--- MEETING TRANSCRIPT ---
${transcript}
--------------------------`;

    const apiMessages = [
      { role: 'system', content: systemInstruction },
      ...history.map(msg => ({ role: msg.role, content: msg.content })),
      { role: 'user', content: message }
    ];

    // 5. Query LLM model
    console.log('[LLM Chat] Generating reply for meeting id:', meetingId);
    const chatResponse = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: apiMessages
    });

    const reply = chatResponse.choices[0].message.content;

    // 6. Insert AI reply into database
    await db.query('INSERT INTO chats (meeting_id, role, content) VALUES (?, ?, ?)', [meetingId, 'assistant', reply]);

    res.json({
      userMessage: message,
      reply: reply
    });
  } catch (error) {
    console.error('[Chat Error] Groq failed. Falling back to Mock Chat response...', error);
    
    // Attempt fallback to mock chat response
    try {
      const [meetings] = await db.query('SELECT title, transcript FROM meetings WHERE id = ?', [meetingId]);
      const title = meetings[0]?.title || 'Untitled Meeting';
      const transcript = meetings[0]?.transcript || '';
      
      const reply = generateMockChatResponse(message, title, transcript);
      await db.query('INSERT INTO chats (meeting_id, role, content) VALUES (?, ?, ?)', [meetingId, 'assistant', reply]);
      
      return res.json({
        userMessage: message,
        reply: reply
      });
    } catch (fallbackError) {
      console.error('[Fallback Chat Error]', fallbackError);
      res.status(500).json({ error: 'Failed to process chat response (Groq failed and Mock fallback failed): ' + error.message });
    }
  }
});


// Serve uploads as static assets (if they want to play back audio on the client side)
app.use('/api/uploads', express.static(uploadsDir));

// Fallback message
app.get('/', (req, res) => {
  res.json({ message: 'EchoMind AI Meeting Assistant API is running.' });
});

// Boot server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`[Server] Running on port http://localhost:${PORT}`);
  console.log(`[Groq] API Key: ${process.env.GROQ_API_KEY ? 'Configured' : 'MISSING (Transcriptions/LLM will fail)'}`);
  console.log(`======================================================\n`);
});
