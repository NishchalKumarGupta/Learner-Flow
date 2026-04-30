const PISTON = {
  python: { language: 'python',     version: '3.10.0',  file: 'main.py'   },
  java:   { language: 'java',       version: '15.0.2',  file: 'Main.java' },
  cpp:    { language: 'c++',        version: '10.2.0',  file: 'main.cpp'  }
};

let playlist       = [];
let currentIdx     = -1;
let currentVideoId = null;
let notes          = [];
let currentLang    = 'python';

const TEMPLATES = {
  python: `# Python 3
def fibonacci(n):
    a, b = 0, 1
    result = []
    for _ in range(n):
        result.append(a)
        a, b = b, a + b
    return result

nums = fibonacci(10)
print("Fibonacci sequence:")
for i, n in enumerate(nums):
    print(f"  fib({i}) = {n}")

name = "LearnerFlow"
print(f"\\nHello from {name}!")`,

  java: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello from Java!");

        int a = 0, b = 1;
        System.out.print("Fibonacci: ");
        for (int i = 0; i < 10; i++) {
            System.out.print(a + " ");
            int temp = a + b;
            a = b;
            b = temp;
        }
        System.out.println();

        for (int i = 1; i <= 5; i++) {
            System.out.println("*".repeat(i));
        }
    }
}`,

  cpp: `#include <iostream>
#include <vector>
#include <string>
using namespace std;

