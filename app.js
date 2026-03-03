// Catch global errors
window.onerror = function(message, source, lineno, colno, error) {
    alert("خطأ في النظام: " + message + "\nفي السطر: " + lineno);
    return true;
};

// --- Supabase Configuration ---
const supabaseUrl = 'https://zxqqbzdeieiggdugercb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cXFiemRlaWVpZ2dkdWdlcmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDg1MTAsImV4cCI6MjA4ODEyNDUxMH0.spajaBDdy99eVQr58Dp7Xx7A6IdWeiAy2xTlizuQTTc';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Initialize Local Dexie (Keep as local bridge for offline)
const db = new Dexie("ReemAlKhaleejDB");
db.version(4).stores({
    users: "++id, username, password, permissions",
    products: "++id, name, buyPrice, sellPrice, quantity",
    sales: "++id, date, customer, items, total",
    purchases: "++id, date, supplier, items, total",
    returns: "++id, date, type, party, items, total",
    expenses: "++id, date, category, amount, description",
    projects: "++id, name, customer, location, costs, contractValue, profit, date",
    maintenances: "++id, date, customer, location, type, status, description"
});

db.open().catch(err => console.error("Dexie error:", err));

// Sidebar Toggle
const openSidebarBtn = document.getElementById('open-sidebar');
if(openSidebarBtn) openSidebarBtn.onclick = () => document.getElementById('sidebar').classList.add('active');
const closeSidebarBtn = document.getElementById('close-sidebar');
if(closeSidebarBtn) closeSidebarBtn.onclick = () => document.getElementById('sidebar').classList.remove('active');

// Auth logic
async function checkAuth() {
    try {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            const userStr = sessionStorage.getItem('currentUser');
            if (userStr) {
                const user = JSON.parse(userStr);
                document.getElementById('login-screen').classList.add('hidden');
                document.getElementById('main-layout').classList.remove('hidden');
                document.getElementById('user-display').innerText = user.username;
                applyPermissions(user);
                updateDashboard();
            } else { logout(); }
        }
    } catch (err) { logout(); }
}

function applyPermissions(user) {
    if (user.username === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('hidden'));
        return;
    }
    const perms = user.permissions || [];
    document.querySelectorAll('.nav-item').forEach(el => {
        const onClickAttr = el.getAttribute('onclick');
        if (!onClickAttr) return;
        const match = onClickAttr.match(/'([^']+)'/);
        if (match) {
            const section = match[1];
            if (section !== 'dashboard' && !perms.includes(section)) el.classList.add('hidden');
            else el.classList.remove('hidden');
        }
    });
    document.querySelectorAll('.admin-only').forEach(el => el.classList.add('hidden'));
}

function toEnglish(str) {
    return str.replace(/[٠١٢٣٤٥٦٧٨٩]/g, d => d.charCodeAt(0) - 1632).replace(/[۰۱۲۳۴۵۶۷۸۹]/g, d => d.charCodeAt(0) - 1776);
}

// Login Process
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const user = toEnglish(document.getElementById('username').value.trim());
        const pass = toEnglish(document.getElementById('password').value.trim());
        if (user.toLowerCase() === "admin" && pass === "1234") {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify({username: 'admin', permissions: ['all']}));
            location.reload();
            return;
        }
        const dbUser = await db.users.where('username').equalsIgnoreCase(user).first();
        if (dbUser && dbUser.password === pass) {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify(dbUser));
            location.reload();
        } else { alert("خطأ في البيانات"); }
    };
}

function logout() { sessionStorage.clear(); location.reload(); }

function showSection(section) {
    const sections = ['dashboard', 'sales', 'purchases', 'inventory', 'expenses', 'projects', 'reports', 'users', 'returns', 'maintenance'];
    sections.forEach(s => { const el = document.getElementById(`section-${s}`); if (el) el.classList.add('hidden'); });
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.remove('hidden');
    document.getElementById('section-title').innerText = getSectionTitle(section);
    document.getElementById('sidebar').classList.remove('active');
    if (section === 'inventory') renderInventory();
    if (section === 'sales') renderSales();
    if (section === 'purchases') renderPurchases();
    if (section === 'returns') renderReturns();
    if (section === 'expenses') renderExpenses();
    if (section === 'projects') renderProjects();
    if (section === 'maintenance') renderMaintenances();
    if (section === 'users') renderUsers();
    if (section === 'dashboard') updateDashboard();
}

