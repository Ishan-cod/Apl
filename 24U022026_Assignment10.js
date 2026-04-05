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
        
        // 1. Auto-create the Users table
        db.run(`
            CREATE TABLE IF NOT EXISTS Users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL
            )
        `);
        
        // 2. Auto-create ConferenceSections table and insert data
        db.run(`
            CREATE TABLE IF NOT EXISTS ConferenceSections (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                section_name TEXT NOT NULL,
                content TEXT NOT NULL
            )
        `, () => {
            // Check if the table is empty. If it is, insert the data!
            db.get("SELECT COUNT(*) as count FROM ConferenceSections", (err, row) => {
                if (row && row.count === 0) {
                    console.log("Inserting conference content into database...");
                    
                    const stmt = db.prepare("INSERT INTO ConferenceSections (section_name, content) VALUES (?, ?)");
                    
                    const sections = [
                        ['Home', 'Welcome to the 2026 International Conference on Advanced Systems (ICA2S). This premier event brings together researchers, scientists, and industry practitioners to explore the latest innovations in technology. Our mission is to foster collaboration across diverse engineering disciplines.'],
                        ['Committee', '<h3 class="font-bold text-blue-700 mb-2">Steering Committee</h3><ul class="list-disc pl-5 mb-4"><li>Dr. Aris Thompson (Chair)</li><li>Dr. Sarah Jenkins (Co-Chair)</li></ul><h3 class="font-bold text-blue-700 mb-2 mt-4">Technical Program Committee</h3><ul class="list-disc pl-5"><li>Prof. Michael Chen - MIT</li><li>Dr. Linda Ross - Stanford University</li><li>Dr. Kevin Patel - IIT Delhi</li></ul>'],
                        ['Important Dates', '<div class="overflow-x-auto"><table class="w-full border-collapse border border-gray-300 text-left"><tr class="bg-gray-100"><th class="p-2 border">Event</th><th class="p-2 border">Date</th></tr><tr><td class="p-2 border">Paper Submission</td><td class="p-2 border">October 15, 2025</td></tr><tr><td class="p-2 border">Acceptance Notification</td><td class="p-2 border">November 20, 2025</td></tr><tr><td class="p-2 border">Camera Ready Paper</td><td class="p-2 border">December 01, 2025</td></tr><tr><td class="p-2 border">Conference Dates</td><td class="p-2 border">February 26-28, 2026</td></tr></table></div>'],
                        ['Speakers', '<strong>Keynote Speaker 1:</strong> Dr. Elena Rodriguez - "The Future of Quantum Computing in AI".<br><br><strong>Keynote Speaker 2:</strong> Mr. Julian Vane - "Sustainable Infrastructure for Smart Cities".'],
                        ['Workshop', 'Join our full-day workshop on "Cloud-Native Architectures" led by industry experts from Google and AWS. Participants will receive a certificate of completion and hands-on lab access.'],
                        ['Submission', 'All papers must be original and not simultaneously submitted to another journal or conference. Submissions should be made through the EasyChair portal. Use the standard double-column IEEE template.'],
                        ['Special Session', 'We are hosting a special track on "Cyber-Physical Systems in Healthcare." If you wish to lead a sub-session, please contact the secretariat with your proposal by November 1st.'],
                        ['Registration', '<ul class="list-disc pl-5"><li>Regular Author: $450</li><li>Student Author: $250</li><li>Attendee: $150</li></ul><p class="mt-4 text-sm text-red-600 font-bold">Late registration after Jan 1st will incur a $100 surcharge.</p>'],
                        ['Sponsorship', 'Elevate your brand by sponsoring ICA2S 2026. We offer Diamond, Gold, and Silver tiers. Benefits include logo placement on the website, dedicated exhibit booths, and speaking slots.'],
                        ['Contact', 'For general inquiries: info@ica2s.vercel.app<br>For submission help: support@ica2s.vercel.app<br>Phone: +1 (555) 123-4567']
                    ];

                    sections.forEach(s => stmt.run(s[0], s[1]));
                    stmt.finalize();
                    console.log("Conference content loaded successfully!");
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

// 1. Get Content from DB
app.get('/api/sections', (req, res) => {
    db.all("SELECT * FROM ConferenceSections", [], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json(rows);
    });
});

// 2. Register New User
app.post('/api/register', (req, res) => {
    const { username, password } = req.body;
    db.run("INSERT INTO Users (username, password) VALUES (?, ?)", [username, password], function(err) {
        if (err) {
            if(err.message.includes("UNIQUE")) return res.status(400).json({ success: false, message: "Username already exists" });
            return res.status(500).json({ success: false, message: "Database error" });
        }
        res.json({ success: true, message: "Registration successful. Please login." });
    });
});

// 3. Login User
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM Users WHERE username = ? AND password = ?", [username, password], (err, row) => {
        if (err) return res.status(500).json({ success: false, message: "Database error" });
        if (row) {
            req.session.user = row.username; // Set Session
            res.json({ success: true, message: "Login successful", username: row.username });
        } else {
            res.status(401).json({ success: false, message: "Invalid credentials" });
        }
    });
});