int main() {
    cout << "Hello from C++!" << endl;

    vector<int> fib = {0, 1};
    for (int i = 2; i < 10; i++)
        fib.push_back(fib[i-1] + fib[i-2]);

    cout << "Fibonacci: ";
    for (int n : fib) cout << n << " ";
    cout << endl;

    for (int i = 1; i <= 5; i++)
        cout << string(i, '*') << endl;

    return 0;
}`
};

function save() {
  try { localStorage.setItem('lf_playlist', JSON.stringify(playlist)); } catch(e) {}
  try { localStorage.setItem('lf_notes',    JSON.stringify(notes));    } catch(e) {}
}
function load() {
  try { const p = localStorage.getItem('lf_playlist'); if (p) playlist = JSON.parse(p); } catch(e) {}
  try { const n = localStorage.getItem('lf_notes');    if (n) notes    = JSON.parse(n); } catch(e) {}
}

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/\n/g,'<br>');
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.style.borderColor = type === 'err' ? '#ff5f6d' : 'rgba(255,255,255,.1)';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(toast._t);
  toast._t = setTimeout(() => { el.style.transform = 'translateX(-50%) translateY(60px)'; }, 2400);
}

function getVideoId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}
function getPlaylistId(url) {
  const m = url.match(/[?&]list=([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

function updateStreak() {
  const today = notes.filter(n => {
    const d = new Date(n.id);
    return d.toDateString() === new Date().toDateString();
  });
  document.getElementById('streak-pill').textContent = `${today.length} notes today`;
}

async function loadPlaylist() {
  const url = document.getElementById('pl-url').value.trim();
  if (!url) { toast('Paste a playlist URL first'); return; }

  const pid = getPlaylistId(url);
  const vid = getVideoId(url);

  if (pid) {
    document.getElementById('sidebar-list').innerHTML =
      '<div class="loading-row"><div class="spinner"></div><span>Fetching playlist…</span></div>';
    try {
      let items = [], pageToken = '', page = 0;
      do {
        const r = await fetch(
          `http://localhost:3000/api/playlist?playlistId=${pid}&pageToken=${pageToken}`
        );
        const d = await r.json();
        if (d.error) { toast('API error: ' + d.error.message, 'err'); renderList(); return; }
        (d.items||[]).forEach(item => {
          const v = item.snippet?.resourceId?.videoId;
          if (v && v !== 'deleted') items.push({
            id: v,
            title: item.snippet.title,
            thumb: item.snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${v}/mqdefault.jpg`
          });
        });
        pageToken = d.nextPageToken || '';
        page++;
      } while (pageToken && page < 4);

      if (!items.length) { toast('No videos found', 'err'); renderList(); return; }
      playlist = items;
      save(); renderList(); playVideo(0);
      toast(`✓ Loaded ${items.length} videos`);
      document.getElementById('pl-url').value = '';
    } catch(e) {
      toast('Network error', 'err'); renderList();
    }
  } else if (vid) {
    addVideo(vid, '');
    document.getElementById('pl-url').value = '';
  } else {
    toast('Invalid YouTube URL', 'err');
  }
}

function addVideo(vid, title) {
  playlist.push({
    id: vid,
    title: title || `Video ${playlist.length + 1}`,
    thumb: `https://img.youtube.com/vi/${vid}/mqdefault.jpg`
  });
  save(); renderList(); playVideo(playlist.length - 1);
}

function deleteVideo(idx, e) {
  e.stopPropagation();
  playlist.splice(idx, 1);
  if (!playlist.length) {
    currentIdx = -1; currentVideoId = null;
    document.getElementById('video-box').innerHTML =
      `<div class="video-placeholder"><div class="vp-glyph">▶</div><p>Load a playlist or add a video</p></div>`;
    document.getElementById('video-info').style.display = 'none';
    document.getElementById('now-playing').textContent = 'No video selected';
  } else {
    if (currentIdx >= playlist.length) currentIdx = playlist.length - 1;
    playVideo(currentIdx);
  }
  save(); renderList();
  toast('Video removed');
}

function renderList() {
  const el = document.getElementById('sidebar-list');
  if (!playlist.length) {
    el.innerHTML = '<div class="empty-hint">↑ Paste a playlist URL above<br>or click <strong>+ Add Video</strong></div>';
    return;
  }
  el.innerHTML = playlist.map((v, i) => `
    <div class="pl-item ${i === currentIdx ? 'active' : ''}" onclick="playVideo(${i})">
      <span class="pl-num">${i + 1}</span>
      <div class="pl-thumb">
        <img src="${v.thumb}" alt="" loading="lazy" onerror="this.style.display='none'">
        ${i === currentIdx ? '<div class="pl-now">▶</div>' : ''}
      </div>
      <div class="pl-info"><div class="pl-name">${esc(v.title)}</div></div>
      <button class="pl-del" onclick="deleteVideo(${i}, event)" title="Remove">✕</button>
    </div>`).join('');
}

function playVideo(idx) {
  if (idx < 0 || idx >= playlist.length) return;
  currentIdx = idx;
  const v = playlist[idx];
  currentVideoId = v.id;
  document.getElementById('now-playing').textContent = v.title;
  document.getElementById('vi-title').textContent    = v.title;
  document.getElementById('video-info').style.display = 'block';
  document.getElementById('video-box').innerHTML =
    `<iframe src="https://www.youtube.com/embed/${v.id}?rel=0&modestbranding=1"
       allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
       allowfullscreen></iframe>`;
  renderList(); renderNotes();
}

function clearPlaylist() {
  if (!playlist.length) return;
  if (!confirm('Remove all videos?')) return;
  playlist = []; currentIdx = -1; currentVideoId = null;
  save(); renderList();
  document.getElementById('video-box').innerHTML =
    `<div class="video-placeholder"><div class="vp-glyph">▶</div><p>Load a playlist or add a video</p></div>`;
  document.getElementById('video-info').style.display = 'none';
  document.getElementById('now-playing').textContent = 'No video selected';
  toast('Playlist cleared');
}

function fmt(before, after) {
  const ta = document.getElementById('note-ta');
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0,s) + before + (ta.value.slice(s,e)||'text') + after + ta.value.slice(e);
  ta.focus();
}

function addTimestamp() {
  const ta  = document.getElementById('note-ta');
  const mm  = String(Math.floor(Math.random()*20)).padStart(2,'0');
  const ss  = String(Math.floor(Math.random()*60)).padStart(2,'0');
  const ts  = `[${mm}:${ss}] `;
  const pos = ta.selectionStart;
  ta.value  = ta.value.slice(0,pos) + ts + ta.value.slice(pos);
  ta.setSelectionRange(pos+ts.length, pos+ts.length);
  ta.focus();
}