function getSectionTitle(s) {
    const titles = { dashboard:'لوحة التحكم', sales:'المبيعات', purchases:'المشتريات', inventory:'المخزن', expenses:'المصاريف', projects:'المشاريع', users:'المستخدمين', returns:'المرتجعات', maintenance:'الصيانات' };
    return titles[s] || s;
}

// --- MODULES ---

// 1. Inventory
async function renderInventory() {
    const { data, error } = await _supabase.from('products').select('*').order('name');
    if(error) { console.error(error); return; }
    const tbody = document.getElementById('inventory-list');
    if(tbody) tbody.innerHTML = data.map(p => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-5 font-bold">${p.name}</td>
            <td class="p-5 text-center bg-blue-50 font-black">${p.quantity}</td>
            <td class="p-5 text-center text-emerald-600">${p.buyPrice.toFixed(2)}</td>
            <td class="p-5 text-center text-indigo-600">${p.sellPrice.toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick="deleteProduct(${p.id})" class="text-rose-500"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openInventoryModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right">
            <h3 class="text-2xl font-black mb-6">إضافة منتج</h3>
            <form id="prod-form" class="space-y-4">
                <input type="text" id="p-name" placeholder="الاسم" class="w-full p-4 border rounded-2xl text-right" required>
                <div class="grid grid-cols-2 gap-4">
                    <input type="number" id="p-buy" placeholder="سعر الشراء" class="p-4 border rounded-2xl text-right" required>
                    <input type="number" id="p-sell" placeholder="سعر البيع" class="p-4 border rounded-2xl text-right" required>
                </div>
                <input type="number" id="p-qty" placeholder="الكمية" class="w-full p-4 border rounded-2xl text-right" required>
                <button type="submit" class="w-full bg-blue-900 text-white py-4 rounded-2xl font-bold">حفظ</button>
            </form>
        </div>
    `;
    document.getElementById('prod-form').onsubmit = async (e) => {
        e.preventDefault();
        const p = { 
            name: document.getElementById('p-name').value, 
            buyPrice: Number(document.getElementById('p-buy').value), 
            sellPrice: Number(document.getElementById('p-sell').value), 
            quantity: Number(document.getElementById('p-qty').value) 
        };
        await _supabase.from('products').insert([p]);
        closeModal(); renderInventory();
    };
};

window.deleteProduct = async (id) => { if(confirm("حذف؟")) { await _supabase.from('products').delete().eq('id', id); renderInventory(); } };

// 2. Invoicing
async function renderSales() {
    const { data, error } = await _supabase.from('sales').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('sales-list');
    if(tbody && data) tbody.innerHTML = data.map(s => `
        <tr class="border-b border-slate-100">
            <td class="p-5 font-bold">#${s.id}</td>
            <td class="p-5">${s.date}</td>
            <td class="p-5">${s.customer || s.party}</td>
            <td class="p-5 text-center text-emerald-600 font-black">${s.total.toFixed(2)}</td>
            <td class="p-5 text-center"><button onclick="viewSupabaseInvoice('${s.id}', 'sales')" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold">عرض</button></td>
        </tr>
    `).join('');
}

async function renderPurchases() {
    const { data, error } = await _supabase.from('purchases').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('purchases-list');
    if(tbody && data) tbody.innerHTML = data.map(p => `
        <tr class="border-b border-slate-100">
            <td class="p-5 font-bold">#${p.id}</td>
            <td class="p-5">${p.date}</td>
            <td class="p-5">${p.supplier || p.party}</td>
            <td class="p-5 text-center text-amber-600 font-black">${p.total.toFixed(2)}</td>
            <td class="p-5 text-center"><button onclick="viewSupabaseInvoice('${p.id}', 'purchases')" class="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-sm font-bold">عرض</button></td>
        </tr>
    `).join('');
}

window.viewSupabaseInvoice = async (id, table) => {
    const { data, error } = await _supabase.from(table).select('*').eq('id', id).single();
    if(data) viewInvoiceData(data.id, data);
};

function viewInvoiceData(id, inv) {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div id="printable-area" class="p-8 bg-white text-right max-w-[148mm] mx-auto">
            <h1 class="text-2xl font-black mb-4">فاتورة #${id}</h1>
            <p>التاريخ: ${inv.date}</p>
            <p>الطرف الثاني: ${inv.party || inv.customer || inv.supplier}</p>
            <table class="w-full border my-4">
                <thead class="bg-slate-50 text-xs"><tr><th class="p-2 border">الصنف</th><th class="p-2 border">الكمية</th><th class="p-2 border">السعر</th></tr></thead>
                <tbody>${inv.items.map(it => `<tr><td class="p-2 border">${it.name}</td><td class="p-2 border text-center">${it.qty}</td><td class="p-2 border text-center">${it.price}</td></tr>`).join('')}</tbody>
            </table>
            <p class="text-xl font-black">الإجمالي: ${inv.total.toFixed(2)} ر.س</p>
            <div class="mt-6 flex gap-2 no-print">
                <button onclick="window.print()" class="bg-blue-900 text-white px-6 py-2 rounded-lg">طباعة</button>
                <button onclick="closeModal()" class="bg-slate-100 px-6 py-2 rounded-lg">إغلاق</button>
            </div>
        </div>
    `;
}

window.openInvoiceModal = async (type) => {
    const { data: products } = await _supabase.from('products').select('*');
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    let items = [];
    
    content.innerHTML = `
        <div class="p-6 bg-white text-right">
            <h3 class="text-2xl font-black mb-6">${type === 'sale' ? 'مبيعات جديدة' : 'مشتريات جديدة'}</h3>
            <div class="space-y-4">
                <input type="text" id="party-name" placeholder="الاسم" class="w-full p-3 border rounded-xl text-right bg-slate-50">
                <div class="flex gap-2">
                    <select id="item-select" class="flex-1 p-3 border rounded-xl text-right">
                        <option value="">-- اختر صنفاً --</option>
                        ${products.map(p => `<option value="${p.id}">${p.name} (${p.quantity})</option>`).join('')}
                    </select>
                    <input type="number" id="item-qty" placeholder="الكمية" class="w-24 p-3 border rounded-xl text-right">
                    <button onclick="addItemToInvoice()" class="bg-blue-600 text-white px-4 rounded-xl">+</button>
                </div>
                <table class="w-full text-sm border-collapse"><tbody id="invoice-items-list"></tbody></table>
                <div class="bg-slate-900 text-white p-4 rounded-xl flex justify-between"><span>الإجمالي:</span><span id="invoice-total">0.00</span></div>
                <button onclick="saveSupabaseInvoice('${type}')" class="w-full bg-emerald-600 text-white py-4 rounded-xl font-black">حفظ الفاتورة</button>
            </div>
        </div>
    `;

    window.addItemToInvoice = () => {
        const id = parseInt(document.getElementById('item-select').value);
        const qty = parseInt(document.getElementById('item-qty').value);
        const product = products.find(p => p.id === id);
        if(!product || !qty) return;
        const price = type === 'sale' ? product.sellPrice : product.buyPrice;
        items.push({ productId: id, name: product.name, qty, price, total: qty * price });
        document.getElementById('invoice-items-list').innerHTML = items.map(it => `<tr><td class="p-2 border">${it.name}</td><td class="p-2 border text-center">${it.qty}</td><td class="p-2 border text-center">${it.total.toFixed(2)}</td></tr>`).join('');
        document.getElementById('invoice-total').innerText = items.reduce((s, it) => s + it.total, 0).toFixed(2);
    };

    window.saveSupabaseInvoice = async (t) => {
        const party = document.getElementById('party-name').value;
        const total = items.reduce((s, it) => s + it.total, 0);
        if(!party || items.length === 0) return alert("بيانات ناقصة");
        const entry = { date: new Date().toLocaleDateString('en-CA'), total, items, party };
        await _supabase.from(t === 'sale' ? 'sales' : 'purchases').insert([entry]);
        // Update stock in Supabase
        for(let it of items) {
            const prod = products.find(p => p.id === it.productId);
            const newQty = t === 'sale' ? prod.quantity - it.qty : prod.quantity + it.qty;
            await _supabase.from('products').update({ quantity: newQty }).eq('id', it.productId);
        }
        alert("تم الحفظ"); closeModal(); showSection(t === 'sale' ? 'sales' : 'purchases');
    };
};

// 3. Returns
async function renderReturns() {
    const { data } = await _supabase.from('returns').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('returns-list');
    if(tbody && data) tbody.innerHTML = data.map(r => `<tr class="border-b border-slate-100"><td class="p-5">${r.date}</td><td class="p-5">${r.type === 'sale' ? 'مرتجع مبيعات' : 'مرتجع مشتريات'}</td><td class="p-5">${r.party}</td><td class="p-5 text-center font-black">${r.total.toFixed(2)}</td></tr>`).join('');
}

window.openReturnModal = async () => {
    const { data: products } = await _supabase.from('products').select('*');
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    let items = [];
    content.innerHTML = `
        <div class="p-6 bg-white text-right">
            <h3 class="text-xl font-black mb-4">مرتجع جديد</h3>
            <select id="ret-type" class="w-full p-3 border mb-4"><option value="sale">مرتجع مبيعات</option><option value="purchase">مرتجع مشتريات</option></select>
            <input type="text" id="ret-party" placeholder="الاسم" class="w-full p-3 border mb-4">
            <button onclick="saveSupabaseReturn()" class="w-full bg-rose-600 text-white py-4 rounded-xl font-bold">حفظ المرتجع</button>
        </div>
    `;
    window.saveSupabaseReturn = async () => {
        const type = document.getElementById('ret-type').value;
        const party = document.getElementById('ret-party').value;
        await _supabase.from('returns').insert([{ date: new Date().toLocaleDateString('en-CA'), type, party, total: 0, items: [] }]);
        alert("تم الحفظ"); closeModal(); renderReturns();
    };
};

// 4. Projects
async function renderProjects() {
    const { data } = await _supabase.from('projects').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('projects-list');
    if(tbody && data) tbody.innerHTML = data.map(p => `<tr class="border-b border-slate-100"><td class="p-5 font-bold">${p.name}</td><td class="p-5">${p.customer}</td><td class="p-5 text-center text-rose-600 font-bold">${p.totalCosts.toFixed(2)}</td><td class="p-5 text-center text-blue-900 font-bold">${p.contractValue.toFixed(2)}</td><td class="p-5 text-center text-emerald-600 font-black">${p.profit.toFixed(2)}</td></tr>`).join('');
}

window.openProjectModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="p-8 bg-white text-right"><h3 class="text-2xl font-black mb-6">مشروع جديد</h3><input type="text" id="proj-name" placeholder="اسم المشروع" class="w-full p-4 border mb-4"><input type="text" id="proj-cust" placeholder="العميل" class="w-full p-4 border mb-4"><input type="number" id="proj-val" placeholder="قيمة العقد" class="w-full p-4 border mb-4"><button onclick="saveSupabaseProject()" class="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">حفظ</button></div>`;
    window.saveSupabaseProject = async () => {
        const p = { name: document.getElementById('proj-name').value, customer: document.getElementById('proj-cust').value, contractValue: Number(document.getElementById('proj-val').value), totalCosts: 0, profit: Number(document.getElementById('proj-val').value), date: new Date().toLocaleDateString('en-CA') };
        await _supabase.from('projects').insert([p]);
        alert("تم"); closeModal(); renderProjects();
    };
};

// 5. Maintenance
async function renderMaintenances() {
    const { data } = await _supabase.from('maintenances').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('maintenance-list');
    if(tbody && data) tbody.innerHTML = data.map(m => `<tr class="border-b border-slate-100"><td class="p-5">${m.date}</td><td class="p-5 font-bold">${m.customer}</td><td class="p-5">${m.location}</td><td class="p-5 text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${m.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">${m.status === 'completed' ? 'مكتملة' : 'قيد التنفيذ'}</span></td></tr>`).join('');
}

window.openMaintenanceModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="p-8 bg-white text-right"><h3 class="text-2xl font-black mb-6">صيانة جديدة</h3><input type="text" id="m-cust" placeholder="العميل" class="w-full p-4 border mb-4"><input type="text" id="m-loc" placeholder="الموقع" class="w-full p-4 border mb-4"><button onclick="saveSupabaseMaint()" class="w-full bg-cyan-600 text-white py-4 rounded-xl font-bold">حفظ</button></div>`;
    window.saveSupabaseMaint = async () => {
        const m = { customer: document.getElementById('m-cust').value, location: document.getElementById('m-loc').value, date: new Date().toLocaleDateString('en-CA'), status: 'pending' };
        await _supabase.from('maintenances').insert([m]);
        alert("تم"); closeModal(); renderMaintenances();
    };
};

// 6. Expenses
async function renderExpenses() {
    const { data } = await _supabase.from('expenses').select('*').order('date', { ascending: false });
    const tbody = document.getElementById('expenses-list');
    if(tbody && data) tbody.innerHTML = data.map(e => `<tr><td class="p-5">${e.date}</td><td class="p-5">${e.category}</td><td class="p-5 font-black text-rose-600">${e.amount.toFixed(2)}</td></tr>`).join('');
}

window.openExpenseModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="p-8 bg-white text-right"><h3 class="text-2xl font-black mb-6">مصرف جديد</h3><input type="text" id="e-cat" placeholder="البند" class="w-full p-4 border mb-4"><input type="number" id="e-val" placeholder="المبلغ" class="w-full p-4 border mb-4"><button onclick="saveSupabaseExpense()" class="w-full bg-rose-600 text-white py-4 rounded-xl font-bold">حفظ</button></div>`;
    window.saveSupabaseExpense = async () => {
        const e = { category: document.getElementById('e-cat').value, amount: Number(document.getElementById('e-val').value), date: new Date().toLocaleDateString('en-CA') };
        await _supabase.from('expenses').insert([e]);
        alert("تم"); closeModal(); renderExpenses(); updateDashboard();
    };
};

// 7. Users
async function renderUsers() {
    const data = await db.users.toArray();
    const tbody = document.getElementById('users-list');
    if(tbody) tbody.innerHTML = data.map(u => `<tr class="border-b border-slate-100"><td class="p-5 font-bold">${u.username}</td><td class="p-5 text-center"><button onclick="deleteUser(${u.id})" class="text-rose-500"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('');
}

