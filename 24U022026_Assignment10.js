const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// --- DATABASE INITIALIZATION ---
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) return console.error(err.message);
    console.log("Connected to ICA2S Database [Registry: 24U022007]");
    
    // Auto-run schema.sql on startup if it exists
    const schemaPath = path.join(__dirname, 'schema.sql');
    if (fs.existsSync(schemaPath)) {
        const schema = fs.readFileSync(schemaPath, 'utf8');
        db.exec(schema, (err) => {
            if (err) console.error("Schema Error:", err.message);
            else console.log("Database Schema Synchronized.");
        });
    }
});

app.use(express.json());
app.use(session({
    secret: 'ica2s_auth_24u022007',
    resave: false,
    saveUninitialized: false
}));

// --- API ROUTES ---

app.get('/api/sections', (req, res) => {
    db.all("SELECT * FROM ConferenceSections", (err, rows) => res.json(rows));
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.run("INSERT INTO Users (username, password, full_name) VALUES (?, ?, ?)", [username, password, username], (err) => {
        if (err) return res.status(400).json({ success: false, message: "User exists." });
        res.json({ success: true });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM Users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            req.session.user = row.username;
            res.json({ success: true, username: row.username });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
});

app.get('/api/user-details', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    db.get("SELECT * FROM Users WHERE username = ?", [req.session.user], (err, row) => res.json(row));
});

app.post('/api/update-account', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { username, password, full_name, email, bio } = req.body;
    const oldUsername = req.session.user;

    db.run(
        "UPDATE Users SET username = ?, password = ?, full_name = ?, email = ?, bio = ? WHERE username = ?",
        [username, password, full_name, email, bio, oldUsername],
        function(err) {
            if (err) return res.status(500).json({ success: false, message: "Update conflict" });
            req.session.user = username;
            res.json({ success: true, message: "Profile Updated Successfully" });
        }
    );
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/status', (req, res) => {
    res.json({ loggedIn: !!req.session.user, username: req.session.user || null });
});