function saveNote() {
  const ta   = document.getElementById('note-ta');
  const text = ta.value.trim();
  if (!text) { toast('Write something first'); return; }
  notes.unshift({
    text,
    videoId:    currentVideoId,
    videoTitle: playlist[currentIdx]?.title || 'General',
    time:       new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
    id:         Date.now()
  });
  save(); ta.value = ''; renderNotes(); updateStreak();
  toast('✓ Note saved');
}

function deleteNote(id) {
  notes = notes.filter(n => n.id !== id);
  save(); renderNotes(); updateStreak();
}

function renderNotes() {
  const el  = document.getElementById('notes-feed');
  const rel = notes.filter(n => n.videoId === currentVideoId);
  document.getElementById('note-count').textContent = rel.length;
  if (!rel.length) {
    el.innerHTML = '<div class="empty-hint" style="padding:20px 12px">Notes you save will appear here.<br>Press <kbd>Ctrl+Enter</kbd> to save.</div>';
    return;
  }
  el.innerHTML = rel.map(n => `
    <div class="note-card">
      <div class="note-card-top">
        <span class="note-ts">${n.time}</span>
        <button class="note-del-btn" onclick="deleteNote(${n.id})">✕</button>
      </div>
      <div class="note-body">${esc(n.text)}</div>
    </div>`).join('');
}

function renderAllNotes() {
  const el    = document.getElementById('allnotes-inner');
  const empty = document.getElementById('allnotes-empty');
  if (!notes.length) { el.innerHTML = ''; if(empty) empty.style.display='block'; return; }
  if (empty) empty.style.display = 'none';
  const groups = {};
  notes.forEach(n => {
    const k = n.videoId||'unknown';
    if (!groups[k]) groups[k] = { title: n.videoTitle, items: [] };
    groups[k].items.push(n);
  });
  el.innerHTML = Object.values(groups).map(g => `
    <div class="an-section">
      <div class="an-section-title">${esc(g.title)}</div>
      ${g.items.map(n => `
        <div class="note-card" style="margin-bottom:6px">
          <div class="note-card-top">
            <span class="note-ts">${n.time}</span>
            <button class="note-del-btn" onclick="deleteNote(${n.id});renderAllNotes()">✕</button>
          </div>
          <div class="note-body">${esc(n.text)}</div>
        </div>`).join('')}
    </div>`).join('');
}

function switchTab(t) {
  document.querySelectorAll('.tab').forEach((el,i) =>
    el.classList.toggle('active', ['video','ide','allnotes'][i] === t));
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + t).classList.add('active');
  if (t === 'allnotes') renderAllNotes();
}

function setLang(lang) {
  currentLang = lang;
  document.querySelectorAll('.lang-tab').forEach(el =>
    el.classList.toggle('active', el.dataset.lang === lang));
  document.getElementById('code-ta').value = TEMPLATES[lang];
  syncLineNums(); clearOutput();
}

function syncLineNums() {
  const lines = document.getElementById('code-ta').value.split('\n').length;
  document.getElementById('line-nums').textContent =
    Array.from({length: lines}, (_,i) => i+1).join('\n');
}

function handleEditorKey(e) {
  if (e.key === 'Tab') {
    e.preventDefault();
    const ta = e.target, pos = ta.selectionStart;
    ta.value = ta.value.slice(0,pos) + '    ' + ta.value.slice(ta.selectionEnd);
    ta.setSelectionRange(pos+4, pos+4);
    syncLineNums();
    return;
  }
  if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); runCode(); }
}

function clearOutput() {
  const ob = document.getElementById('output-body');
  ob.className    = 'output-body muted';
  ob.textContent  = 'Run your code to see output here…';
  const tag = document.getElementById('output-tag');
  tag.textContent = ''; tag.className = 'output-tag';
  document.getElementById('ide-status').textContent = 'Ready';
}