window.openUserModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="p-8 bg-white text-right"><h3 class="text-2xl font-black mb-6">مستخدم جديد</h3><form id="u-form" class="space-y-4"><input type="text" id="u-name" placeholder="الاسم" class="w-full p-4 border rounded-xl" required><input type="password" id="u-pass" placeholder="كلمة المرور" class="w-full p-4 border rounded-xl" required><button type="submit" class="w-full bg-slate-900 text-white py-4 rounded-xl">إنشاء</button></form></div>`;
    document.getElementById('u-form').onsubmit = async (e) => {
        e.preventDefault();
        await db.users.add({ username: document.getElementById('u-name').value, password: document.getElementById('u-pass').value, permissions: ['sales'] });
        closeModal(); renderUsers();
    };
};

window.deleteUser = async (id) => { if(confirm("حذف؟")) { await db.users.delete(id); renderUsers(); } };

async function updateDashboard() {
    const { data: s } = await _supabase.from('sales').select('total');
    const { data: p } = await _supabase.from('purchases').select('total');
    const { data: e } = await _supabase.from('expenses').select('amount');
    const ts = (s || []).reduce((a, b) => a + b.total, 0);
    const tp = (p || []).reduce((a, b) => a + b.total, 0);
    const te = (e || []).reduce((a, b) => a + b.amount, 0);
    document.getElementById('total-sales').innerText = ts.toFixed(2);
    document.getElementById('total-purchases').innerText = tp.toFixed(2);
    document.getElementById('total-expenses').innerText = te.toFixed(2);
    document.getElementById('net-profit').innerText = (ts - tp - te).toFixed(2);
}

function closeModal() { document.getElementById('modal-container').classList.add('hidden'); }
window.closeModal = closeModal;

// Initialize
checkAuth();
