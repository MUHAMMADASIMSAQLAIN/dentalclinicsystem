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
        .management-form { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; margin:16px 0; }
        .manage-item { display:flex; gap:14px; align-items:center; padding:12px 0; border-bottom:1px solid #eee; }
        .manage-item img { width:64px; height:64px; object-fit:cover; border-radius:12px; background:#f4f5f7; }
        .manage-item .item-copy { flex:1; min-width:0; }
        .manage-item .item-actions { display:flex; gap:8px; flex-wrap:wrap; }
        .clay-btn.secondary { background:#fff; color:var(--text); border:1px solid #ddd; box-shadow:none; }
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
        <div class="sidebar-item" data-target="specialists"><i data-lucide="stethoscope"></i> Specialists</div>
        <div class="sidebar-item" data-target="services"><i data-lucide="sparkles"></i> Premium Services</div>
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
        <div id="specialists" class="view hidden">
            <h1 style="margin-bottom:20px;">Manage Specialists</h1>
            <div class="clay-card">
                <h3 id="dentist-form-title">Add a specialist</h3>
                <form id="dentist-form"><input type="hidden" id="dentist-id">
                    <div class="management-form">
                        <input class="clay-input" id="dentist-name" placeholder="Full name *" required>
                        <input class="clay-input" id="dentist-specialty" placeholder="Specialty *" required>
                        <input class="clay-input" id="dentist-qualifications" placeholder="Qualifications">
                        <input class="clay-input" id="dentist-experience" placeholder="Experience">
                        <input class="clay-input" id="dentist-image" placeholder="Image URL (optional)"><label>Or upload a photo from your gallery <input class="clay-input" id="dentist-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><img id="dentist-image-preview" alt="Photo preview" style="display:none;width:90px;height:90px;object-fit:cover;border-radius:12px;">
                        <textarea class="clay-input" id="dentist-description" placeholder="Biography"></textarea>
                    </div><button class="clay-btn" type="submit">Save specialist</button>
                    <button class="clay-btn secondary" type="button" onclick="resetDentistForm()">Clear</button>
                </form>
            </div><div class="clay-card"><h3>Current specialists</h3><div id="dentist-list">Loading...</div></div>
        </div>
        <div id="services" class="view hidden">
            <h1 style="margin-bottom:20px;">Manage Premium Services</h1>
            <div class="clay-card"><h3 id="service-form-title">Add a service</h3>
                <form id="service-form"><input type="hidden" id="service-id">
                    <div class="management-form">
                        <input class="clay-input" id="service-name" placeholder="Service name *" required>
                        <input class="clay-input" id="service-price" type="number" min="0" step="1" placeholder="Price (PKR) *" required>
                        <input class="clay-input" id="service-duration" type="number" min="1" step="1" placeholder="Duration (minutes) *" required>
                        <input class="clay-input" id="service-image" placeholder="Image URL (optional)"><label>Or upload a service image <input class="clay-input" id="service-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><img id="service-image-preview" alt="Service image preview" style="display:none;width:120px;height:80px;object-fit:cover;border-radius:12px;">
                        <textarea class="clay-input" id="service-description" placeholder="Service information"></textarea>
                    </div><button class="clay-btn" type="submit">Save service</button>
                    <button class="clay-btn secondary" type="button" onclick="resetServiceForm()">Clear</button>
                </form>
            </div><div class="clay-card"><h3>Current services</h3><div id="service-list">Loading...</div></div>
        </div>
        <div id="settings" class="view hidden">
            <h1 style="margin-bottom:20px;">Clinic Settings</h1><div class="clay-card">
                <form id="settings-form">
                    <label>Clinic name</label><input class="clay-input" id="setting-name" required>
                    <label>Logo image URL (optional)</label><input class="clay-input" id="setting-logo" placeholder="Image URL (optional)"><label>Or upload a logo from your gallery <input class="clay-input" id="setting-logo-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif"></label><img id="setting-logo-preview" alt="Logo preview" style="display:none;max-width:160px;max-height:100px;object-fit:contain;">
                    <label>About the clinic</label><textarea class="clay-input" id="setting-about"></textarea>
                    <label>Address</label><input class="clay-input" id="setting-address">
                    <div class="management-form"><input class="clay-input" id="setting-phone" placeholder="Phone">
                    <input class="clay-input" id="setting-email" type="email" placeholder="Email">
                    <input class="clay-input" id="setting-hours" placeholder="Opening hours"></div>
                    <button class="clay-btn" type="submit">Save clinic information</button>
                </form>
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
                if (el.dataset.target === 'specialists') loadDentists();
                if (el.dataset.target === 'services') loadServices();
                if (el.dataset.target === 'settings') loadSettings();
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



        async function uploadImageFile(file) {
            if(!file)return '';
            if(!/^image\/(jpeg|png|webp|gif)$/.test(file.type)){showToast('Choose a JPG, PNG, WEBP or GIF image');throw new Error('Unsupported image type');}
            if(file.size>3.5*1024*1024){showToast('Choose an image smaller than 3.5 MB');throw new Error('Image too large');}
            const dataUrl=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Could not read image'));reader.readAsDataURL(file);});
            const r=await api('/api/admin/upload-image',{method:'POST',body:JSON.stringify({dataUrl})});
            if(!r?.success||!r.url)throw new Error(r?.message||'Image upload failed');
            return r.url;
        }
        function bindImageUpload(fileId,urlId,previewId){
            const file=document.getElementById(fileId),url=document.getElementById(urlId),preview=document.getElementById(previewId);
            file.addEventListener('change',()=>{const f=file.files?.[0];if(!f){preview.style.display='none';return;}if(f.size>3.5*1024*1024){showToast('Choose an image smaller than 3.5 MB');file.value='';return;}preview.src=URL.createObjectURL(f);preview.style.display='block';url.dataset.gallerySelected='true';});
        }
        bindImageUpload('dentist-image-file','dentist-image','dentist-image-preview');
        bindImageUpload('service-image-file','service-image','service-image-preview');
        bindImageUpload('setting-logo-file','setting-logo','setting-logo-preview');
        async function getImageValue(fileId,urlId){const file=document.getElementById(fileId).files?.[0];if(file)return await uploadImageFile(file);return document.getElementById(urlId).value.trim();}
        const safeText = value => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        async function loadDentists() {
            const r=await api('/api/admin/dentists'); if(!r||!r.success)return showToast(r?.message||'Could not load specialists');
            window.dentistData=r.data;
            document.getElementById('dentist-list').innerHTML=r.data.map(d=>\`<div class="manage-item"><img src="\${safeText(d.imageUrl||'')}" alt="" onerror="this.style.visibility='hidden'"><div class="item-copy"><strong>\${safeText(d.name)}</strong><p>\${safeText(d.specialty)} · \${safeText(d.experience)}</p><small>\${safeText(d.qualifications)}</small><p>\${d.active?'Visible on website':'Hidden on website'}</p></div><div class="item-actions"><button class="clay-btn secondary" onclick="editDentist('\${d._id}')">Edit</button><button class="clay-btn secondary" onclick="deleteDentist('\${d._id}')">Delete</button></div></div>\`).join('')||'<p>No specialists yet.</p>';
        }
        window.editDentist=id=>{const d=window.dentistData.find(x=>x._id===id);if(!d)return;[['dentist-id','_id'],['dentist-name','name'],['dentist-specialty','specialty'],['dentist-qualifications','qualifications'],['dentist-experience','experience'],['dentist-image','imageUrl'],['dentist-description','description']].forEach(([el,k])=>document.getElementById(el).value=d[k]||'');document.getElementById('dentist-form-title').innerText='Edit specialist';window.scrollTo({top:0,behavior:'smooth'});};
        window.resetDentistForm=()=>{document.getElementById('dentist-form').reset();document.getElementById('dentist-image-file').value='';document.getElementById('dentist-image-preview').style.display='none';document.getElementById('dentist-id').value='';document.getElementById('dentist-form-title').innerText='Add a specialist';};
        document.getElementById('dentist-form').onsubmit=async e=>{e.preventDefault();const id=document.getElementById('dentist-id').value;const body={name:document.getElementById('dentist-name').value,specialty:document.getElementById('dentist-specialty').value,qualifications:document.getElementById('dentist-qualifications').value,experience:document.getElementById('dentist-experience').value,imageUrl:await getImageValue('dentist-image-file','dentist-image'),description:document.getElementById('dentist-description').value};const r=await api(id?'/api/admin/dentists/'+id:'/api/admin/dentists',{method:id?'PUT':'POST',body:JSON.stringify(body)});if(r?.success){showToast('Specialist saved');resetDentistForm();loadDentists();}else showToast(r?.message||'Could not save specialist');};
        window.deleteDentist=async id=>{if(!confirm('Delete this specialist?'))return;const r=await api('/api/admin/dentists/'+id,{method:'DELETE'});if(r?.success){showToast('Specialist deleted');loadDentists();}else showToast('Could not delete specialist');};
        async function loadServices(){const r=await api('/api/admin/services');if(!r||!r.success)return showToast(r?.message||'Could not load services');window.serviceData=r.data;document.getElementById('service-list').innerHTML=r.data.map(s=>\`<div class="manage-item"><img src="\${safeText(s.imageUrl||'')}" alt="" onerror="this.style.visibility='hidden'"><div class="item-copy"><strong>\${safeText(s.name)}</strong><p>PKR \${Number(s.price||0).toLocaleString()} · \${Number(s.duration||0)} minutes</p><p>\${safeText(s.description)}</p><small>\${s.active?'Visible on website':'Hidden on website'}</small></div><div class="item-actions"><button class="clay-btn secondary" onclick="editService('\${s._id}')">Edit</button><button class="clay-btn secondary" onclick="deleteService('\${s._id}')">Delete</button></div></div>\`).join('')||'<p>No services yet.</p>'; }
        window.editService=id=>{const s=window.serviceData.find(x=>x._id===id);if(!s)return;[['service-id','_id'],['service-name','name'],['service-price','price'],['service-duration','duration'],['service-image','imageUrl'],['service-description','description']].forEach(([el,k])=>document.getElementById(el).value=s[k]??'');document.getElementById('service-form-title').innerText='Edit service';window.scrollTo({top:0,behavior:'smooth'});};
        window.resetServiceForm=()=>{document.getElementById('service-form').reset();document.getElementById('service-image-file').value='';document.getElementById('service-image-preview').style.display='none';document.getElementById('service-id').value='';document.getElementById('service-form-title').innerText='Add a service';};
        document.getElementById('service-form').onsubmit=async e=>{e.preventDefault();const id=document.getElementById('service-id').value;const body={name:document.getElementById('service-name').value,price:Number(document.getElementById('service-price').value),duration:Number(document.getElementById('service-duration').value),imageUrl:await getImageValue('service-image-file','service-image'),description:document.getElementById('service-description').value};const r=await api(id?'/api/admin/services/'+id:'/api/admin/services',{method:id?'PUT':'POST',body:JSON.stringify(body)});if(r?.success){showToast('Service saved');resetServiceForm();loadServices();}else showToast(r?.message||'Could not save service');};
        window.deleteService=async id=>{if(!confirm('Delete this service?'))return;const r=await api('/api/admin/services/'+id,{method:'DELETE'});if(r?.success){showToast('Service deleted');loadServices();}else showToast('Could not delete service');};
        async function loadSettings(){const r=await api('/api/admin/settings');if(!r||!r.success)return showToast(r?.message||'Could not load settings');const s=r.data||{};[['setting-name','clinicName'],['setting-logo','logoUrl'],['setting-about','about'],['setting-address','address'],['setting-phone','phone'],['setting-email','email'],['setting-hours','hours']].forEach(([el,k])=>document.getElementById(el).value=s[k]||'');}
        document.getElementById('settings-form').onsubmit=async e=>{e.preventDefault();const body={clinicName:document.getElementById('setting-name').value,logoUrl:await getImageValue('setting-logo-file','setting-logo'),about:document.getElementById('setting-about').value,address:document.getElementById('setting-address').value,phone:document.getElementById('setting-phone').value,email:document.getElementById('setting-email').value,hours:document.getElementById('setting-hours').value};const r=await api('/api/admin/settings',{method:'PUT',body:JSON.stringify(body)});if(r?.success)showToast('Clinic information saved');else showToast(r?.message||'Could not save settings');};

        // Init
        initDash();
    </script>
</body>
</html>`;
