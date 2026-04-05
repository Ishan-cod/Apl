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
app.get('/', (req, res) => {
    res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ICA2S 2026 - Scholar Number: 24U022007</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        html { scroll-behavior: smooth; }
        section { min-height: 80vh; display: flex; flex-direction: column; justify-content: center; }
        .modal { display: none; background: rgba(0,0,0,0.6); }
        .modal.active { display: flex; }
    </style>
</head>
<body class="bg-slate-50 text-gray-900 leading-relaxed">

    <nav class="fixed top-0 w-full bg-blue-900 text-white z-50 shadow-xl">
        <div class="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
            <span class="font-black text-xl tracking-tighter">ICA2S 2026</span>
            
            <button onclick="document.getElementById('m-menu').classList.toggle('hidden')" class="md:hidden">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-width="2" d="4 6h16M4 12h16m-7 6h7"></path></svg>
            </button>

            <div class="hidden md:flex space-x-3 lg:space-x-5 text-[11px] lg:text-[13px] font-bold uppercase items-center">
                <a href="#Home" class="hover:text-yellow-400 transition">Home</a>
                <a href="#Committee" class="hover:text-yellow-400 transition">Committee</a>
                <a href="#Important-Dates" class="hover:text-yellow-400 transition">Dates</a>
                <a href="#Speakers" class="hover:text-yellow-400 transition">Speakers</a>
                <a href="#Registration" class="hover:text-yellow-400 transition">Registration</a>
                
                <div id="desktop-auth-container" class="ml-4 pl-4 border-l border-blue-700">
                    <button onclick="toggleModal()" id="btn-login" class="bg-yellow-500 text-blue-900 px-3 py-1 rounded hover:bg-yellow-400 transition">Login / Register</button>
                    <div id="user-profile" class="hidden flex items-center gap-3">
                        <span id="welcome-msg" class="text-yellow-300"></span>
                        <button onclick="handleLogout()" class="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-400 transition">Logout</button>
                    </div>
                </div>
            </div>
        </div>
        
        <div id="m-menu" class="hidden md:hidden bg-blue-800 flex flex-col p-4 space-y-3 uppercase text-xs font-bold">
            <a href="#Home" onclick="closeMobile()">Home</a>
            <a href="#Committee" onclick="closeMobile()">Committee</a>
            <a href="#Important-Dates" onclick="closeMobile()">Dates</a>
            <hr class="border-blue-700">
            <div id="mobile-auth-container">
                <button onclick="toggleModal(); closeMobile()" id="m-btn-login" class="text-yellow-400 text-left w-full">Login / Register</button>
                <div id="m-user-profile" class="hidden flex flex-col gap-2">
                    <span id="m-welcome-msg" class="text-yellow-300"></span>
                    <button onclick="handleLogout(); closeMobile()" class="text-red-400 text-left">Logout</button>
                </div>
            </div>
        </div>
    </nav>

    <main id="main-target" class="pt-20 px-6 max-w-5xl mx-auto"></main>

    <footer class="bg-blue-950 text-white py-12 text-center mt-20">
        <div class="max-w-2xl mx-auto px-4">
            <p class="opacity-70 mb-4">&copy; 2026 International Conference on Advanced Systems</p>
            <div class="border-t border-blue-800 pt-4 mt-4">
                <p class="text-lg font-semibold text-yellow-400">Ishan Jaiswal</p>
                <p class="text-sm opacity-80 mt-1">Scholar Number: <span class="font-mono">24U022007</span></p>
            </div>
        </div>
    </footer>
    <div id="auth-modal" class="modal fixed inset-0 z-[100] items-center justify-center p-4">
        <div class="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 relative">
            <button onclick="toggleModal()" class="absolute top-4 right-4 text-gray-500 hover:text-black font-bold text-xl">&times;</button>
            
            <h2 id="modal-title" class="text-2xl font-bold text-blue-900 mb-6 text-center">User Login</h2>
            
            <form id="auth-form" onsubmit="handleAuth(event)">
                <div class="mb-4">
                    <label class="block text-sm font-bold text-gray-700 mb-1">Username</label>
                    <input type="text" id="username" required class="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500">
                </div>
                <div class="mb-6">
                    <label class="block text-sm font-bold text-gray-700 mb-1">Password</label>
                    <input type="password" id="password" required class="w-full border border-gray-300 p-2 rounded focus:outline-none focus:border-blue-500">
                </div>
                
                <p id="auth-error" class="text-red-500 text-sm mb-4 text-center hidden"></p>
                <p id="auth-success" class="text-green-600 text-sm mb-4 text-center hidden"></p>

                <button type="submit" id="submit-btn" class="w-full bg-blue-900 text-white font-bold py-2 rounded hover:bg-blue-800 transition">Login</button>
            </form>
            
            <div class="mt-4 text-center text-sm text-gray-600">
                <span id="toggle-text">Don't have an account?</span> 
                <button onclick="toggleMode()" id="toggle-btn" class="text-blue-600 font-bold hover:underline">Register here</button>
            </div>
        </div>
    </div>

    <script>
        let isLoginMode = true;

        // 1. Fetch Content from Node.js / SQLite API
        async function loadContent() {
            try {
                const res = await fetch('/api/sections');
                const data = await res.json();
                const target = document.getElementById('main-target');
                target.innerHTML = '';
                
                data.forEach(item => {
                    const id = item.section_name.replace(/\\s+/g, '-');
                    target.innerHTML += \`
                        <section id="\${id}" class="py-16 border-b border-gray-200">
                            <h2 class="text-4xl font-extrabold text-blue-900 mb-8 border-l-8 border-yellow-500 pl-6 uppercase">
                                \${item.section_name}
                            </h2>
                            <div class="bg-white p-8 rounded-2xl shadow-lg text-lg text-gray-700 border border-gray-100">
                                \${item.content}
                            </div>
                        </section>
                    \`;
                });
            } catch (err) {
                console.error("Failed to load content", err);
            }
        }

        // 2. Auth State Management
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
                msg.innerText = \`Hi, \${data.username}!\`;

                mBtnLogin.classList.add('hidden');
                mUserProfile.classList.remove('hidden');
                mMsg.innerText = \`Hi, \${data.username}!\`;
            } else {
                btnLogin.classList.remove('hidden');
                userProfile.classList.add('hidden');
                
                mBtnLogin.classList.remove('hidden');
                mUserProfile.classList.add('hidden');
            }
        }

        // 3. Handle Form Submission (Login / Register)
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
                    // Registration success, switch to login
                    setTimeout(() => toggleMode(), 1500);
                }
            } else {
                errorEl.innerText = result.message;
                errorEl.classList.remove('hidden');
            }
        }

        // 4. Handle Logout
        async function handleLogout() {
            await fetch('/api/logout', { method: 'POST' });
            checkAuthStatus();
        }

        // 5. UI Helpers
        function toggleModal() {
            document.getElementById('auth-modal').classList.toggle('active');
            document.getElementById('auth-error').classList.add('hidden');
            document.getElementById('auth-success').classList.add('hidden');
        }

        function toggleMode() {
            isLoginMode = !isLoginMode;
            document.getElementById('modal-title').innerText = isLoginMode ? 'User Login' : 'Create Account';
            document.getElementById('submit-btn').innerText = isLoginMode ? 'Login' : 'Register';
            document.getElementById('toggle-text').innerText = isLoginMode ? "Don't have an account?" : "Already registered?";
            document.getElementById('toggle-btn').innerText = isLoginMode ? "Register here" : "Login here";
            document.getElementById('auth-error').classList.add('hidden');
            document.getElementById('auth-success').classList.add('hidden');
        }

        function closeMobile() {
            document.getElementById('m-menu').classList.add('hidden');
        }

        // Initialization
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
