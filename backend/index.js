// backend/index.js
require('dotenv').config();

const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer'); // v2.x
const { v4: uuidv4 } = require('uuid');
const { stringify } = require('csv-stringify');


const initDB = require('./db');

// ---------- CONFIG ----------
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// middlewares
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// uploads dir
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// Serve static uploads
app.use('/uploads', express.static(uploadsDir));

// Multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '');
    cb(null, uuidv4() + ext);
  }
});

const upload = multer({ storage });

// ---------- HELPERS ----------
function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function makeAuthRequired(db) {
  return async function authRequired(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!token) return res.status(401).json({ error: 'Missing token' });

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const user = await db.get('SELECT id, email FROM users WHERE id = ?', [payload.id]);
      if (!user) return res.status(401).json({ error: 'Invalid token' });
      req.user = user;
      next();
    } catch (err) {
      console.error('auth error:', err.message);
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
}

// record recent view
async function recordRecentView(db, userId, entryId) {
  if (!userId) return;
  try {
    await db.run(
      `INSERT INTO recent_views (user_id, entry_id, viewed_at)
       VALUES (?, ?, CURRENT_TIMESTAMP)`,
      [userId, entryId]
    );
  } catch (err) {
    console.error('recordRecentView error:', err.message);
  }
}

// ---------- MAIN BOOTSTRAP ----------
(async () => {
  const db = await initDB();
  const authRequired = makeAuthRequired(db);

  // ---------- AUTH ROUTES ----------

  app.post('/auth/register', async (req, res) => {
    const { email, password } = req.body;
    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    try {
      const existing = await db.get('SELECT id FROM users WHERE email = ?', [email]);
      if (existing) return res.status(400).json({ error: 'Email already registered' });

      const hash = bcrypt.hashSync(password, 10);
      const result = await db.run(
        `INSERT INTO users (email, password_hash) VALUES (?, ?)`,
        [email, hash]
      );
      const user = { id: result.lastID, email };
      const token = signToken(user);
      res.json({ token, user });
    } catch (err) {
      console.error('register error:', err.message);
      res.status(500).json({ error: 'Register failed' });
    }
  });

  app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
      const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) return res.status(400).json({ error: 'Invalid credentials' });

      const ok = bcrypt.compareSync(password, user.password_hash);
      if (!ok) return res.status(400).json({ error: 'Invalid credentials' });

      const token = signToken(user);
      res.json({ token, user: { id: user.id, email: user.email } });
    } catch (err) {
      console.error('login error:', err.message);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/me', authRequired, (req, res) => {
    res.json(req.user);
  });

  // ---------- ENTRIES ROUTES ----------

  // list entries
  app.get('/entries', async (req, res) => {
    const { q, category, language } = req.query;
    const where = [];
    const params = [];

    if (q?.trim()) {
      where.push('(word LIKE ? OR meaning LIKE ? OR example LIKE ?)');
      params.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    if (category) {
      where.push('category = ?');
      params.push(category);
    }
    if (language) {
      where.push('language = ?');
      params.push(language);
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const sql = `
      SELECT *
      FROM entries
      ${whereSql}
      ORDER BY createdAt DESC
    `;

    try {
      const rows = await db.all(sql, params);
      res.json(rows);
    } catch (err) {
      console.error('list entries error:', err.message);
      res.status(500).json({ error: 'Failed to fetch entries' });
    }
  });

  // get single entry
  app.get('/entries/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const entry = await db.get('SELECT * FROM entries WHERE id = ?', [id]);
      if (!entry) return res.status(404).json({ error: 'Not found' });

      // optional token to record recent view
      const authHeader = req.headers.authorization || '';
      const token = authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;
      if (token) {
        try {
          const payload = jwt.verify(token, JWT_SECRET);
          await recordRecentView(db, payload.id, id);
        } catch {}
      }

      res.json(entry);
    } catch (err) {
      console.error('get entry error:', err.message);
      res.status(500).json({ error: 'Failed to fetch entry' });
    }
  });

  // create entry
  // CREATE ENTRY (safe version, no login required for now)