async function runCode() {
  const code   = document.getElementById('code-ta').value.trim();
  const btn    = document.getElementById('run-btn');
  const ob     = document.getElementById('output-body');
  const tag    = document.getElementById('output-tag');
  const status = document.getElementById('ide-status');

  if (!code) { toast('Write some code first'); return; }

  const cfg = PISTON[currentLang];

  btn.disabled    = true;
  btn.textContent = '⏳ Running…';
  status.textContent = 'Executing…';
  ob.className    = 'output-body muted';
  ob.textContent  = '⏳ Compiling and running…';
  tag.textContent = ''; tag.className = 'output-tag';

  const endpoints = [
    'https://emkc.org/api/v2/piston/execute',
    'https://piston.roboduels.com/api/v2/piston/execute'
  ];

  let success = false;

  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          language: cfg.language,
          version:  cfg.version,
          files:    [{ name: cfg.file, content: code }],
          stdin:    '',
          args:     [],
          run_timeout: 10000,
          compile_timeout: 10000
        })
      });

      clearTimeout(timeout);

      if (!res.ok) continue;

      const data = await res.json();
      const run  = data.run || {};
      const compile = data.compile || {};

      const compileErr = (compile.stderr||'').trim();
      const runStdout  = (run.stdout||'').trim();
      const runStderr  = (run.stderr||'').trim();

      if (compileErr) {
        ob.className    = 'output-body err';
        ob.textContent  = compileErr;
        tag.textContent = 'COMPILE ERROR';
        tag.className   = 'output-tag err';
        status.textContent = 'Compile Error';
      } else if (runStderr) {
        ob.className    = 'output-body err';
        ob.textContent  = runStderr;
        tag.textContent = 'RUNTIME ERROR';
        tag.className   = 'output-tag err';
        status.textContent = 'Error';
      } else {
        ob.className    = 'output-body';
        ob.textContent  = runStdout || '(no output)';
        tag.textContent = '✓ OK';
        tag.className   = 'output-tag ok';
        status.textContent = `Done`;
      }

      success = true;
      break;

    } catch (e) {
      if (e.name === 'AbortError') continue;
    }
  }

  if (!success) {
    ob.className = 'output-body err';
    ob.textContent =
`Could not reach the code execution server.

This usually means:
  1. The Piston API is temporarily down
  2. Your network is blocking the request

✅ Fix: Try again in a moment — Piston is usually back quickly.

You can also test your code on:
  • replit.com
  • onecompiler.com
  • programiz.com/python-programming/online-compiler`;
    tag.textContent = 'FAILED';
    tag.className   = 'output-tag err';
    status.textContent = 'Failed';
  }

  btn.disabled    = false;
  btn.textContent = '▶ Run';
}

function showModal() {
  document.getElementById('modal').style.display = 'flex';
  setTimeout(() => document.getElementById('modal-url').focus(), 50);
}
function closeModal() {
  document.getElementById('modal').style.display = 'none';
  document.getElementById('modal-url').value   = '';
  document.getElementById('modal-title').value = '';
}
function submitModal() {
  const url   = document.getElementById('modal-url').value.trim();
  const title = document.getElementById('modal-title').value.trim();
  const vid   = getVideoId(url);
  if (!vid) { toast('Invalid YouTube URL', 'err'); return; }
  addVideo(vid, title);
  closeModal();
  toast('✓ Video added');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('note-ta').addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') { e.preventDefault(); saveNote(); }
  });

  document.getElementById('pl-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); loadPlaylist(); }
  });

  document.getElementById('modal-url').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitModal();
  });
  document.getElementById('modal-title').addEventListener('keydown', e => {
    if (e.key === 'Enter') submitModal();
  });

  document.getElementById('code-ta').value = TEMPLATES.python;
  syncLineNums();
});

load();
updateStreak();
if (playlist.length) { renderList(); playVideo(0); }
