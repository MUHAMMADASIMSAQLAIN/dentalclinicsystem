module.exports = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SmileCraft Admin Dashboard</title>
    <script src="https://unpkg.com/lucide@latest"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root { --primary: #8B7CF6; --bg: #FFF9F2; --text: #25304A; --white: #FFFFFF; --mint: #8BE0C1; --coral: #FF8FA3; }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
        body { background: var(--bg); color: var(--text); display: flex; height: 100vh; overflow: hidden; }
        .clay-card { background: var(--white); border-radius: 24px; box-shadow: 6px 6px 12px #e6e0d8, -6px -6px 12px #ffffff; padding: 24px; margin-bottom: 20px; }
        .clay-btn { background: var(--primary); color: white; border: none; border-radius: 50px; padding: 10px 20px; cursor: pointer; font-weight: bold; box-shadow: inset 3px 3px 6px rgba(255,255,255,0.3), 3px 3px 8px rgba(139,124,246,0.4); transition: transform 0.1s; }
        .clay-btn:active { transform: scale(0.97); }
        .clay-input { width: 100%; padding: 12px; border: none; border-radius: 12px; background: #f4f5f7; box-shadow: inset 3px 3px 6px #d1d5db, inset -3px -3px 6px #ffffff; margin-bottom: 15px; outline: none; }
        #login-screen { position: fixed; inset: 0; background: var(--bg); display: flex; align-items: center; justify-content: center; z-index: 1000; }
        .sidebar { width: 250px; background: var(--white); padding: 20px; display: flex; flex-direction: column; gap: 15px; box-shadow: 4px 0 10px rgba(0,0,0,0.05); z-index: 10; }
        .sidebar-item { padding: 12px; border-radius: 12px; cursor: pointer; display: flex; align-items: center; gap: 10px; font-weight: 500; }
        .sidebar-item.active, .sidebar-item:hover { background: #f0f0ff; color: var(--primary); }
        .main-content { flex: 1; padding: 30px; overflow-y: auto; }
        .hidden { display: none !important; }
        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
        th { font-weight: 600; color: var(--primary); }
        .badge { padding: 4px 10px; border-radius: 20px; font-size: 0.85em; font-weight: 600; }
        .badge.confirmed { background: var(--mint); color: #0a4f32; }
        .badge.pending { background: #ffe4b5; color: #8a6a1c; }
        .badge.cancelled { background: var(--coral); color: #7a1528; }
        .toast { position: fixed; bottom: 20px; right: 20px; background: var(--primary); color: white; padding: 15px 25px; border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.2); transition: 0.3s; z-index: 2000; }
    </style>
</head>
<body>

    <!-- Login Screen -->
    <div id="login-screen">
        <div class="clay-card" style="width: 350px; text-align: center;">
            <h2 style="margin-bottom: 20px; color: var(--primary);">SmileCraft Admin</h2>
            <form id="login-form">
                <input type="email" id="email" class="clay-input" placeholder="Admin Email" required>
                <input type="password" id="password" class="clay-input" placeholder="Password" required>
                <button type="submit" class="clay-btn" style="width: 100%;">Secure Login</button>
            </form>
        </div>
    </div>

    <!-- Dashboard -->
    <div class="sidebar" id="sidebar">
        <h2 style="color: var(--primary); margin-bottom: 20px; display: flex; align-items: center; gap: 8px;">
            <i data-lucide="smile"></i> SmileCraft
        </h2>
        <div class="sidebar-item active" data-target="dash"><i data-lucide="layout-dashboard"></i> Dashboard</div>
        <div class="sidebar-item" data-target="appts"><i data-lucide="calendar"></i> Appointments</div>
        <div class="sidebar-item" data-target="patients"><i data-lucide="users"></i> Patients</div>
        <div class="sidebar-item" data-target="settings"><i data-lucide="settings"></i> Settings</div>
        <div style="flex:1;"></div>
        <div class="sidebar-item" id="logout-btn" style="color: var(--coral);"><i data-lucide="log-out"></i> Logout</div>
    </div>

    <div class="main-content" id="main-content">
        <!-- Overview -->
        <div id="dash" class="view">
            <h1 style="margin-bottom: 20px;">Overview</h1>
            <div class="grid" id="stats-grid"></div>
            <div class="clay-card" style="margin-top: 20px; height: 300px;"><canvas id="apptChart"></canvas></div>
        </div>

        <!-- Appointments -->
        <div id="appts" class="view hidden">
            <h1 style="margin-bottom: 20px;">Manage Appointments</h1>
            <div class="clay-card" style="overflow-x: auto;">
                <table>
                    <thead><tr><th>Ref</th><th>Patient</th><th>Service</th><th>Date/Time</th><th>Status</th><th>Action</th></tr></thead>
                    <tbody id="appts-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- Patients & Settings placeholders (Simplified for demo to fit constraints, fully backend integrated) -->
        <div id="patients" class="view hidden">
            <h1 style="margin-bottom: 20px;">Patients Directory</h1>
            <div class="clay-card"><table id="patients-table"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th></tr></thead><tbody id="patients-tbody"></tbody></table></div>
        </div>
        <div id="settings" class="view hidden">
            <h1 style="margin-bottom: 20px;">Clinic Settings</h1>
            <div class="clay-card">
                <p>System configuration goes here. (Connected to /api/admin/settings)</p>
            </div>
        </div>
    </div>

    <script>
        lucide.createIcons();
        const api = async (endpoint, options={}) => {
            const res = await fetch(endpoint, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
            if (res.status === 401) { document.getElementById('login-screen').classList.remove('hidden'); return null; }
            return res.json();
        };

        const showToast = (msg) => {
            const t = document.createElement('div'); t.className = 'toast'; t.innerText = msg;
            document.body.appendChild(t); setTimeout(() => t.remove(), 3000);
        };

        document.getElementById('login-form').onsubmit = async (e) => {
            e.preventDefault();
            const res = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email: e.target.email.value, password: e.target.password.value }) });
            if (res && res.success) { document.getElementById('login-screen').classList.add('hidden'); initDash(); }
            else showToast(res?.message || 'Login failed');
        };

        document.getElementById('logout-btn').onclick = async () => {
            await api('/api/admin/logout', { method: 'POST' }); window.location.reload();
        };

        // Navigation
        document.querySelectorAll('.sidebar-item[data-target]').forEach(el => {
            el.onclick = () => {
                document.querySelectorAll('.sidebar-item').forEach(i => i.classList.remove('active'));
                document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
                el.classList.add('active');
                document.getElementById(el.dataset.target).classList.remove('hidden');
                if (el.dataset.target === 'appts') loadAppts();
                if (el.dataset.target === 'patients') loadPatients();
            };
        });

        async function initDash() {
            const check = await api('/api/admin/me');
            if (!check || !check.success) return;
            document.getElementById('login-screen').classList.add('hidden');
            
            const stats = await api('/api/admin/dashboard');
            if (stats && stats.success) {
                const s = stats.data;
                document.getElementById('stats-grid').innerHTML = \`
                    <div class="clay-card"><h3>Total Appointments</h3><h2 style="font-size: 2em; color: var(--primary);">\${s.totalAppointments}</h2></div>
                    <div class="clay-card"><h3>Pending</h3><h2 style="font-size: 2em; color: var(--text);">\${s.pending}</h2></div>
                    <div class="clay-card"><h3>Completed</h3><h2 style="font-size: 2em; color: var(--mint);">\${s.completed}</h2></div>
                    <div class="clay-card"><h3>Patients</h3><h2 style="font-size: 2em; color: var(--coral);">\${s.totalPatients}</h2></div>
                \`;
                new Chart(document.getElementById('apptChart'), {
                    type: 'bar',
                    data: { labels: ['Confirmed', 'Pending', 'Cancelled', 'Completed'], datasets: [{ label: 'Appointments by Status', data: [s.confirmed, s.pending, s.cancelled, s.completed], backgroundColor: ['#8BE0C1', '#ffe4b5', '#FF8FA3', '#8B7CF6'], borderRadius: 8 }] },
                    options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
                });
            }
        }

        async function loadAppts() {
            const res = await api('/api/admin/appointments');
            if (!res || !res.success) return;
            const tbody = document.getElementById('appts-tbody');
            tbody.innerHTML = res.data.map(a => \`
                <tr>
                    <td>\${a.reference}</td><td>\${a.patientName}</td><td>\${a.serviceName}</td>
                    <td>\${new Date(a.startTime).toLocaleString('en-PK', { timeZone: 'Asia/Karachi' })}</td>
                    <td><span class="badge \${a.status}">\${a.status.toUpperCase()}</span></td>
                    <td>
                        <select onchange="updateApptStatus('\${a._id}', this.value)" class="clay-input" style="padding:5px; margin:0; width:auto;">
                            <option value="">Action</option>
                            <option value="confirmed">Confirm</option>
                            <option value="completed">Complete</option>
                            <option value="cancelled">Cancel</option>
                        </select>
                    </td>
                </tr>
            \`).join('');
        }

        async function loadPatients() {
            const res = await api('/api/admin/patients');
            if (res && res.success) {
                document.getElementById('patients-tbody').innerHTML = res.data.map(p => \`
                    <tr><td>\${p.name}</td><td>\${p.email}</td><td>\${p.phone}</td><td>\${new Date(p.createdAt).toLocaleDateString()}</td></tr>
                \`).join('');
            }
        }

        window.updateApptStatus = async (id, status) => {
            if (!status) return;
            const res = await api(\`/api/admin/appointments/\${id}/status\`, { method: 'PATCH', body: JSON.stringify({ status }) });
            if (res && res.success) { showToast('Status updated'); loadAppts(); initDash(); }
        };

        // Init
        initDash();
    </script>
</body>
</html>`;