app.post('/entries', upload.single('audio'), async (req, res) => {
  try {
    const {
      language,
      word,
      meaning,
      example,
      tags,
      category
      // we will ignore region_* for now so DB schema mismatch doesn't break
    } = req.body;

    if (!language?.trim() || !word?.trim()) {
      return res.status(400).json({ error: "language and word required" });
    }

    const tagsJson = tags || "[]";
    const audioFilename = req.file ? req.file.filename : null;

    // if auth middleware added later, req.user may exist; otherwise null
    const userId = req.user?.id || null;

    const shareToken = uuidv4();

    // IMPORTANT: this INSERT uses only the "core" columns that we know existed
    // in your original project: user_id, language, word, meaning, example, tags,
    // category, audio_filename, votes, avg_rating, share_token, sample_sentences, createdAt
    const result = await db.run(
      `
      INSERT INTO entries (
        user_id,
        language,
        word,
        meaning,
        example,
        tags,
        category,
        audio_filename,
        votes,
        avg_rating,
        share_token,
        sample_sentences,
        createdAt
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, NULL, CURRENT_TIMESTAMP
      )
      `,
      [
        userId,
        language,
        word,
        meaning || "",
        example || "",
        tagsJson,
        category || "general",
        audioFilename,
        shareToken
      ]
    );

    const created = await db.get(
      "SELECT * FROM entries WHERE id = ?",
      [result.lastID]
    );

    return res.json(created);
  } catch (err) {
    console.error("create entry error:", err);   // <— watch this in terminal if anything still breaks
    return res.status(500).json({ error: "Create failed" });
  }
});


  // update entry
  app.put('/entries/:id', upload.single('audio'), async (req, res) => {
    const id = Number(req.params.id);
    try {
      const existing = await db.get('SELECT * FROM entries WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not your entry' });
      }

      const {
        language,
        word,
        meaning,
        example,
        tags,
        category,
        region_name,
        region_lat,
        region_lng
      } = req.body;

      const tagsJson = tags || existing.tags || '[]';
      let audioFilename = existing.audio_filename;
      if (req.file) {
        audioFilename = req.file.filename;
      }

      await db.run(
        `
        UPDATE entries SET
          language = ?,
          word = ?,
          meaning = ?,
          example = ?,
          tags = ?,
          category = ?,
          audio_filename = ?,
          region_name = ?,
          region_lat = ?,
          region_lng = ?
        WHERE id = ?
        `,
        [
          language || existing.language,
          word || existing.word,
          meaning || existing.meaning,
          example || existing.example,
          tagsJson,
          category || existing.category,
          audioFilename,
          region_name || existing.region_name,
          region_lat || existing.region_lat,
          region_lng || existing.region_lng,
          id
        ]
      );

      const updated = await db.get('SELECT * FROM entries WHERE id = ?', [id]);
      res.json(updated);
    } catch (err) {
      console.error('update entry error:', err.message);
      res.status(500).json({ error: 'Update failed' });
    }
  });

  // delete entry
  app.delete('/entries/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const existing = await db.get('SELECT * FROM entries WHERE id = ?', [id]);
      if (!existing) return res.status(404).json({ error: 'Not found' });
      if (existing.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not your entry' });
      }
      await db.run('DELETE FROM entries WHERE id = ?', [id]);
      res.json({ ok: true });
    } catch (err) {
      console.error('delete error:', err.message);
      res.status(500).json({ error: 'Delete failed' });
    }
  });

  // upvote / unupvote
  app.post('/entries/:id/upvote', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await db.run('UPDATE entries SET votes = votes + 1 WHERE id = ?', [id]);
      const row = await db.get('SELECT votes FROM entries WHERE id = ?', [id]);
      res.json({ votes: row?.votes ?? 0 });
    } catch (err) {
      console.error('upvote error:', err.message);
      res.status(500).json({ error: 'Upvote failed' });
    }
  });

  app.post('/entries/:id/unupvote', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await db.run(`
        UPDATE entries
        SET votes = CASE WHEN votes > 0 THEN votes - 1 ELSE 0 END
        WHERE id = ?
      `, [id]);
      const row = await db.get('SELECT votes FROM entries WHERE id = ?', [id]);
      res.json({ votes: row?.votes ?? 0 });
    } catch (err) {
      console.error('unupvote error:', err.message);
      res.status(500).json({ error: 'Unupvote failed' });
    }
  });

  // rating
  app.post('/entries/:id/rate', async (req, res) => {
    const id = Number(req.params.id);
    const { rating } = req.body;
    const n = Math.max(1, Math.min(5, Number(rating) || 0));
    try {
      await db.run(
        `INSERT INTO ratings (entry_id, user_id, rating) VALUES (?, ?, ?)`,
        [id, req.user.id, n]
      );
      const avgRow = await db.get(
        'SELECT AVG(rating) as avg FROM ratings WHERE entry_id = ?',
        [id]
      );
      const avg = avgRow?.avg ?? 0;
      await db.run('UPDATE entries SET avg_rating = ? WHERE id = ?', [avg, id]);
      res.json({ avg });
    } catch (err) {
      console.error('rate error:', err.message);
      res.status(500).json({ error: 'Rating failed' });
    }
  });

  // ---------- AI ROUTES ----------

 // ---------- AI: meaning + example ----------