// 4. Logout User
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true, message: "Logged out" });
});

// 5. Check Auth Status
app.get('/api/status', (req, res) => {
    if (req.session.user) res.json({ loggedIn: true, username: req.session.user });
    else res.json({ loggedIn: false });
});

// --- FRONTEND (Single Page Application) ---
// --- FRONTEND (Single Page Application) ---
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en" class="scroll-smooth">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ICA2S 2026 - Scholar: 24U022007</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;600;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-nav { background: rgba(15, 23, 42, 0.8); backdrop-filter: blur(12px); border-bottom: 1px solid rgba(255,255,255,0.1); }
        .hero-gradient { background: radial-gradient(circle at top right, #1e1b4b, #0f172a); }
        .section-card { transition: all 0.3s ease; border: 1px solid rgba(255,255,255,0.05); }
        .section-card:hover { border-color: #6366f1; transform: translateY(-4px); }
        .modal { display: none; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); }
        .modal.active { display: flex; }
    </style>
</head>
<body class="bg-[#0f172a] text-slate-200">

    <nav class="fixed top-0 w-full z-50 glass-nav">
        <div class="max-w-7xl mx-auto px-6 h-20 flex justify-between items-center">
            <div class="flex flex-col">
                <span class="font-extrabold text-2xl tracking-tight text-white">ICA2S <span class="text-indigo-500">2026</span></span>
                <span class="text-[10px] uppercase tracking-[0.2em] text-slate-400 font-semibold">Advanced Systems Conference</span>
            </div>
            
            <button onclick="document.getElementById('m-menu').classList.toggle('hidden')" class="md:hidden text-white">
                <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="M4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>

            <div class="hidden md:flex space-x-8 text-xs font-bold uppercase tracking-widest items-center">
                <a href="#Home" class="hover:text-indigo-400 transition-colors">Home</a>
                <a href="#Committee" class="hover:text-indigo-400 transition-colors">Committee</a>
                <a href="#Important-Dates" class="hover:text-indigo-400 transition-colors">Dates</a>
                <a href="#Speakers" class="hover:text-indigo-400 transition-colors">Speakers</a>
                <a href="#Registration" class="hover:text-indigo-400 transition-colors">Registration</a>
                
                <div id="desktop-auth-container" class="pl-6 border-l border-slate-700">
                    <button onclick="toggleModal()" id="btn-login" class="bg-indigo-600 text-white px-5 py-2.5 rounded-full hover:bg-indigo-500 transition shadow-lg shadow-indigo-500/20">Login</button>
                    <div id="user-profile" class="hidden flex items-center gap-4">
                        <span id="welcome-msg" class="text-indigo-300 italic"></span>
                        <button onclick="handleLogout()" class="text-slate-400 hover:text-red-400 transition underline underline-offset-4">Logout</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="m-menu" class="hidden md:hidden bg-slate-900 border-b border-slate-800 p-6 flex flex-col space-y-4 uppercase text-xs font-bold tracking-widest">
            <a href="#Home" onclick="closeMobile()">Home</a>
            <a href="#Committee" onclick="closeMobile()">Committee</a>
            <a href="#Important-Dates" onclick="closeMobile()">Dates</a>
            <div id="mobile-auth-container" class="pt-4 border-t border-slate-800">
                <button onclick="toggleModal(); closeMobile()" id="m-btn-login" class="text-indigo-400">Login / Register</button>
                <div id="m-user-profile" class="hidden flex flex-col gap-3">
                    <span id="m-welcome-msg" class="text-indigo-300"></span>
                    <button onclick="handleLogout(); closeMobile()" class="text-red-400 text-left">Logout</button>
                </div>
            </div>
        </div>
    </nav>

    <header class="pt-40 pb-20 hero-gradient">
        <div class="max-w-5xl mx-auto px-6 text-center">
            <span class="inline-block px-4 py-1.5 mb-6 text-xs font-bold tracking-widest text-indigo-400 uppercase bg-indigo-500/10 border border-indigo-500/20 rounded-full">
                Global Academic Exchange
            </span>
            <h1 class="text-5xl md:text-7xl font-extrabold text-white mb-6 tracking-tight">Future of Technology.</h1>
            <p class="text-slate-400 text-lg max-w-2xl mx-auto">Explore groundbreaking research and connect with industry leaders at the 2026 International Conference on Advanced Systems.</p>
        </div>
    </header>

    <main id="main-target" class="px-6 max-w-5xl mx-auto space-y-24"></main>

    <footer class="bg-slate-950 border-t border-slate-900 py-20 mt-32">
        <div class="max-w-5xl mx-auto px-6 grid md:grid-cols-2 gap-12 items-center">
            <div class="text-left">
                <h3 class="text-white font-bold text-xl mb-2">ICA2S 2026</h3>
                <p class="text-slate-500 text-sm">&copy; 2026 International Conference on Advanced Systems. All rights reserved.</p>
            </div>
            <div class="md:text-right border-l md:border-l-0 md:border-r border-indigo-500/30 pr-6">
                <p class="text-indigo-400 font-bold text-lg">Ishan Jaiswal</p>
                <p class="text-slate-400 text-sm">Scholar Number: <span class="font-mono text-white">24U022007</span></p>
            </div>
        </div>
    </footer>

    <div id="auth-modal" class="modal fixed inset-0 z-[100] items-center justify-center p-4">
        <div class="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-md p-8 relative">
            <button onclick="toggleModal()" class="absolute top-6 right-6 text-slate-500 hover:text-white transition text-2xl">&times;</button>
            
            <h2 id="modal-title" class="text-3xl font-extrabold text-white mb-2 text-center">Welcome Back</h2>
            <p class="text-slate-400 text-center text-sm mb-8">Access your ICA2S dashboard</p>
            
            <form id="auth-form" onsubmit="handleAuth(event)">
                <div class="mb-5">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Username</label>
                    <input type="text" id="username" required class="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:outline-none focus:border-indigo-500 text-white transition">
                </div>
                <div class="mb-8">
                    <label class="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Password</label>
                    <input type="password" id="password" required class="w-full bg-slate-800/50 border border-slate-700 p-3 rounded-xl focus:outline-none focus:border-indigo-500 text-white transition">
                </div>
                
                <p id="auth-error" class="text-red-400 text-sm mb-4 text-center hidden"></p>
                <p id="auth-success" class="text-emerald-400 text-sm mb-4 text-center hidden"></p>

                <button type="submit" id="submit-btn" class="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-500 transition shadow-xl shadow-indigo-500/20">Sign In</button>
            </form>
            
            <div class="mt-8 text-center text-sm">
                <span id="toggle-text" class="text-slate-500">New to ICA2S?</span> 
                <button onclick="toggleMode()" id="toggle-btn" class="text-indigo-400 font-bold hover:text-indigo-300 ml-1">Create an account</button>
            </div>
        </div>
    </div>

    <script>
        let isLoginMode = true;

        async function loadContent() {
            try {
                const res = await fetch('/api/sections');
                const data = await res.json();
                const target = document.getElementById('main-target');
                target.innerHTML = '';
                
                data.forEach(item => {
                    const id = item.section_name.replace(/\\s+/g, '-');
                    target.innerHTML += \`
                        <section id="\${id}" class="scroll-mt-32">
                            <div class="flex items-center gap-4 mb-8">
                                <div class="h-px flex-1 bg-slate-800"></div>
                                <h2 class="text-xs font-black tracking-[0.4em] text-indigo-500 uppercase">
                                    \${item.section_name}
                                </h2>
                                <div class="h-[8px] w-[8px] rounded-full bg-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.8)]"></div>
                            </div>
                            <div class="section-card bg-slate-900/40 p-10 rounded-[2rem] text-slate-300 leading-relaxed text-lg border border-slate-800/50">
                                \${item.content}
                            </div>
                        </section>
                    \`;
                });
            } catch (err) {
                console.error("Failed to load content", err);
            }
        }

        async function checkAuthStatus() {
            const res = await fetch('/api/status');
            const data = await res.json();
            
            const btnLogin = document.getElementById('btn-login');
            const userProfile = document.getElementById('user-profile');
            const msg = document.getElementById('welcome-msg');
            const mBtnLogin = document.getElementById('m-btn-login');
            const mUserProfile = document.getElementById('m-user-profile');
            const mMsg = document.getElementById('m-welcome-msg');

            if (data.loggedIn) {
                btnLogin.classList.add('hidden');
                userProfile.classList.remove('hidden');
                msg.innerText = \`Hello, \${data.username}\`;
                mBtnLogin.classList.add('hidden');
                mUserProfile.classList.remove('hidden');
                mMsg.innerText = \`Hello, \${data.username}\`;
            } else {
                btnLogin.classList.remove('hidden');
                userProfile.classList.add('hidden');
                mBtnLogin.classList.remove('hidden');
                mUserProfile.classList.add('hidden');
            }
        }

        async function handleAuth(e) {
            e.preventDefault();
            const username = document.getElementById('username').value;
            const password = document.getElementById('password').value;
            const endpoint = isLoginMode ? '/api/login' : '/api/register';
            const errorEl = document.getElementById('auth-error');
            const successEl = document.getElementById('auth-success');
            
            errorEl.classList.add('hidden');
            successEl.classList.add('hidden');

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const result = await res.json();

            if (result.success) {
                successEl.innerText = result.message;
                successEl.classList.remove('hidden');
                if (isLoginMode) {
                    setTimeout(() => {
                        toggleModal();
                        checkAuthStatus();
                        document.getElementById('auth-form').reset();
                    }, 1000);
                } else {
                    setTimeout(() => toggleMode(), 1500);
                }
            } else {
                errorEl.innerText = result.message;
                errorEl.classList.remove('hidden');
            }
        }

        async function handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            checkAuthStatus();
        }

        function toggleModal() {
            document.getElementById('auth-modal').classList.toggle('active');
            document.getElementById('auth-error').classList.add('hidden');
            document.getElementById('auth-success').classList.add('hidden');
        }

        function toggleMode() {
            isLoginMode = !isLoginMode;
            document.getElementById('modal-title').innerText = isLoginMode ? 'Welcome Back' : 'Create Account';
            document.getElementById('submit-btn').innerText = isLoginMode ? 'Sign In' : 'Join Now';
            document.getElementById('toggle-text').innerText = isLoginMode ? "New to ICA2S?" : "Already registered?";
            document.getElementById('toggle-btn').innerText = isLoginMode ? "Create an account" : "Sign in instead";
        }

        function closeMobile() {
            document.getElementById('m-menu').classList.add('hidden');
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
