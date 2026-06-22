const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// index.html - Claude API 키 주입
app.get('/', (req, res) => {
  let html = fs.readFileSync(path.join(__dirname, 'public/index.html'), 'utf-8');
  const key = process.env.CLAUDE_API_KEY || '';
  html = html.replace('</head>', `<script>window.__CLAUDE_KEY__='${key}';</script></head>`);
  res.send(html);
});

app.use(express.static(path.join(__dirname, 'public')));

// Claude API 프록시
app.post('/api/claude', async (req, res) => {
  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not set' });
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(req.body)
    });
    res.json(await r.json());
  } catch(e) { res.status(500).json({ error: e.message }); }
});

// 데이터 조회
app.get('/api/data', async (req, res) => {
  const { data, error } = await supabase.from('ad_data').select('*').order('week_key');
  if (error) return res.status(500).json({ error: error.message });
  const result = {};
  data.forEach(row => { result[row.week_key] = { label: row.label, platforms: row.platforms, gsKeywords: row.gs_keywords||[], notes: row.notes||{} }; });
  res.json(result);
});

// 데이터 저장
app.post('/api/data', async (req, res) => {
  const rows = Object.entries(req.body).map(([week_key, val]) => ({
    week_key, label: val.label, platforms: val.platforms, gs_keywords: val.gsKeywords||[], notes: val.notes||{}, updated_at: new Date().toISOString()
  }));
  const { error } = await supabase.from('ad_data').upsert(rows);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, count: rows.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`서버: http://localhost:${PORT}`));
