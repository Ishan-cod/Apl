const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const session = require('express-session');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to SQLite Database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error("Database connection error:", err.message);
    } else {
        console.log("Connected to SQLite database.");
        
        db.run(`
            CREATE TABLE IF NOT EXISTS Users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);
        
        db.run(`
            CREATE TABLE IF NOT EXISTS ConferenceSections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_name TEXT NOT NULL,
                content TEXT NOT NULL
            )
        `, () => {
            db.get("SELECT COUNT(*) as count FROM ConferenceSections", (err, row) => {
                if (row && row.count === 0) {
                    const stmt = db.prepare("INSERT INTO ConferenceSections (section_name, content) VALUES (?, ?)");
                    const sections = [
                        ['Home', 'Welcome to the 2026 ICA2S. This premier event brings together researchers to explore technology.'],
                        ['Committee', 'Steering Committee: Dr. Aris Thompson, Dr. Sarah Jenkins.'],
                        ['Important Dates', 'Conference Dates: February 26-28, 2026.'],
                        ['Speakers', 'Dr. Elena Rodriguez, Mr. Julian Vane.'],
                        ['Workshop', 'Cloud-Native Architectures by Google and AWS.'],
                        ['Submission', 'Submit via EasyChair portal using IEEE template.'],
                        ['Special Session', 'Cyber-Physical Systems in Healthcare.'],
                        ['Registration', 'Regular Author: $450, Student: $250.'],
                        ['Sponsorship', 'Diamond, Gold, and Silver tiers available.'],
                        ['Contact', 'info@ica2s.vercel.app | +1 (555) 123-4567']
                    ];
                    sections.forEach(s => stmt.run(s[0], s[1]));
                    stmt.finalize();
                }
            });
        });
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: 'ica2s_secret_key',
    resave: false,
    saveUninitialized: false
}));

// --- API ENDPOINTS ---

app.get('/api/sections', (req, res) => {
    db.all("SELECT * FROM ConferenceSections", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.run("INSERT INTO Users (username, password) VALUES (?, ?)", [username, password], function(err) {
        if (err) return res.status(400).json({ success: false, message: "Username exists" });
        res.json({ success: true, message: "Registration successful." });
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM Users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (row) {
            req.session.user = row.username;
            res.json({ success: true, message: "Login successful", username: row.username });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
});

// NEW: Get User Details
app.get('/api/user-details', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Not logged in" });
    db.get("SELECT username, password FROM Users WHERE username = ?", [req.session.user], (err, row) => {
        res.json(row);
    });
});

// NEW: Update User Details
app.post('/api/update-account', (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Unauthorized" });
    const { newUsername, newPassword } = req.body;
    const oldUsername = req.session.user;

    db.run("UPDATE Users SET username = ?, password = ? WHERE username = ?", [newUsername, newPassword, oldUsername], function(err) {
        if (err) return res.status(500).json({ success: false, message: "Update failed. Username might be taken." });
        req.session.user = newUsername; // Update session with new name
        res.json({ success: true, message: "Profile updated successfully!" });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: "Logged out" });
});

app.get('/api/status', (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, username: req.session.user });
    else res.json({ loggedIn: false });
});

// --- FRONTEND ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ICA2S 2026 - My Account</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-nav { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1); }
        .hero-gradient { background: radial-gradient(circle at top right, #1e1b4b, #0f172a); }
        .modal { display: none; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); }
        .modal.active { display: flex; }
    </style>
</head>
<body class="bg-[#0f172a] text-slate-200">

    <nav class="fixed top-0 w-full z-50 glass-nav">
        <div class="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
            <div class="flex flex-col cursor-pointer" onclick="window.location.reload()">
                <span class="font-extrabold text-2xl tracking-tight text-white">ICA2S <span class="text-indigo-500">2026</span></span>
            </div>

            <div class="hidden md:flex space-x-8 text-xs font-bold uppercase tracking-widest items-center">
                <a href="#" onclick="loadContent()" class="hover:text-indigo-400 transition-colors">Home</a>
                <a href="javascript:showAccount()" id="nav-account" class="hidden text-emerald-400 hover:text-emerald-300">My Account</a>
                
                <div id="desktop-auth-container" class="pl-6 border-l border-slate-700">
                    <button onclick="toggleModal()" id="btn-login" class="bg-indigo-600 text-white px-5 py-2.5 rounded-full">Login</button>
                    <div id="user-profile" class="hidden flex items-center gap-4">
                        <span id="welcome-msg" class="text-indigo-300 italic"></span>
                        <button onclick="handleLogout()" class="text-slate-400 hover:text-red-400 transition underline">Logout</button>
                    </div>
                </div>
            </div>
        </div>
    </nav>

    <header class="pt-40 pb-20 hero-gradient text-center">
        <h1 id="page-title" class="text-5xl font-extrabold text-white mb-4">Future of Technology.</h1>
    </header>

    <main id="main-target" class="px-6 max-w-4xl mx-auto pb-20"></main>

    <div id="auth-modal" class="modal fixed inset-0 z-[100] items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-8 relative">
            <button onclick="toggleModal()" class="absolute top-6 right-6 text-slate-500 text-2xl">&times;</button>
            <h2 id="modal-title" class="text-3xl font-bold text-white mb-8 text-center">Welcome Back</h2>
            <form id="auth-form" onsubmit="handleAuth(event)">
                <input type="text" id="username" placeholder="Username" required class="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl mb-4 text-white">
                <input type="password" id="password" placeholder="Password" required class="w-full bg-slate-800 border border-slate-700 p-3 rounded-xl mb-6 text-white">
                <p id="auth-error" class="text-red-400 text-sm mb-4 hidden"></p>
                <button type="submit" id="submit-btn" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl">Sign In</button>
            </form>
            <button onclick="toggleMode()" id="toggle-btn" class="w-full mt-4 text-indigo-400 text-sm">Create an account</button>
        </div>
    </div>

    <script>
        let isLoginMode = true;

        async function loadContent() {
            document.getElementById('page-title').innerText = "Future of Technology.";
            const res = await fetch('/api/sections');
            const data = await res.json();
            const target = document.getElementById('main-target');
            target.innerHTML = data.map(item => \`
                <section class="mb-12">
                    <h2 class="text-indigo-500 font-black uppercase tracking-widest mb-4">\${item.section_name}</h2>
                    <div class="bg-slate-900/40 p-8 rounded-3xl border border-slate-800">\${item.content}</div>
                </section>
            \`).join('');
        }

        async function showAccount() {
            document.getElementById('page-title').innerText = "My Account Settings";
            const res = await fetch('/api/user-details');
            const user = await res.json();
            
            const target = document.getElementById('main-target');
            target.innerHTML = \`
                <div class="bg-slate-900 border border-slate-800 p-10 rounded-[2rem] max-w-2xl mx-auto shadow-2xl">
                    <h3 class="text-xl font-bold mb-6 text-indigo-400">Update Your Details</h3>
                    <form onsubmit="handleUpdate(event)" class="space-y-6">
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">Current Username</label>
                            <input type="text" id="update-username" value="\${user.username}" class="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl text-white">
                        </div>
                        <div>
                            <label class="block text-xs font-bold text-slate-500 uppercase mb-2">New Password</label>
                            <input type="password" id="update-password" value="\${user.password}" class="w-full bg-slate-800 border border-slate-700 p-4 rounded-xl text-white">
                        </div>
                        <button type="submit" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl transition">Save Changes</button>
                    </form>
                    <p id="update-msg" class="mt-4 text-center hidden"></p>
                </div>
            \`;
        }

        async function handleUpdate(e) {
            e.preventDefault();
            const newUsername = document.getElementById('update-username').value;
            const newPassword = document.getElementById('update-password').value;
            const res = await fetch('/api/update-account', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ newUsername, newPassword })
            });
            const result = await res.json();
            const msgEl = document.getElementById('update-msg');
            msgEl.innerText = result.message;
            msgEl.className = \`mt-4 text-center \${result.success ? 'text-emerald-400' : 'text-red-400'}\`;
            msgEl.classList.remove('hidden');
            if(result.success) checkAuthStatus();
        }

        async function checkAuthStatus() {
            const res = await fetch('/api/status');
            const data = await res.json();
            const isAuth = data.loggedIn;
            document.getElementById('btn-login').classList.toggle('hidden', isAuth);
            document.getElementById('user-profile').classList.toggle('hidden', !isAuth);
            document.getElementById('nav-account').classList.toggle('hidden', !isAuth);
            if(isAuth) document.getElementById('welcome-msg').innerText = "Hello, " + data.username;
        }

        async function handleAuth(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const endpoint = isLoginMode ? '/api/login' : '/api/register';
            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await res.json();
            if (result.success) {
                if (isLoginMode) { toggleModal(); checkAuthStatus(); }
                else { alert("Registered! Now please login."); toggleMode(); }
            } else {
                document.getElementById('auth-error').innerText = result.message;
                document.getElementById('auth-error').classList.remove('hidden');
            }
        }

        async function handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            window.location.reload();
        }

        function toggleModal() { document.getElementById('auth-modal').classList.toggle('active'); }
        function toggleMode() {
            isLoginMode = !isLoginMode;
            document.getElementById('modal-title').innerText = isLoginMode ? 'Welcome Back' : 'Create Account';
            document.getElementById('toggle-btn').innerText = isLoginMode ? 'Create an account' : 'Back to Login';
        }

        loadContent();
        checkAuthStatus();
    </script>
</body>
</html>
    `);
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