// --- FRONTEND UI ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="scholar-id" content="24U022007">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ICA2S 2026 | Researcher Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #0b0f1a; color: #cbd5e1; }
        .glass-nav { background: rgba(11, 15, 26, 0.85); backdrop-filter: blur(20px); border-bottom: 1px solid rgba(255,255,255,0.05); }
        .hero-gradient { background: radial-gradient(circle at 70% 20%, #1e1b4b 0%, #0b0f1a 100%); }
        .card-base { background: #111827; border: 1px solid rgba(255,255,255,0.05); border-radius: 2rem; }
        .input-field { background: #161b2a; border: 1px solid #1e293b; color: white; padding: 0.85rem 1.25rem; border-radius: 0.75rem; width: 100%; outline: none; transition: 0.3s; }
        .input-field:focus { border-color: #6366f1; box-shadow: 0 0 0 4px rgba(99,102,241,0.1); }
        .modal { display: none; background: rgba(0,0,0,0.8); backdrop-filter: blur(12px); position: fixed; inset: 0; z-index: 100; align-items: center; justify-content: center; }
        .modal.active { display: flex; }
    </style>
</head>
<body>

    <nav class="fixed top-0 w-full z-50 glass-nav">
        <div class="max-w-7xl mx-auto px-8 h-20 flex justify-between items-center">
            <div class="flex flex-col cursor-pointer" onclick="location.reload()">
                <span class="font-extrabold text-2xl text-white tracking-tight">ICA2S <span class="text-indigo-500">2026</span></span>
                <span class="text-[9px] uppercase tracking-[0.3em] text-slate-500 font-bold">Node-Registry: 24U022007</span>
            </div>
            
            <div class="flex space-x-8 text-xs font-bold uppercase tracking-widest items-center">
                <a href="#" onclick="loadContent()" class="hover:text-indigo-400 transition">Home</a>
                <a href="javascript:showAccount()" id="nav-account" class="hidden text-emerald-400 hover:text-emerald-300">My Profile</a>
                <div id="auth-ui">
                    <button onclick="toggleModal()" id="btn-login" class="bg-indigo-600 px-6 py-2.5 rounded-full text-white hover:bg-indigo-500 transition shadow-lg shadow-indigo-900/20">Login</button>
                    <div id="user-profile" class="hidden flex items-center gap-6">
                        <span id="welcome-msg" class="text-indigo-300 italic tracking-wide"></span>
                        <button onclick="handleLogout()" class="text-slate-500 hover:text-red-400 transition underline decoration-slate-700 underline-offset-4 text-[10px]">Logout</button>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <header class="pt-48 pb-24 hero-gradient text-center">
        <h1 id="page-title" class="text-5xl md:text-7xl font-extrabold text-white tracking-tighter mb-4">Future of Systems.</h1>
        <p class="text-slate-400 max-w-lg mx-auto text-sm md:text-base px-6">Connecting global innovators at the intersection of intelligence and engineering.</p>
    </header>

    <main id="main-target" class="px-6 max-w-5xl mx-auto pb-32"></main>

    <div id="auth-modal" class="modal">
        <div class="card-base w-full max-w-md p-10 relative">
            <h2 id="modal-title" class="text-3xl font-bold mb-2 text-white text-center">Secure Login</h2>
            <p class="text-slate-500 text-center mb-10 text-xs uppercase tracking-widest">ICA2S Verification Required</p>
            <form onsubmit="handleAuth(event)" class="space-y-4">
                <input type="text" id="username" placeholder="Username" required class="input-field">
                <input type="password" id="password" placeholder="Password" required class="input-field">
                <button type="submit" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl mt-6 hover:bg-indigo-500 transition">Enter Portal</button>
            </form>
            <button onclick="toggleMode()" id="toggle-btn" class="w-full mt-6 text-indigo-400 text-xs font-bold uppercase tracking-widest">Create Account</button>
            <button onclick="toggleModal()" class="w-full mt-4 text-slate-700 text-[10px] uppercase font-bold">Discard</button>
        </div>
    </div>

    <script>
        let isLoginMode = true;

        async function api(act, method = 'GET', body = null) {
            const opt = { method, headers: { 'Content-Type': 'application/json' } };
            if(body) opt.body = JSON.stringify(body);
            const res = await fetch(\`/api/\${act}\`, opt);
            return res.json();
        }

        async function loadContent() {
            document.getElementById('page-title').innerText = "Future of Systems.";
            const data = await api('sections');
            document.getElementById('main-target').innerHTML = \`
                <div class="grid md:grid-cols-2 gap-8">
                    \${data.map(item => \`
                        <div class="card-base p-8 hover:border-indigo-500/30 transition-all duration-500 group">
                            <h2 class="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500 mb-6 group-hover:text-indigo-400">\${item.section_name}</h2>
                            <div class="prose prose-invert prose-sm text-slate-400 leading-relaxed">\${item.content}</div>
                        </div>
                    \`).join('')}
                </div>
            \`;
        }

        async function showAccount() {
            const user = await api('user-details');
            document.getElementById('page-title').innerText = "My Researcher Profile";
            
            document.getElementById('main-target').innerHTML = \`
                <div class="grid md:grid-cols-12 gap-10">
                    <div class="md:col-span-4 space-y-6">
                        <div class="card-base p-8 text-center bg-indigo-900/5">
                            <div class="w-24 h-24 bg-gradient-to-tr from-indigo-600 to-indigo-400 rounded-[2rem] mx-auto mb-6 flex items-center justify-center text-4xl font-bold text-white shadow-2xl shadow-indigo-500/20">
                                \${(user.full_name || user.username)[0].toUpperCase()}
                            </div>
                            <h3 class="font-extrabold text-white text-xl">\${user.full_name || user.username}</h3>
                            <p class="text-indigo-400 text-[10px] font-bold uppercase tracking-widest mt-2">Verified Academic Member</p>
                            <div class="mt-8 pt-8 border-t border-white/5 flex justify-between text-[10px] font-bold text-slate-500 uppercase">
                                <span>Joined</span>
                                <span class="text-slate-300">\${user.created_at.split(' ')[0]}</span>
                            </div>
                        </div>
                        <div class="card-base p-6 border-emerald-500/10 bg-emerald-500/5">
                            <h4 class="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-3">Submission Record</h4>
                            <p class="text-xs text-slate-400 leading-relaxed">No active submissions found for Scholar ID 24U022007. Papers will appear here once peer-reviewed.</p>
                        </div>
                    </div>

                    <div class="md:col-span-8">
                        <div class="card-base p-10">
                            <h3 class="text-2xl font-bold text-white mb-8">Personal Information</h3>
                            <form onsubmit="handleUpdate(event)" class="space-y-6">
                                <div class="grid md:grid-cols-2 gap-6">
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-2 block">Username / Handle</label>
                                        <input type="text" id="up-username" value="\${user.username}" class="input-field" required>
                                    </div>
                                    <div>
                                        <label class="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-2 block">Full Legal Name</label>
                                        <input type="text" id="up-fullname" value="\${user.full_name || ''}" class="input-field" placeholder="e.g. Ishan Kumar">
                                    </div>
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-2 block">Contact Email</label>
                                    <input type="email" id="up-email" value="\${user.email || ''}" class="input-field" placeholder="researcher@iiit.edu">
                                </div>
                                <div>
                                    <label class="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-2 block">Research Biography</label>
                                    <textarea id="up-bio" class="input-field h-32 resize-none" placeholder="Tell us about your technical expertise...">\${user.bio || ''}</textarea>
                                </div>
                                <div class="pt-4 border-t border-white/5">
                                    <label class="text-[10px] font-bold text-slate-500 uppercase ml-2 mb-2 block text-indigo-400">Security Credentials</label>
                                    <input type="password" id="up-password" value="\${user.password}" class="input-field border-indigo-500/20" required>
                                </div>
                                <button class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-5 rounded-2xl transition shadow-xl shadow-indigo-900/30">Synchronize Global Profile</button>
                            </form>
                            <p id="up-msg" class="mt-6 text-center text-sm hidden font-bold"></p>
                        </div>
                    </div>
                </div>
            \`;
        }

        async function handleUpdate(e) {
            e.preventDefault();
            const res = await api('update-account', 'POST', {
                username: document.getElementById('up-username').value,
                password: document.getElementById('up-password').value,
                full_name: document.getElementById('up-fullname').value,
                email: document.getElementById('up-email').value,
                bio: document.getElementById('up-bio').value
            });
            const msg = document.getElementById('up-msg');
            msg.innerText = res.message;
            msg.className = "mt-6 text-center text-sm font-bold " + (res.success ? "text-emerald-400" : "text-red-400");
            msg.classList.remove('hidden');
            if(res.success) checkAuthStatus();
        }

        async function checkAuthStatus() {
            const data = await api('status');
            document.getElementById('btn-login').classList.toggle('hidden', data.loggedIn);
            document.getElementById('user-profile').classList.toggle('hidden', !data.loggedIn);
            document.getElementById('nav-account').classList.toggle('hidden', !data.loggedIn);
            if(data.loggedIn) document.getElementById('welcome-msg').innerText = "Active: " + data.username;
        }

        async function handleAuth(e) {
            e.preventDefault();
            const res = await api(isLoginMode ? 'login' : 'register', 'POST', {
                username: document.getElementById('username').value,
                password: document.getElementById('password').value
            });
            if (res.success) {
                if (isLoginMode) { toggleModal(); checkAuthStatus(); }
                else { alert("Registry Successful. Please Login."); toggleMode(); }
            } else alert(res.message);
        }

        async function handleLogout() { await api('logout', 'POST'); location.reload(); }
        function toggleModal() { document.getElementById('auth-modal').classList.toggle('active'); }
        function toggleMode() {
            isLoginMode = !isLoginMode;
            document.getElementById('modal-title').innerText = isLoginMode ? 'Secure Login' : 'New Registry';
            document.getElementById('toggle-btn').innerText = isLoginMode ? 'Create Account' : 'Back to Login';
        }

        loadContent();
        checkAuthStatus();
    </script>

    <footer class="text-center py-20 border-t border-white/5 text-[9px] uppercase tracking-[0.6em] text-slate-600">
        ICA2S 2026 Distribution System | Ref: 24U022007 | IIIT Project 10
    </footer>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(\`ICA2S Core running at http://localhost:\${PORT}\`);
});