app.post('/ai/enrich', async (req, res) => {
  const { language, word } = req.body;

  if (!word?.trim()) {
    return res.status(400).json({ error: 'word required' });
  }

  if (!process.env.OPENAI_API_KEY) {
    // This is the error you saw earlier
    return res.status(500).json({ error: 'OPENAI_API_KEY missing in .env' });
  }

  try {
    const prompt = `
You are helping build a multilingual dictionary.

Language: ${language || 'Unknown'}
Word: ${word}

Return a short JSON object with:
- meaning: short definition in English
- example: one example sentence using that word (preferably in the same language, else English).
`.trim();

    // Using the new OpenAI SDK v4
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }]
    });

    const text = completion.choices[0]?.message?.content?.trim() || "";

    let meaning = "";
    let example = "";

    // Try parse JSON if the model returned JSON
    try {
      const parsed = JSON.parse(text);
      meaning = parsed.meaning || "";
      example = parsed.example || "";
    } catch {
      // Fallback: treat the whole text as meaning
      meaning = text;
    }

    return res.json({
      ok: true,
      meaning,
      example
    });
  } catch (err) {
    console.error("AI enrich error:", err);
    return res.status(500).json({ error: "AI generation failed" });
  }
});

  // AI sample sentences
  app.post('/entries/:id/generate-sentences', async (req, res) => {
    const id = Number(req.params.id);
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ error: 'OPENAI_API_KEY missing in .env' });
    }

    try {
      const entry = await db.get('SELECT * FROM entries WHERE id = ?', [id]);
      if (!entry) return res.status(404).json({ error: 'Not found' });

      const prompt = `
Generate 3 short example sentences for this word in its language or English:

Language: ${entry.language}
Word: ${entry.word}
Meaning: ${entry.meaning}

Return JSON: { "sentences": ["...", "...", "..."] }
      `.trim();

      const completion = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: prompt,
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "sentences",
            schema: {
              type: "object",
              properties: {
                sentences: {
                  type: "array",
                  items: { type: "string" },
                  minItems: 3,
                  maxItems: 5
                }
              },
              required: ["sentences"],
              additionalProperties: false
            }
          }
        }
      });

      const json = JSON.parse(completion.output[0].content[0].text);
      const sentences = json.sentences || [];

      await db.run(
        'UPDATE entries SET sample_sentences = ? WHERE id = ?',
        [JSON.stringify(sentences), id]
      );

      res.json({ ok: true, sentences });
    } catch (err) {
      console.error('AI sentences error:', err);
      res.status(500).json({ error: 'AI generation failed' });
    }
  });

  
  // ---------- FAVORITES & RECENT ----------

  app.post('/entries/:id/favorite', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await db.run(
        `
        INSERT INTO favorites (user_id, entry_id, created_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        `,
        [req.user.id, id]
      );
      res.json({ ok: true });
    } catch (err) {
      // ignore duplicate favorites
      if (err.message.includes('UNIQUE')) return res.json({ ok: true });
      console.error('favorite error:', err.message);
      res.status(500).json({ error: 'favorite failed' });
    }
  });

  app.post('/entries/:id/unfavorite', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await db.run(
        'DELETE FROM favorites WHERE user_id = ? AND entry_id = ?',
        [req.user.id, id]
      );
      res.json({ ok: true });
    } catch (err) {
      console.error('unfavorite error:', err.message);
      res.status(500).json({ error: 'unfavorite failed' });
    }
  });

  app.get('/me/favorites', async (req, res) => {
    try {
      const rows = await db.all(
        `
        SELECT e.*
        FROM favorites f
        JOIN entries e ON e.id = f.entry_id
        WHERE f.user_id = ?
        ORDER BY f.created_at DESC
        `,
        [req.user.id]
      );
      res.json(rows);
    } catch (err) {
      console.error('favorites error:', err.message);
      res.status(500).json({ error: 'Failed to get favorites' });
    }
  });

  app.get('/me/recent', async (req, res) => {
    try {
      const rows = await db.all(
        `
        SELECT e.*
        FROM recent_views rv
        JOIN entries e ON e.id = rv.entry_id
        WHERE rv.user_id = ?
        ORDER BY rv.viewed_at DESC
        LIMIT 20
        `,
        [req.user.id]
      );
      res.json(rows);
    } catch (err) {
      console.error('recent error:', err.message);
      res.status(500).json({ error: 'Failed to get recent' });
    }
  });

  // ---------- COMMENTS ----------

  app.get('/entries/:id/comments', async (req, res) => {
    const id = Number(req.params.id);
    try {
      const rows = await db.all(
        `
        SELECT c.*, u.email AS author_email
        FROM comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.entry_id = ?
        ORDER BY c.created_at ASC
        `,
        [id]
      );
      res.json(rows);
    } catch (err) {
      console.error('get comments error:', err.message);
      res.status(500).json({ error: 'Failed to get comments' });
    }
  });

  app.post('/entries/:id/comments', async (req, res) => {
    const id = Number(req.params.id);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'text required' });

    try {
      const result = await db.run(
        `
        INSERT INTO comments (entry_id, user_id, text, upvotes, created_at)
        VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)
        `,
        [id, req.user.id, text.trim()]
      );
      const row = await db.get('SELECT * FROM comments WHERE id = ?', [result.lastID]);
      res.json(row);
    } catch (err) {
      console.error('add comment error:', err.message);
      res.status(500).json({ error: 'Comment failed' });
    }
  });

  app.post('/comments/:id/upvote', async (req, res) => {
    const id = Number(req.params.id);
    try {
      await db.run(
        'UPDATE comments SET upvotes = upvotes + 1 WHERE id = ?',
        [id]
      );
      const row = await db.get('SELECT upvotes FROM comments WHERE id = ?', [id]);
      res.json(row);
    } catch (err) {
      console.error('comment upvote error:', err.message);
      res.status(500).json({ error: 'Comment upvote failed' });
    }
  });

  // ---------- WORD OF THE DAY ----------
  app.get('/word-of-day', async (req, res) => {
    try {
      const row = await db.get(
        `SELECT * FROM entries ORDER BY RANDOM() LIMIT 1`
      );
      if (!row) return res.json({ ok: false });
      res.json({ ok: true, entry: row });
    } catch (err) {
      console.error('word-of-day error:', err.message);
      res.status(500).json({ error: 'Failed to get word-of-day' });
    }
  });

  // ---------- CSV EXPORT ----------
  app.get('/export/csv', async (req, res) => {
    try {
      const rows = await db.all(
        `
        SELECT language, word, meaning, example, category, tags,
               votes, avg_rating, createdAt
        FROM entries
        ORDER BY createdAt DESC
        `
      );

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="local-language-archive.csv"'
      );

      const stringifier = stringify({
        header: true,
        columns: [
          'language',
          'word',
          'meaning',
          'example',
          'category',
          'tags',
          'votes',
          'avg_rating',
          'createdAt'
        ]
      });

      stringifier.pipe(res);
      rows.forEach(r => stringifier.write(r));
      stringifier.end();
    } catch (err) {
      console.error('csv export error:', err.message);
      res.status(500).json({ error: 'CSV export failed' });
    }
  });

  // ---------- START SERVER ----------
  app.listen(PORT, () => {
    console.log(`API listening on http://localhost:${PORT}`);
  });
})();
