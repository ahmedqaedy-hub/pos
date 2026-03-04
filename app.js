// Catch global errors
window.onerror = function(message, source, lineno, colno, error) {
    alert("خطأ في النظام: " + message + "\nفي السطر: " + lineno);
    return true;
};

// --- Supabase Configuration ---
const supabaseUrl = 'https://zxqqbzdeieiggdugercb.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp4cXFiemRlaWVpZ2dkdWdlcmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NDg1MTAsImV4cCI6MjA4ODEyNDUxMH0.spajaBDdy99eVQr58Dp7Xx7A6IdWeiAy2xTlizuQTTc';
const _supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Supabase is the single source of truth for all modules.

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
    const perms = parsePermissions(user.permissions);
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

function parsePermissions(value) {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [raw];
        } catch (err) {
            return [raw];
        }
    }
    return [];
}

function getCurrentUser() {
    try {
        const raw = sessionStorage.getItem('currentUser');
        return raw ? JSON.parse(raw) : null;
    } catch (err) {
        return null;
    }
}

function isAdminUser(user = getCurrentUser()) {
    return !!(user && readText(user.username).toLowerCase() === 'admin');
}

function canViewProfitAndCost(user = getCurrentUser()) {
    if (!user) return false;
    if (isAdminUser(user)) return true;
    const perms = parsePermissions(user.permissions);
    return perms.includes('financials');
}

function toEnglish(str) {
    return String(str || '')
        .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 1776));
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
        const { data: dbUser, error } = await _supabase
            .from('users')
            .select('*')
            .ilike('username', user)
            .eq('password', pass)
            .maybeSingle();
        if (!error && dbUser) {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify(dbUser));
            location.reload();
        } else {
            if (error) {
                console.error(error);
                alert("تعذر تسجيل الدخول حاليًا. تحقق من الاتصال بقاعدة البيانات.");
            } else {
                alert("خطأ في بيانات الدخول");
            }
        }
    };
}

function logout() { sessionStorage.clear(); location.reload(); }

function showSection(section) {
    const sections = ['dashboard', 'sales', 'purchases', 'inventory', 'expenses', 'treasury', 'employee-advances', 'projects', 'contracts', 'reports', 'users', 'returns', 'maintenance'];
    sections.forEach(s => { const el = document.getElementById(`section-${s}`); if (el) el.classList.add('hidden'); });
    const target = document.getElementById(`section-${section}`);
    if (target) target.classList.remove('hidden');
    document.getElementById('section-title').innerText = getSectionTitle(section);
    document.getElementById('sidebar').classList.remove('active');
    
    // Toggle close button (X) in header
    const closeBtn = document.getElementById('close-section');
    if (closeBtn) {
        if (section === 'dashboard') closeBtn.classList.add('hidden');
        else closeBtn.classList.remove('hidden');
    }

    if (section === 'inventory') renderInventory();
    if (section === 'sales') renderSales();
    if (section === 'purchases') renderPurchases();
    if (section === 'returns') renderReturns();
    if (section === 'expenses') renderExpenses();
    if (section === 'treasury') renderTreasury();
    if (section === 'employee-advances') renderEmployeeAdvances();
    if (section === 'projects') renderProjects();
    if (section === 'contracts') renderContracts();
    if (section === 'maintenance') renderMaintenances();
    if (section === 'users') renderUsers();
    if (section === 'dashboard') updateDashboard();
}

function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function formatAmount(value) {
    return safeNumber(value).toFixed(2);
}

function readText(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
    if (typeof value === 'object') {
        if (typeof value.name === 'string' && value.name.trim()) return value.name.trim();
        if (typeof value.fullName === 'string' && value.fullName.trim()) return value.fullName.trim();
    }
    return '';
}

function normalizeContractItem(rawItem = {}) {
    const description = readText(rawItem.description || rawItem.desc || rawItem.title);
    const width = rawItem.width ?? rawItem.w ?? null;
    const length = rawItem.length ?? rawItem.l ?? null;
    const qty = safeNumber(rawItem.qty ?? rawItem.quantity ?? rawItem.count);
    const unitPrice = safeNumber(rawItem.unit_price ?? rawItem.unitPrice ?? rawItem.price);
    const amountRaw = rawItem.amount ?? rawItem.total ?? rawItem.line_total;
    const amount = amountRaw === null || amountRaw === undefined || amountRaw === ''
        ? qty * unitPrice
        : safeNumber(amountRaw);
    return {
        description,
        width: width === '' ? null : (width === null ? null : safeNumber(width)),
        length: length === '' ? null : (length === null ? null : safeNumber(length)),
        qty,
        unit_price: unitPrice,
        amount
    };
}

const CONTRACT_DEFAULT_TERMS = `دفع 50% من المبلغ الإجمالي المحدد أثناء العقد مقدمًا، و50% عند الوصول أمام المنزل.
وجميع الملاحظات على ذمة المشتري ليتم قطع وتجميع الأجزاء المذكورة أعلاه، والألمنيوم بالأبعاد التي ذكرها المشتري، ولا يمكن استبدالها بمقاييس أخرى، وذلك في حالة الإلغاء أو عدم السداد في الوقت المحدد.
سيتم استقطاع 50% من إجمالي العقد كخسارة على المشتري، وبعد اكتمال المبلغ 100% (دفعات التشطيب المتفق عليها ضمن العقد) تعتبر جميع مخلفات الأبواب الألمنيوم على المشتري، ولا أمانة عند صاحب البيت أو العمارة.`;

const CONTRACT_OLD_TERMS = `1) يدفع العميل نسبة مقدم حسب المتفق عليه عند توقيع العقد.
2) يتم سداد المتبقي عند التسليم النهائي.
3) أي أعمال إضافية خارج بنود العقد يتم تسعيرها بعقد أو ملحق جديد.
4) مدة التنفيذ والضمان حسب ما هو موضح في هذا العقد.`;

function resolveContractTerms(value) {
    const raw = readText(value);
    if (!raw) return CONTRACT_DEFAULT_TERMS;
    return raw === CONTRACT_OLD_TERMS ? CONTRACT_DEFAULT_TERMS : raw;
}

function resolvePartyName(record, prioritizedKeys = []) {
    const keys = [...prioritizedKeys, 'party', 'customer', 'supplier', 'client', 'name', 'customerName', 'supplierName', 'customer_name', 'supplier_name'];
    for (const key of keys) {
        const txt = readText(record ? record[key] : '');
        if (txt) return txt;
    }
    return '-';
}

function projectExpenseCategory(projectId) {
    return `مصروف مشروع #${projectId}`;
}

function projectLegacyExpenseCategory(projectName) {
    return `مصروف مشروع: ${projectName}`;
}

const PROJECT_STATUS_VALUES = {
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed'
};

function normalizeProjectStatus(value) {
    const raw = readText(value).toLowerCase();
    if (raw === PROJECT_STATUS_VALUES.COMPLETED || raw === 'completed' || raw === 'تم التنفيذ' || raw === 'executed' || raw === 'done') {
        return PROJECT_STATUS_VALUES.COMPLETED;
    }
    return PROJECT_STATUS_VALUES.IN_PROGRESS;
}

function projectStatusLabel(value) {
    return normalizeProjectStatus(value) === PROJECT_STATUS_VALUES.COMPLETED ? 'تم التنفيذ' : 'قيد الإنشاء';
}

function projectStatusBadgeClass(value) {
    return normalizeProjectStatus(value) === PROJECT_STATUS_VALUES.COMPLETED
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-700';
}

function contractStatusLabel(value) {
    return normalizeProjectStatus(value) === PROJECT_STATUS_VALUES.COMPLETED ? 'تم التنفيذ' : 'قيد الإنشاء';
}

function contractStatusBadgeClass(value) {
    return normalizeProjectStatus(value) === PROJECT_STATUS_VALUES.COMPLETED
        ? 'bg-emerald-100 text-emerald-700'
        : 'bg-amber-100 text-amber-700';
}

function isMissingStatusColumnError(error) {
    const msg = readText(error && (error.message || error.details || error.hint)).toLowerCase();
    return msg.includes('status') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('not exist'));
    }

function isMissingMaintenanceMapColumnError(error) {
    const msg = readText(error && (error.message || error.details || error.hint)).toLowerCase();
    return msg.includes('map_url') && (msg.includes('column') || msg.includes('schema cache') || msg.includes('not exist'));
}

function resolveMaintenanceMapUrl(maintenance) {
    const explicit = readText(maintenance && maintenance.map_url);
    if (explicit) return explicit;
    const locationText = readText(maintenance && maintenance.location);
    if (/^https?:\/\/(www\.)?(google\.[^/\s]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com)/i.test(locationText)) {
        return locationText;
    }
    return '';
}

function escapeHtmlAttr(value) {
    return readText(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const PROJECT_STATUS_STORAGE_KEY = 'project_status_overrides';
const CONTRACTS_LOCAL_STORAGE_KEY = 'contracts_local_cache';
const TREASURY_LOCAL_STORAGE_KEY = 'treasury_manual_entries';
const EMPLOYEE_ADVANCES_LOCAL_STORAGE_KEY = 'employee_advances_local_entries';

function getProjectStatusOverrides() {
    try {
        const raw = localStorage.getItem(PROJECT_STATUS_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (err) {
        return {};
    }
}

function setProjectStatusOverride(projectId, status) {
    if (!projectId) return;
    const all = getProjectStatusOverrides();
    all[String(projectId)] = normalizeProjectStatus(status);
    localStorage.setItem(PROJECT_STATUS_STORAGE_KEY, JSON.stringify(all));
}

function resolveProjectStatus(project) {
    const direct = readText(project && project.status);
    if (direct) return normalizeProjectStatus(direct);
    const all = getProjectStatusOverrides();
    const fallback = all[String(project && project.id)];
    return normalizeProjectStatus(fallback || PROJECT_STATUS_VALUES.IN_PROGRESS);
}

function isContractsTableMissingError(error) {
    const code = readText(error && error.code).toUpperCase();
    const msg = readText(error && (error.message || error.details || error.hint)).toLowerCase();
    if (code === '42P01' || code === 'PGRST205') return true;
    return msg.includes('contracts') && (
        msg.includes('does not exist') ||
        msg.includes('schema cache') ||
        msg.includes('could not find') ||
        msg.includes('relation')
    );
}

function getLocalContracts() {
    try {
        const raw = localStorage.getItem(CONTRACTS_LOCAL_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function setLocalContracts(contracts) {
    localStorage.setItem(CONTRACTS_LOCAL_STORAGE_KEY, JSON.stringify(Array.isArray(contracts) ? contracts : []));
}

function ensureProjectStatusFilter() {
    const fromInput = document.getElementById('projects-from');
    if (!fromInput || !fromInput.parentElement) return null;

    let filter = document.getElementById('projects-status-filter');
    if (!filter) {
        filter = document.createElement('select');
        filter.id = 'projects-status-filter';
        filter.className = 'p-2 border rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none';
        filter.innerHTML = `
            <option value="all">كل المشاريع</option>
            <option value="in_progress">قيد الإنشاء</option>
            <option value="completed">تم التنفيذ</option>
        `;
        filter.addEventListener('change', renderProjects);

        const controlsWrap = fromInput.parentElement;
        const searchButton = controlsWrap.querySelector('button[onclick="renderProjects()"]');
        if (searchButton) {
            controlsWrap.insertBefore(filter, searchButton);
        } else {
            controlsWrap.appendChild(filter);
        }
    }

    return filter;
}

function getSectionTitle(s) {
    const navTitleEl = document.querySelector(`.nav-item[onclick="showSection('${s}')"] span`);
    if (navTitleEl && navTitleEl.textContent) {
        return navTitleEl.textContent.trim();
    }
    const titles = {
        dashboard: 'Dashboard',
        sales: 'Sales',
        purchases: 'Purchases',
        inventory: 'Inventory',
        expenses: 'Expenses',
        treasury: 'الخزينة',
        'employee-advances': 'سلف الموظفين',
        projects: 'Projects',
        contracts: 'Contracts',
        users: 'Users',
        returns: 'Returns',
        maintenance: 'Maintenance'
    };
    return titles[s] || s;
}

// --- MODULES ---

// 1. Inventory
async function renderInventory() {
    const { data, error } = await _supabase.from('products').select('*').order('name');
    if(error) { console.error(error); return; }
    const tbody = document.getElementById('inventory-list');
    const canViewFinancial = canViewProfitAndCost();
    if(tbody) tbody.innerHTML = data.map(p => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-5 font-bold">${p.name}</td>
            <td class="p-5 text-center bg-blue-50 font-black">${p.quantity}</td>
            <td class="p-5 text-center text-emerald-600">${canViewFinancial ? p.buyPrice.toFixed(2) : '***'}</td>
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
    const from = document.getElementById('sales-from').value;
    const to = document.getElementById('sales-to').value;
    let query = _supabase.from('sales').select('*');
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data, error } = await query.order('date', { ascending: false });
    
    const tbody = document.getElementById('sales-list');
    if(tbody && data) tbody.innerHTML = data.map(s => `
        <tr class="border-b border-slate-100">
            <td class="p-5 font-bold">#${s.id}</td>
            <td class="p-5">${s.date}</td>
            <td class="p-5">${resolvePartyName(s, ['customer'])}</td>
            <td class="p-5 text-center text-emerald-600 font-black">${formatAmount(s.total)}</td>
            <td class="p-5 text-center"><button onclick="viewSupabaseInvoice('${s.id}', 'sales')" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold">عرض</button></td>
        </tr>
    `).join('');
}

async function renderPurchases() {
    const from = document.getElementById('purchases-from').value;
    const to = document.getElementById('purchases-to').value;
    let query = _supabase.from('purchases').select('*');
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data, error } = await query.order('date', { ascending: false });
    
    const tbody = document.getElementById('purchases-list');
    if(tbody && data) tbody.innerHTML = data.map(p => `
        <tr class="border-b border-slate-100">
            <td class="p-5 font-bold">#${p.id}</td>
            <td class="p-5">${p.date}</td>
            <td class="p-5">${resolvePartyName(p, ['supplier'])}</td>
            <td class="p-5 text-center text-amber-600 font-black">${formatAmount(p.total)}</td>
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
            <p>الطرف الثاني: ${resolvePartyName(inv, ['party', 'customer', 'supplier'])}</p>
            <table class="w-full border my-4">
                <thead class="bg-slate-50 text-xs"><tr><th class="p-2 border">الصنف</th><th class="p-2 border">الكمية</th><th class="p-2 border">السعر</th></tr></thead>
                <tbody>${inv.items.map(it => `<tr><td class="p-2 border">${it.name}</td><td class="p-2 border text-center">${it.qty}</td><td class="p-2 border text-center">${it.price}</td></tr>`).join('')}</tbody>
            </table>
            <p class="text-xl font-black">الإجمالي: ${formatAmount(inv.total)} ر.س</p>
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
            <h3 class="text-2xl font-black mb-6">${type === 'sale' ? 'فاتورة مبيعات جديدة' : 'فاتورة مشتريات جديدة'}</h3>
            <div class="space-y-4">
                <input type="text" id="party-name" placeholder="${type === 'sale' ? 'اسم العميل' : 'اسم المورد'}" class="w-full p-3 border rounded-xl text-right bg-slate-50">
                <div class="flex gap-2">
                    <select id="item-select" class="flex-1 p-3 border rounded-xl text-right">
                        <option value="">-- اختر صنفًا --</option>
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

        // If it's a sale, we can link it to a project if the customer matches
        if (t === 'sale') {
            const { data: proj } = await _supabase.from('projects').select('*').eq('customer', party).single();
            if (proj) {
                const newCosts = (proj.totalCosts || 0); // Assuming sales are revenue, not costs
                // In a real ERP, we might subtract from contract or add to revenue. 
                // Keep project profit synced after related sales.
                const newProfit = proj.contractValue - proj.totalCosts; 
                await _supabase.from('projects').update({ profit: newProfit }).eq('id', proj.id);
            }
        }

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
    const from = document.getElementById('returns-from').value;
    const to = document.getElementById('returns-to').value;
    let query = _supabase.from('returns').select('*');
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data } = await query.order('date', { ascending: false });
    
    const tbody = document.getElementById('returns-list');
    if(tbody && data) tbody.innerHTML = data.map(r => `<tr class="border-b border-slate-100"><td class="p-5">${r.date}</td><td class="p-5">${r.type === 'sale' ? 'مرتجع مبيعات' : 'مرتجع مشتريات'}</td><td class="p-5">${resolvePartyName(r, ['party'])}</td><td class="p-5 text-center font-black">${formatAmount(r.total)}</td></tr>`).join('');
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
    const canViewFinancial = canViewProfitAndCost();
    const statusFilterEl = ensureProjectStatusFilter();
    const statusFilter = statusFilterEl ? statusFilterEl.value : 'all';
    const opsHeader = document.querySelector('#section-projects thead tr th:last-child');
    if (opsHeader) opsHeader.textContent = 'الحالة / العمليات';
    const costHeader = document.getElementById('projects-cost-header');
    const profitHeader = document.getElementById('projects-profit-header');
    if (costHeader) costHeader.classList.toggle('hidden', !canViewFinancial);
    if (profitHeader) profitHeader.classList.toggle('hidden', !canViewFinancial);

    const from = document.getElementById('projects-from').value;
    const to = document.getElementById('projects-to').value;
    let query = _supabase.from('projects').select('*');
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data } = await query.order('date', { ascending: false });
    
    const tbody = document.getElementById('projects-list');
    const filtered = (data || []).filter(p => statusFilter === 'all' || resolveProjectStatus(p) === statusFilter);
    if(tbody) tbody.innerHTML = filtered.map(p => `
        <tr class="border-b border-slate-100">
            <td class="p-5 font-bold">${readText(p.name) || '-'}</td>
            <td class="p-5">${resolvePartyName(p, ['customer'])}</td>
            <td class="p-5 text-center text-rose-600 font-bold ${canViewFinancial ? '' : 'hidden'}">${formatAmount(p.totalCosts)}</td>
            <td class="p-5 text-center text-blue-900 font-bold">${formatAmount(p.contractValue)}</td>
            <td class="p-5 text-center text-emerald-600 font-black ${canViewFinancial ? '' : 'hidden'}">${formatAmount(p.profit)}</td>
            <td class="p-5 text-center">
                <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${projectStatusBadgeClass(resolveProjectStatus(p))}">
                    ${projectStatusLabel(resolveProjectStatus(p))}
                </span>
                ${canViewFinancial ? `<button onclick="openAddProjectExpenseModal(${p.id})" class="bg-rose-600 text-white px-3 py-2 rounded-xl text-xs font-bold ml-2">+ مصروف</button>` : ''}
                ${canViewFinancial ? `<button onclick="openProjectExpensesModal(${p.id})" class="bg-rose-50 text-rose-700 px-4 py-2 rounded-xl text-sm font-bold ml-2">المصاريف</button>` : ''}
                <button onclick="openProjectEditModal(${p.id})" class="bg-indigo-50 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold ${canViewFinancial ? '' : 'ml-2'}">تعديل</button>
            </td>
        </tr>
    `).join('');
}

window.openAddProjectExpenseModal = async (id) => {
    if (!canViewProfitAndCost()) {
        alert('لا تملك صلاحية عرض أو تعديل التكلفة/الربح');
        return;
    }
    const { data: project, error } = await _supabase.from('projects').select('*').eq('id', id).single();
    if (error || !project) {
        console.error(error);
        alert('فشل تحميل بيانات المشروع');
        return;
    }

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right max-w-xl mx-auto">
            <h3 class="text-2xl font-black mb-2">إضافة مصروف للمشروع</h3>
            <p class="text-slate-500 mb-6">${readText(project.name) || '-'}</p>
            <form id="add-project-expense-form" class="space-y-4">
                <input type="date" id="add-proj-expense-date" class="w-full p-4 border rounded-xl">
                <input type="text" id="add-proj-expense-desc" placeholder="وصف المصروف" class="w-full p-4 border rounded-xl" required>
                <input type="number" id="add-proj-expense-amount" placeholder="المبلغ" class="w-full p-4 border rounded-xl" min="0.01" step="0.01" required>
                <button type="submit" class="w-full bg-rose-600 text-white py-4 rounded-xl font-bold">حفظ المصروف</button>
            </form>
        </div>
    `;

    const dateInput = document.getElementById('add-proj-expense-date');
    dateInput.value = new Date().toLocaleDateString('en-CA');

    document.getElementById('add-project-expense-form').onsubmit = async (e) => {
        e.preventDefault();
        const amount = safeNumber(document.getElementById('add-proj-expense-amount').value);
        const description = readText(document.getElementById('add-proj-expense-desc').value);
        const date = readText(dateInput.value) || new Date().toLocaleDateString('en-CA');
        if (amount <= 0 || !description) {
            alert('يرجى إدخال وصف ومبلغ صحيح');
            return;
        }

        const expense = {
            date,
            category: projectExpenseCategory(id),
            amount,
            description
        };
        const { error: expenseError } = await _supabase.from('expenses').insert([expense]);
        if (expenseError) {
            console.error(expenseError);
            alert('فشل حفظ المصروف');
            return;
        }

        const totalCosts = safeNumber(project.totalCosts) + amount;
        const contractValue = safeNumber(project.contractValue);
        const profit = contractValue - totalCosts;
        const status = resolveProjectStatus(project);

        let { error: projectError } = await _supabase
            .from('projects')
            .update({ totalCosts, profit, status })
            .eq('id', id);

        if (projectError && isMissingStatusColumnError(projectError)) {
            ({ error: projectError } = await _supabase
                .from('projects')
                .update({ totalCosts, profit })
                .eq('id', id));
            if (!projectError) setProjectStatusOverride(id, status);
        }

        if (projectError) {
            console.error(projectError);
            alert('تم حفظ المصروف لكن فشل تحديث إجماليات المشروع');
            closeModal();
            renderProjects();
            updateDashboard();
            return;
        }

        alert('تمت إضافة المصروف للمشروع');
        closeModal();
        renderProjects();
        updateDashboard();
    };
};

window.openProjectEditModal = async (id) => {
    if (!canViewProfitAndCost()) {
        alert('لا تملك صلاحية عرض أو تعديل التكلفة/الربح');
        return;
    }
    const { data: project, error } = await _supabase.from('projects').select('*').eq('id', id).single();
    if (error || !project) {
        console.error(error);
        alert('فشل تحميل بيانات المشروع');
        return;
    }

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right max-w-2xl mx-auto">
            <h3 class="text-2xl font-black mb-6">تعديل المشروع</h3>
            <form id="edit-project-form" class="space-y-4">
                <input type="text" id="edit-proj-name" class="w-full p-4 border rounded-xl" placeholder="اسم المشروع" required>
                <input type="text" id="edit-proj-cust" class="w-full p-4 border rounded-xl" placeholder="العميل" required>
                <input type="number" id="edit-proj-contract" class="w-full p-4 border rounded-xl" placeholder="قيمة العقد" min="0" step="0.01" required>
                <input type="number" id="edit-proj-costs" class="w-full p-4 border rounded-xl" placeholder="إجمالي المصاريف" min="0" step="0.01" required>
                <select id="edit-proj-status" class="w-full p-4 border rounded-xl" required>
                    <option value="in_progress">قيد الإنشاء</option>
                    <option value="completed">تم التنفيذ</option>
                </select>

                <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                    <p class="text-xs text-emerald-600 font-bold mb-1">الربح المتوقع</p>
                    <p id="edit-proj-profit-preview" class="text-2xl font-black text-emerald-700">0.00</p>
                </div>

                <button type="submit" class="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">حفظ التعديلات</button>
            </form>
        </div>
    `;

    const nameInput = document.getElementById('edit-proj-name');
    const customerInput = document.getElementById('edit-proj-cust');
    const contractInput = document.getElementById('edit-proj-contract');
    const costsInput = document.getElementById('edit-proj-costs');
    const statusInput = document.getElementById('edit-proj-status');
    const profitPreviewEl = document.getElementById('edit-proj-profit-preview');

    nameInput.value = readText(project.name);
    customerInput.value = readText(project.customer);
    contractInput.value = safeNumber(project.contractValue);
    costsInput.value = safeNumber(project.totalCosts);
    statusInput.value = resolveProjectStatus(project);

    const recalcProfit = () => {
        const contractValue = safeNumber(contractInput.value);
        const totalCosts = safeNumber(costsInput.value);
        const profit = contractValue - totalCosts;
        profitPreviewEl.innerText = formatAmount(profit);
        return { contractValue, totalCosts, profit };
    };

    contractInput.addEventListener('input', recalcProfit);
    costsInput.addEventListener('input', recalcProfit);
    recalcProfit();

    document.getElementById('edit-project-form').onsubmit = async (e) => {
        e.preventDefault();
        const name = readText(nameInput.value);
        const customer = readText(customerInput.value);
        const { contractValue, totalCosts, profit } = recalcProfit();
        const status = normalizeProjectStatus(statusInput.value);

        if (!name || !customer) {
            alert('يرجى إدخال اسم المشروع واسم العميل');
            return;
        }

        let { error: updateError } = await _supabase
            .from('projects')
            .update({ name, customer, contractValue, totalCosts, profit, status })
            .eq('id', id);

        if (updateError && isMissingStatusColumnError(updateError)) {
            ({ error: updateError } = await _supabase
                .from('projects')
                .update({ name, customer, contractValue, totalCosts, profit })
                .eq('id', id));
            if (!updateError) setProjectStatusOverride(id, status);
        }

        if (updateError) {
            console.error(updateError);
            alert('فشل تحديث المشروع');
            return;
        }

        setProjectStatusOverride(id, status);

        alert('تم تحديث المشروع');
        closeModal();
        renderProjects();
        updateDashboard();
    };
};

window.openProjectExpensesModal = async (id) => {
    if (!canViewProfitAndCost()) {
        alert('لا تملك صلاحية عرض أو تعديل التكلفة/الربح');
        return;
    }
    const { data: project, error: projectError } = await _supabase.from('projects').select('*').eq('id', id).single();
    if (projectError || !project) {
        console.error(projectError);
        alert('فشل تحميل المشروع');
        return;
    }

    const categoryById = projectExpenseCategory(id);
    const categoryByName = projectLegacyExpenseCategory(readText(project.name));

    const [{ data: byId, error: byIdError }, { data: byName, error: byNameError }] = await Promise.all([
        _supabase.from('expenses').select('*').eq('category', categoryById).order('date', { ascending: false }),
        _supabase.from('expenses').select('*').eq('category', categoryByName).order('date', { ascending: false })
    ]);

    if (byIdError) console.error(byIdError);
    if (byNameError) console.error(byNameError);

    const merged = [...(byId || []), ...(byName || [])];
    const uniqueById = [];
    const seen = new Set();
    for (const item of merged) {
        const key = item && item.id ? String(item.id) : `${item?.date}|${item?.amount}|${item?.description}`;
        if (seen.has(key)) continue;
        seen.add(key);
        uniqueById.push(item);
    }

    uniqueById.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
    const total = uniqueById.reduce((sum, item) => sum + safeNumber(item.amount), 0);
    const recordedProjectCosts = safeNumber(project.totalCosts);
    const legacyGap = recordedProjectCosts - total;

    const rowsHtml = uniqueById.length === 0
        ? `<tr><td colspan="3" class="p-6 text-center text-slate-400 font-bold">لا توجد مصاريف مسجلة لهذا المشروع</td></tr>`
        : uniqueById.map(item => `
            <tr class="border-b border-slate-100">
                <td class="p-4">${item.date || '-'}</td>
                <td class="p-4">${readText(item.description) || readText(item.category) || '-'}</td>
                <td class="p-4 text-center font-black text-rose-600">${formatAmount(item.amount)}</td>
            </tr>
        `).join('');

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right max-w-3xl mx-auto">
            <h3 class="text-2xl font-black mb-2">تفاصيل مصاريف المشروع</h3>
            <p class="text-slate-500 mb-4">المشروع: ${readText(project.name) || '-'}</p>
            <div class="mb-4">
                <button onclick="openAddProjectExpenseModal(${id})" class="bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ إضافة مصروف</button>
            </div>
            <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
                <table class="w-full text-right">
                    <thead class="bg-slate-100 text-slate-600 text-xs font-black">
                        <tr>
                            <th class="p-4">التاريخ</th>
                            <th class="p-4">البند</th>
                            <th class="p-4 text-center">المبلغ</th>
                        </tr>
                    </thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div class="mt-4 bg-rose-50 border border-rose-100 rounded-xl p-4 flex items-center justify-between">
                <span class="font-bold text-rose-700">إجمالي المصاريف</span>
                <span class="text-2xl font-black text-rose-700">${formatAmount(total)}</span>
            </div>
            ${Math.abs(legacyGap) > 0.009 ? `
                <div class="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3 text-amber-700 text-sm font-bold">
                    يوجد رصيد مصاريف سابق غير مفصل: ${formatAmount(legacyGap)}
                </div>
            ` : ''}
        </div>
    `;
};

window.openProjectModal = () => {
    if (!canViewProfitAndCost()) {
        alert('لا تملك صلاحية عرض أو تعديل التكلفة/الربح');
        return;
    }
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right max-w-3xl mx-auto">
            <h3 class="text-2xl font-black mb-6">مشروع جديد</h3>
            <form id="project-form" class="space-y-4">
                <input type="text" id="proj-name" placeholder="اسم المشروع" class="w-full p-4 border rounded-xl" required>
                <input type="text" id="proj-cust" placeholder="العميل" class="w-full p-4 border rounded-xl" required>
                <input type="number" id="proj-val" placeholder="قيمة العقد" class="w-full p-4 border rounded-xl" min="0" step="0.01" required>
                <select id="proj-status" class="w-full p-4 border rounded-xl" required>
                    <option value="in_progress">قيد الإنشاء</option>
                    <option value="completed">تم التنفيذ</option>
                </select>

                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div class="flex items-center justify-between">
                        <h4 class="font-black text-slate-700">مصاريف المشروع</h4>
                        <button type="button" id="add-proj-expense" class="bg-rose-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ إضافة مصروف</button>
                    </div>
                    <div id="proj-expenses-list" class="space-y-2"></div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="bg-rose-50 border border-rose-100 rounded-xl p-4">
                        <p class="text-xs text-rose-600 font-bold mb-1">إجمالي المصاريف</p>
                        <p id="proj-cost-total" class="text-2xl font-black text-rose-700">0.00</p>
                    </div>
                    <div class="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
                        <p class="text-xs text-emerald-600 font-bold mb-1">الربح المتوقع</p>
                        <p id="proj-profit-preview" class="text-2xl font-black text-emerald-700">0.00</p>
                    </div>
                </div>

                <button type="submit" class="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold">حفظ المشروع</button>
            </form>
        </div>
    `;

    const form = document.getElementById('project-form');
    const contractInput = document.getElementById('proj-val');
    const expensesList = document.getElementById('proj-expenses-list');
    const totalCostsEl = document.getElementById('proj-cost-total');
    const profitPreviewEl = document.getElementById('proj-profit-preview');
    const addExpenseBtn = document.getElementById('add-proj-expense');

    const buildExpenseRow = (title = '', amount = '') => {
        const row = document.createElement('div');
        row.className = 'proj-expense-row grid grid-cols-1 sm:grid-cols-3 gap-2';
        row.innerHTML = `
            <input type="text" class="proj-expense-title p-3 border rounded-xl" placeholder="اسم المصروف" value="${title}">
            <input type="number" class="proj-expense-amount p-3 border rounded-xl" placeholder="المبلغ" value="${amount}" min="0" step="0.01">
            <button type="button" class="remove-proj-expense bg-slate-200 text-slate-700 px-3 rounded-xl font-bold">حذف</button>
        `;
        expensesList.appendChild(row);
    };

    const getExpenseEntries = () => {
        return Array.from(expensesList.querySelectorAll('.proj-expense-row')).map(row => {
            const title = readText(row.querySelector('.proj-expense-title')?.value);
            const amount = safeNumber(row.querySelector('.proj-expense-amount')?.value);
            return { title, amount };
        }).filter(x => x.amount > 0);
    };

    const recalcProjectTotals = () => {
        const contractValue = safeNumber(contractInput.value);
        const totalCosts = getExpenseEntries().reduce((sum, x) => sum + x.amount, 0);
        totalCostsEl.innerText = formatAmount(totalCosts);
        profitPreviewEl.innerText = formatAmount(contractValue - totalCosts);
        return { contractValue, totalCosts };
    };

    addExpenseBtn.onclick = () => {
        buildExpenseRow();
    };

    contractInput.addEventListener('input', recalcProjectTotals);
    expensesList.addEventListener('input', (e) => {
        if (e.target.classList.contains('proj-expense-amount')) {
            recalcProjectTotals();
        }
    });

    expensesList.addEventListener('click', (e) => {
        const btn = e.target.closest('.remove-proj-expense');
        if (!btn) return;
        const row = btn.closest('.proj-expense-row');
        if (row) row.remove();
        recalcProjectTotals();
    });

    // Keep one default row visible for quick entry.
    buildExpenseRow();
    recalcProjectTotals();

    form.onsubmit = async (e) => {
        e.preventDefault();
        const name = readText(document.getElementById('proj-name').value);
        const customer = readText(document.getElementById('proj-cust').value);
        const status = normalizeProjectStatus(document.getElementById('proj-status').value);
        const { contractValue, totalCosts } = recalcProjectTotals();
        const profit = contractValue - totalCosts;

        if (!name || !customer) {
            alert('يرجى إدخال اسم المشروع واسم العميل');
            return;
        }

        const project = {
            name,
            customer,
            contractValue,
            totalCosts,
            profit,
            status,
            date: new Date().toLocaleDateString('en-CA')
        };

        let insertedProject = null;
        let { data: insertedWithStatus, error: projectError } = await _supabase
            .from('projects')
            .insert([project])
            .select('*')
            .single();

        if (projectError && isMissingStatusColumnError(projectError)) {
            const payloadWithoutStatus = { ...project };
            delete payloadWithoutStatus.status;
            const { data: fallbackInsert, error: fallbackError } = await _supabase
                .from('projects')
                .insert([payloadWithoutStatus])
                .select('*')
                .single();
            projectError = fallbackError;
            insertedProject = fallbackInsert;
        } else {
            insertedProject = insertedWithStatus;
        }

        if (projectError || !insertedProject) {
            console.error(projectError);
            alert('فشل حفظ المشروع');
            return;
        }

        setProjectStatusOverride(insertedProject.id, status);

        const expenseEntries = getExpenseEntries();
        if (expenseEntries.length > 0) {
            const expenseCategory = projectExpenseCategory(insertedProject.id);
            const mappedExpenses = expenseEntries.map(item => ({
                date: new Date().toLocaleDateString('en-CA'),
                category: expenseCategory,
                amount: item.amount,
                description: item.title || customer
            }));
            const { error: expenseError } = await _supabase.from('expenses').insert(mappedExpenses);
            if (expenseError) {
                console.error(expenseError);
            }
        }

        alert('تم حفظ المشروع');
        closeModal();
        renderProjects();
        updateDashboard();
    };
};

// 5. Contracts
async function renderContracts() {
    const tbody = document.getElementById('contracts-list');
    if (!tbody) return;
    try {
        const from = document.getElementById('contracts-from')?.value || '';
        const to = document.getElementById('contracts-to')?.value || '';
        const status = document.getElementById('contracts-status')?.value || 'all';

        let query = _supabase.from('contracts').select('*');
        if (from) query = query.gte('date', from);
        if (to) query = query.lte('date', to);
        if (status !== 'all') query = query.eq('status', normalizeProjectStatus(status));

        const { data, error } = await query.order('date', { ascending: false });

        let contractsData = data || [];
        let usingLocalFallback = false;

        if (error) {
            if (isContractsTableMissingError(error)) {
                usingLocalFallback = true;
                contractsData = getLocalContracts()
                    .filter(c => !from || String(c.date || '') >= from)
                    .filter(c => !to || String(c.date || '') <= to)
                    .filter(c => status === 'all' || normalizeProjectStatus(c.status) === normalizeProjectStatus(status))
                    .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
            } else {
                console.error(error);
                tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-600 font-bold">فشل تحميل العقود.</td></tr>`;
                return;
            }
        }

        if (!contractsData || contractsData.length === 0) {
            const note = usingLocalFallback ? ' (وضع محلي مؤقت)' : '';
            tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400 font-bold">لا توجد عقود${note}</td></tr>`;
            return;
        }

        tbody.innerHTML = contractsData.map(c => {
            const statusValue = normalizeProjectStatus(c.status);
            const switchTo = statusValue === PROJECT_STATUS_VALUES.COMPLETED ? PROJECT_STATUS_VALUES.IN_PROGRESS : PROJECT_STATUS_VALUES.COMPLETED;
            const switchLabel = statusValue === PROJECT_STATUS_VALUES.COMPLETED ? 'إرجاع قيد الإنشاء' : 'تم التنفيذ';
            const contractNo = readText(c.contract_no) || `#${c.id}`;
            const safeId = String(c.id).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
            return `
                <tr class="border-b border-slate-100">
                    <td class="p-5 font-bold">
                        <div>${contractNo}</div>
                        <div class="mt-2 flex flex-wrap gap-2">
                            <button onclick="viewContract('${safeId}')" class="bg-blue-50 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1"><i class="fas fa-eye"></i><span>عرض العقد</span></button>
                            <button onclick="openEditContractModal('${safeId}')" class="bg-amber-50 text-amber-700 px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1"><i class="fas fa-pen"></i><span>تعديل العقد</span></button>
                            <button onclick="printContract('${safeId}')" class="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1"><i class="fas fa-print"></i><span>طباعة العقد</span></button>
                        </div>
                    </td>
                    <td class="p-5">${c.date || '-'}</td>
                    <td class="p-5">${readText(c.customer) || '-'}</td>
                    <td class="p-5 text-center font-black text-slate-700">${formatAmount(c.total)}</td>
                    <td class="p-5 text-center text-emerald-700 font-bold">${formatAmount(c.advance_amount)}</td>
                    <td class="p-5 text-center text-amber-700 font-bold">${formatAmount(c.remaining_amount)}</td>
                    <td class="p-5 text-center">
                        <span class="inline-flex items-center px-3 py-1 rounded-full text-xs font-black ${contractStatusBadgeClass(statusValue)}">${contractStatusLabel(statusValue)}</span>
                    </td>
                    <td class="p-5 text-center">
                        <button onclick="updateContractStatus('${safeId}', '${switchTo}')" class="bg-emerald-50 text-emerald-700 px-3 py-2 rounded-xl text-xs font-bold inline-flex items-center gap-1"><i class="fas fa-check-circle"></i><span>${switchLabel}</span></button>
                    </td>
                </tr>
            `;
        }).join('');
    } catch (err) {
        console.error(err);
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-rose-600 font-bold">حدث خطأ أثناء عرض العقود.</td></tr>`;
    }
}

window.updateContractStatus = async (id, status) => {
    const normalized = normalizeProjectStatus(status);
    const { error } = await _supabase
        .from('contracts')
        .update({ status: normalized })
        .eq('id', id);
    if (error) {
        if (isContractsTableMissingError(error)) {
            const local = getLocalContracts();
            const idx = local.findIndex(c => String(c.id) === String(id));
            if (idx === -1) {
                alert('لم يتم العثور على العقد محليًا');
                return;
            }
            local[idx] = { ...local[idx], status: normalized };
            setLocalContracts(local);
            renderContracts();
            return;
        }
        console.error(error);
        alert('فشل تحديث حالة العقد');
        return;
    }
    renderContracts();
};

window.openContractModal = (existingContract = null) => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    const isEdit = Boolean(existingContract && existingContract.id);

    const defaultTerms = CONTRACT_DEFAULT_TERMS;

    content.innerHTML = `
        <div class="p-8 bg-white text-right max-w-6xl mx-auto">
            <h3 class="text-2xl font-black mb-6">${isEdit ? 'تعديل الفاتورة بالعقد' : 'إبرام عقد جديد'}</h3>
            <form id="contract-form" class="space-y-5">
                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="date" id="contract-date" class="p-3 border rounded-xl" required>
                    <input type="text" id="contract-no" class="p-3 border rounded-xl" placeholder="رقم العقد (اختياري)">
                    <input type="text" id="contract-title" class="p-3 border rounded-xl" placeholder="عنوان العقد" value="توريد وتركيب">
                    <select id="contract-status" class="p-3 border rounded-xl">
                        <option value="in_progress">قيد الإنشاء</option>
                        <option value="completed">تم التنفيذ</option>
                    </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input type="text" id="contract-customer" class="p-3 border rounded-xl" placeholder="اسم العميل" required>
                    <input type="text" id="contract-phone" class="p-3 border rounded-xl" placeholder="الجوال">
                    <input type="text" id="contract-address" class="p-3 border rounded-xl" placeholder="العنوان">
                </div>

                <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="font-black text-slate-700">بنود العقد</h4>
                        <button type="button" id="contract-add-item" class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold">+ إضافة بند</button>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-right">
                            <thead class="bg-white text-slate-500 text-xs font-black">
                                <tr>
                                    <th class="p-3">#</th>
                                    <th class="p-3">التفاصيل</th>
                                    <th class="p-3 text-center">العرض</th>
                                    <th class="p-3 text-center">الطول</th>
                                    <th class="p-3 text-center">الكمية</th>
                                    <th class="p-3 text-center">السعر</th>
                                    <th class="p-3 text-center">المبلغ</th>
                                    <th class="p-3 text-center">حذف</th>
                                </tr>
                            </thead>
                            <tbody id="contract-items-list"></tbody>
                        </table>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <input type="number" id="contract-advance-percent" class="p-3 border rounded-xl" min="0" max="100" step="0.01" value="50" placeholder="نسبة المقدم %">
                    <select id="contract-warranty" class="p-3 border rounded-xl">
                        <option value="سنة">سنة</option>
                        <option value="خمس سنوات" selected>خمس سنوات</option>
                        <option value="عشر سنوات">عشر سنوات</option>
                    </select>
                    <input type="text" id="contract-notes" class="p-3 border rounded-xl md:col-span-2" placeholder="ملاحظات إضافية">
                </div>

                <textarea id="contract-terms" class="w-full p-3 border rounded-xl min-h-[120px]" placeholder="الشروط">${defaultTerms}</textarea>

                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div class="bg-slate-900 text-white p-4 rounded-xl flex justify-between"><span>الإجمالي</span><span id="contract-total">0.00</span></div>
                    <div class="bg-emerald-700 text-white p-4 rounded-xl flex justify-between"><span>المقدم</span><span id="contract-advance">0.00</span></div>
                    <div class="bg-amber-600 text-white p-4 rounded-xl flex justify-between"><span>المتبقي</span><span id="contract-remaining">0.00</span></div>
                </div>

                <button type="submit" class="w-full bg-teal-700 text-white py-4 rounded-xl font-black">${isEdit ? 'حفظ التعديل' : 'حفظ العقد'}</button>
            </form>
        </div>
    `;

    const dateInput = document.getElementById('contract-date');
    const addItemBtn = document.getElementById('contract-add-item');
    const itemsList = document.getElementById('contract-items-list');
    const advancePercentInput = document.getElementById('contract-advance-percent');
    dateInput.value = readText(existingContract?.date) || new Date().toLocaleDateString('en-CA');

    const updateRowsOrder = () => {
        Array.from(itemsList.querySelectorAll('.contract-item-row')).forEach((row, index) => {
            const n = row.querySelector('.contract-item-index');
            if (n) n.textContent = String(index + 1);
        });
    };

    const addItemRow = (item = {}) => {
        const normalized = normalizeContractItem(item);
        const row = document.createElement('tr');
        row.className = 'contract-item-row border-b border-slate-200';
        row.innerHTML = `
            <td class="p-2 text-center contract-item-index"></td>
            <td class="p-2"><input type="text" class="contract-item-desc w-full p-2 border rounded-lg" value="${readText(normalized.description)}" placeholder="تفاصيل البند"></td>
            <td class="p-2"><input type="number" class="contract-item-width w-full p-2 border rounded-lg text-center" value="${normalized.width ?? ''}" step="0.01"></td>
            <td class="p-2"><input type="number" class="contract-item-length w-full p-2 border rounded-lg text-center" value="${normalized.length ?? ''}" step="0.01"></td>
            <td class="p-2"><input type="number" class="contract-item-qty w-full p-2 border rounded-lg text-center" value="${normalized.qty || ''}" step="1" min="0"></td>
            <td class="p-2"><input type="number" class="contract-item-price w-full p-2 border rounded-lg text-center" value="${normalized.unit_price || ''}" step="0.01" min="0"></td>
            <td class="p-2"><input type="text" class="contract-item-total w-full p-2 border rounded-lg text-center bg-slate-50" value="${formatAmount(normalized.amount)}" readonly></td>
            <td class="p-2 text-center"><button type="button" class="contract-remove-item text-rose-600 text-lg font-black">×</button></td>
        `;
        itemsList.appendChild(row);
        updateRowsOrder();
    };

    const recalcContractTotals = () => {
        const rows = Array.from(itemsList.querySelectorAll('.contract-item-row'));
        const items = rows.map(row => {
            const description = readText(row.querySelector('.contract-item-desc')?.value);
            const widthRaw = readText(row.querySelector('.contract-item-width')?.value);
            const lengthRaw = readText(row.querySelector('.contract-item-length')?.value);
            const qty = safeNumber(row.querySelector('.contract-item-qty')?.value);
            const unitPrice = safeNumber(row.querySelector('.contract-item-price')?.value);
            const amount = qty * unitPrice;

            const totalEl = row.querySelector('.contract-item-total');
            if (totalEl) totalEl.value = formatAmount(amount);

            return {
                description,
                width: widthRaw === '' ? null : safeNumber(widthRaw),
                length: lengthRaw === '' ? null : safeNumber(lengthRaw),
                qty,
                unit_price: unitPrice,
                amount
            };
        });

        const validItems = items.filter(item => item.description && item.qty > 0);
        const total = validItems.reduce((sum, item) => sum + item.amount, 0);
        const advancePercent = Math.max(0, Math.min(100, safeNumber(advancePercentInput.value, 50)));
        const advanceAmount = total * (advancePercent / 100);
        const remainingAmount = total - advanceAmount;

        document.getElementById('contract-total').innerText = formatAmount(total);
        document.getElementById('contract-advance').innerText = formatAmount(advanceAmount);
        document.getElementById('contract-remaining').innerText = formatAmount(remainingAmount);

        return { items: validItems, total, advancePercent, advanceAmount, remainingAmount };
    };

    addItemBtn.onclick = () => addItemRow();
    itemsList.addEventListener('input', recalcContractTotals);
    itemsList.addEventListener('click', (e) => {
        const btn = e.target.closest('.contract-remove-item');
        if (!btn) return;
        const row = btn.closest('.contract-item-row');
        if (row) row.remove();
        updateRowsOrder();
        recalcContractTotals();
    });
    advancePercentInput.addEventListener('input', recalcContractTotals);

    if (isEdit) {
        document.getElementById('contract-no').value = readText(existingContract.contract_no);
        document.getElementById('contract-title').value = readText(existingContract.title) || 'توريد وتركيب';
        document.getElementById('contract-status').value = normalizeProjectStatus(existingContract.status);
        document.getElementById('contract-customer').value = readText(existingContract.customer);
        document.getElementById('contract-phone').value = readText(existingContract.phone);
        document.getElementById('contract-address').value = readText(existingContract.address);
        document.getElementById('contract-advance-percent').value = formatAmount(existingContract.advance_percent || 50);
        document.getElementById('contract-warranty').value = readText(existingContract.warranty) || 'خمس سنوات';
        document.getElementById('contract-notes').value = readText(existingContract.notes);
        document.getElementById('contract-terms').value = resolveContractTerms(existingContract.terms);

        const existingItems = Array.isArray(existingContract.items) ? existingContract.items : [];
        if (existingItems.length > 0) {
            existingItems.forEach(item => addItemRow(item));
        } else {
            addItemRow();
        }
    } else {
        addItemRow();
    }
    recalcContractTotals();

    document.getElementById('contract-form').onsubmit = async (e) => {
        e.preventDefault();
        const customer = readText(document.getElementById('contract-customer').value);
        const date = readText(document.getElementById('contract-date').value) || new Date().toLocaleDateString('en-CA');
        const { items, total, advancePercent, advanceAmount, remainingAmount } = recalcContractTotals();

        if (!customer) {
            alert('يرجى إدخال اسم العميل');
            return;
        }
        if (items.length === 0) {
            alert('يرجى إضافة بند واحد على الأقل');
            return;
        }

        const payload = {
            date,
            contract_no: readText(document.getElementById('contract-no').value) || null,
            title: readText(document.getElementById('contract-title').value) || null,
            customer,
            phone: readText(document.getElementById('contract-phone').value) || null,
            address: readText(document.getElementById('contract-address').value) || null,
            items,
            total,
            advance_percent: advancePercent,
            advance_amount: advanceAmount,
            remaining_amount: remainingAmount,
            status: normalizeProjectStatus(document.getElementById('contract-status').value),
            warranty: readText(document.getElementById('contract-warranty').value) || null,
            terms: readText(document.getElementById('contract-terms').value) || null,
            notes: readText(document.getElementById('contract-notes').value) || null
        };

        let inserted = null;
        let error = null;
        if (isEdit) {
            const result = await _supabase
                .from('contracts')
                .update(payload)
                .eq('id', existingContract.id)
                .select('*')
                .single();
            inserted = result.data;
            error = result.error;
        } else {
            const result = await _supabase.from('contracts').insert([payload]).select('*').single();
            inserted = result.data;
            error = result.error;
        }
        if (error) {
            if (isContractsTableMissingError(error)) {
                const local = getLocalContracts();
                if (isEdit) {
                    const idx = local.findIndex(c => String(c.id) === String(existingContract.id));
                    if (idx === -1) {
                        alert('لم يتم العثور على العقد محليًا');
                        return;
                    }
                    local[idx] = { ...local[idx], ...payload };
                } else {
                    const localRow = {
                        ...payload,
                        id: Date.now(),
                        _local_only: true
                    };
                    local.push(localRow);
                }
                setLocalContracts(local);
                alert(isEdit ? 'تم حفظ التعديل محليًا (مؤقتًا)' : 'تم حفظ العقد محليًا (مؤقتًا) لحين تجهيز قاعدة البيانات');
                closeModal();
                renderContracts();
                return;
            }
            console.error(error);
            alert(isEdit ? 'فشل تعديل العقد.' : 'فشل حفظ العقد.');
            return;
        }

        const createdId = inserted?.id;
        if (createdId) {
            const local = getLocalContracts().filter(c => String(c.id) !== String(createdId));
            setLocalContracts(local);
        }

        alert(isEdit ? 'تم تعديل العقد' : 'تم حفظ العقد');
        closeModal();
        renderContracts();
    };
};

window.openEditContractModal = async (id) => {
    let contract = null;
    const { data, error } = await _supabase.from('contracts').select('*').eq('id', id).single();
    if (!error && data) {
        contract = data;
    } else if (error && isContractsTableMissingError(error)) {
        contract = getLocalContracts().find(c => String(c.id) === String(id)) || null;
    } else if (error) {
        console.error(error);
        alert('فشل تحميل العقد للتعديل');
        return;
    }

    if (!contract) {
        alert('العقد غير موجود');
        return;
    }
    window.openContractModal(contract);
};

window.viewContract = async (id) => {
    let contract = null;
    const { data: dbContract, error } = await _supabase.from('contracts').select('*').eq('id', id).single();
    if (!error && dbContract) {
        contract = dbContract;
    } else if (error && isContractsTableMissingError(error)) {
        contract = getLocalContracts().find(c => String(c.id) === String(id)) || null;
    } else if (error) {
        console.error(error);
        alert('فشل تحميل العقد');
        return;
    }

    if (!contract) {
        alert('العقد غير موجود');
        return;
    }

    const items = Array.isArray(contract.items) ? contract.items.map(normalizeContractItem) : [];
    const targetRows = Math.max(9, items.length);
    const rowsHtml = Array.from({ length: targetRows }).map((_, idx) => {
        const item = items[idx];
        if (!item) {
            return `<tr><td class="p-2 border text-center">${idx + 1}</td><td class="p-2 border h-8"></td><td class="p-2 border"></td><td class="p-2 border"></td><td class="p-2 border"></td><td class="p-2 border"></td><td class="p-2 border"></td></tr>`;
        }
        return `
            <tr>
                <td class="p-2 border text-center">${idx + 1}</td>
                <td class="p-2 border">${readText(item.description) || '-'}</td>
                <td class="p-2 border text-center">${item.width ?? '-'}</td>
                <td class="p-2 border text-center">${item.length ?? '-'}</td>
                <td class="p-2 border text-center">${item.qty ?? '-'}</td>
                <td class="p-2 border text-center">${formatAmount(item.unit_price)}</td>
                <td class="p-2 border text-center">${formatAmount(item.amount)}</td>
            </tr>
        `;
    }).join('');

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div id="printable-area" class="p-8 bg-white text-right max-w-[190mm] mx-auto text-[13px] leading-6">
            <div class="flex justify-between items-start mb-6">
                <div class="text-xs border border-slate-700">
                    <div class="grid grid-cols-2">
                        <div class="px-3 py-1 border-b border-l border-slate-700">س. ت</div>
                        <div class="px-3 py-1 border-b border-slate-700 font-bold">1508200</div>
                        <div class="px-3 py-1 border-b border-l border-slate-700">ض. ب</div>
                        <div class="px-3 py-1 border-b border-slate-700 font-bold">654</div>
                        <div class="px-3 py-1 border-l border-slate-700">ز. ب</div>
                        <div class="px-3 py-1 font-bold">111</div>
                    </div>
                </div>
                <div class="text-center flex-1 px-6">
                    <h1 class="text-2xl font-black">الهرم للأعمال والخدمات ش م م</h1>
                    <p class="mt-2">${readText(contract.title) || 'تركيب الأبواب والنوافذ الأتوماتيكية'}</p>
                    <p class="mt-1">عقد بيع / فاتورة</p>
                </div>
                <div class="w-24"></div>
            </div>

            <div class="mb-3 flex justify-between items-center">
                <p>التاريخ: <span class="font-black">${contract.date || '-'}</span></p>
                <p>رقم العقد: <span class="font-black">${readText(contract.contract_no) || contract.id}</span></p>
            </div>

            <div class="text-sm mb-3">
                <p>تم الاتفاق بين الطرف الأول شركة الهرم للأعمال والخدمات ش م م والطرف الثاني العميل على البنود التالية:</p>
                <p>اسم العميل: <span class="font-black">${readText(contract.customer) || '-'}</span> / الجوال: <span class="font-black">${readText(contract.phone) || '-'}</span></p>
                <p>العنوان: <span class="font-black">${readText(contract.address) || '-'}</span></p>
            </div>

            <table class="w-full border border-slate-700 text-sm">
                <thead>
                    <tr>
                        <th class="p-1.5 border border-slate-700">الرقم</th>
                        <th class="p-1.5 border border-slate-700">التفاصيل</th>
                        <th class="p-1.5 border border-slate-700">العرض</th>
                        <th class="p-1.5 border border-slate-700">الطول</th>
                        <th class="p-1.5 border border-slate-700">الكمية</th>
                        <th class="p-1.5 border border-slate-700">السعر</th>
                        <th class="p-1.5 border border-slate-700">المبلغ</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
                <tfoot>
                    <tr>
                        <td colspan="5" class="p-1.5 border border-slate-700 font-black">المجموع</td>
                        <td colspan="2" class="p-1.5 border border-slate-700 font-black text-center">${formatAmount(contract.total)}</td>
                    </tr>
                    <tr>
                        <td colspan="5" class="p-1.5 border border-slate-700 font-black">العربون (${formatAmount(contract.advance_percent)}%)</td>
                        <td colspan="2" class="p-1.5 border border-slate-700 font-black text-center">${formatAmount(contract.advance_amount)}</td>
                    </tr>
                    <tr>
                        <td colspan="5" class="p-1.5 border border-slate-700 font-black">المتبقي</td>
                        <td colspan="2" class="p-1.5 border border-slate-700 font-black text-center">${formatAmount(contract.remaining_amount)}</td>
                    </tr>
                </tfoot>
            </table>

            <div class="text-xs mt-4 whitespace-pre-line border border-slate-700 p-3">${resolveContractTerms(contract.terms)}</div>
            <p class="text-xs mt-2">الضمان لمدة: <span class="font-black">${readText(contract.warranty) || '-'}</span></p>
            <p class="text-xs mt-1">ملاحظات: ${readText(contract.notes) || '-'}</p>

            <div class="grid grid-cols-2 gap-16 mt-12 text-center">
                <div>
                    <p class="font-black">توقيع العميل</p>
                </div>
                <div>
                    <p class="font-black">توقيع البائع</p>
                </div>
            </div>

            <div class="mt-6 flex gap-2 no-print">
                <button onclick="window.print()" class="bg-slate-900 text-white px-6 py-2 rounded-lg">طباعة</button>
                <button onclick="closeModal()" class="bg-slate-100 px-6 py-2 rounded-lg">إغلاق</button>
            </div>
        </div>
    `;
};

window.printContract = async (id) => {
    await window.viewContract(id);
    setTimeout(() => window.print(), 350);
};

// 6. Maintenance
async function renderMaintenances() {
    const from = document.getElementById('maint-from').value;
    const to = document.getElementById('maint-to').value;
    let query = _supabase.from('maintenances').select('*');
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data } = await query.order('date', { ascending: false });
    
    const tbody = document.getElementById('maintenance-list');
    if(tbody && data) tbody.innerHTML = data.map(m => {
        const mapUrl = resolveMaintenanceMapUrl(m);
        const locationText = readText(m.location) || '-';
        const locationCell = mapUrl
            ? `<a href="${mapUrl}" target="_blank" rel="noopener noreferrer" class="text-cyan-700 font-bold hover:underline">فتح الخريطة</a>`
            : locationText;
        return `<tr class="border-b border-slate-100"><td class="p-5">${m.date}</td><td class="p-5 font-bold">${resolvePartyName(m, ['customer'])}</td><td class="p-5">${locationCell}</td><td class="p-5">${readText(m.type) || '-'}</td><td class="p-5 text-center"><span class="px-3 py-1 rounded-full text-xs font-bold ${m.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">${m.status === 'completed' ? 'مكتملة' : 'قيد التنفيذ'}</span></td><td class="p-5 text-center"><button onclick="editMaintenance(${m.id})" class="text-blue-600 hover:text-blue-800 font-bold">تعديل</button></td></tr>`;
    }).join('');
}

window.openMaintenanceModal = (maintenance = null) => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    const isEdit = !!(maintenance && maintenance.id);
    const customer = escapeHtmlAttr(maintenance && maintenance.customer);
    const location = escapeHtmlAttr(maintenance && maintenance.location);
    const mapUrl = escapeHtmlAttr(resolveMaintenanceMapUrl(maintenance));
    const type = escapeHtmlAttr(maintenance && maintenance.type);
    const status = readText(maintenance && maintenance.status) || 'pending';

    content.innerHTML = `<div class="p-8 bg-white text-right"><h3 class="text-2xl font-black mb-6">${isEdit ? 'تعديل الصيانة' : 'صيانة جديدة'}</h3><input type="text" id="m-cust" placeholder="العميل" class="w-full p-4 border mb-4" value="${customer}"><input type="text" id="m-loc" placeholder="وصف الموقع" class="w-full p-4 border mb-4" value="${location}"><input type="url" id="m-map-url" placeholder="رابط Google Maps (اختياري)" class="w-full p-4 border mb-4" dir="ltr" value="${mapUrl}"><input type="text" id="m-type" placeholder="نوع الصيانة" class="w-full p-4 border mb-4" value="${type}"><select id="m-status" class="w-full p-4 border mb-4"><option value="pending" ${status === 'pending' ? 'selected' : ''}>قيد التنفيذ</option><option value="completed" ${status === 'completed' ? 'selected' : ''}>مكتملة</option></select><button onclick="saveSupabaseMaint()" class="w-full bg-cyan-600 text-white py-4 rounded-xl font-bold">${isEdit ? 'حفظ التعديل' : 'حفظ'}</button></div>`;
    window.saveSupabaseMaint = async () => {
        const mapUrlInput = readText(document.getElementById('m-map-url').value);
        const locationValue = readText(document.getElementById('m-loc').value);
        const payload = {
            customer: readText(document.getElementById('m-cust').value),
            location: locationValue,
            map_url: mapUrlInput,
            type: readText(document.getElementById('m-type').value),
            status: document.getElementById('m-status').value || 'pending',
            date: new Date().toLocaleDateString('en-CA'),
        };

        let error = null;
        if (isEdit) {
            ({ error } = await _supabase.from('maintenances').update(payload).eq('id', maintenance.id));
        } else {
            ({ error } = await _supabase.from('maintenances').insert([payload]));
        }

        if (error && isMissingMaintenanceMapColumnError(error)) {
            const fallbackPayload = { ...payload };
            delete fallbackPayload.map_url;
            if (mapUrlInput && !fallbackPayload.location) fallbackPayload.location = mapUrlInput;
            if (isEdit) {
                ({ error } = await _supabase.from('maintenances').update(fallbackPayload).eq('id', maintenance.id));
            } else {
                ({ error } = await _supabase.from('maintenances').insert([fallbackPayload]));
            }
        }

        if (error) {
            console.error(error);
            alert('تعذر حفظ الصيانة');
            return;
        }
        alert("تم"); closeModal(); renderMaintenances();
    };
};

window.editMaintenance = async (id) => {
    const maintenanceId = Number(id);
    if (!Number.isFinite(maintenanceId)) return;
    const { data, error } = await _supabase.from('maintenances').select('*').eq('id', maintenanceId).maybeSingle();
    if (error || !data) {
        if (error) console.error(error);
        alert('تعذر تحميل بيانات الصيانة');
        return;
    }
    window.openMaintenanceModal(data);
};

// 6. Expenses
async function renderExpenses() {
    const from = document.getElementById('expenses-from').value;
    const to = document.getElementById('expenses-to').value;
    let query = _supabase.from('expenses').select('*');
    if (from) query = query.gte('date', from);
    if (to) query = query.lte('date', to);
    const { data } = await query.order('date', { ascending: false });
    
    const tbody = document.getElementById('expenses-list');
    if(tbody && data) tbody.innerHTML = data.map(e => `
        <tr class="border-b border-slate-100">
            <td class="p-5">${e.date || '-'}</td>
            <td class="p-5">${readText(e.category) || '-'}</td>
            <td class="p-5 font-black text-rose-600">${formatAmount(e.amount)}</td>
            <td class="p-5 text-slate-500">${readText(e.description) || '-'}</td>
            <td class="p-5 text-center"></td>
        </tr>
    `).join('');
}

window.openExpenseModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `<div class="p-8 bg-white text-right"><h3 class="text-2xl font-black mb-6">مصروف جديد</h3><input type="text" id="e-cat" placeholder="البند" class="w-full p-4 border mb-4"><input type="number" id="e-val" placeholder="المبلغ" class="w-full p-4 border mb-4"><button onclick="saveSupabaseExpense()" class="w-full bg-rose-600 text-white py-4 rounded-xl font-bold">حفظ</button></div>`;
    window.saveSupabaseExpense = async () => {
        const e = { category: document.getElementById('e-cat').value, amount: Number(document.getElementById('e-val').value), date: new Date().toLocaleDateString('en-CA') };
        await _supabase.from('expenses').insert([e]);
        alert("تم"); closeModal(); renderExpenses(); updateDashboard();
    };
};

// 7. Users
async function renderUsers() {
    const { data, error } = await _supabase.from('users').select('*').order('id', { ascending: true });
    if (error) {
        console.error(error);
        alert('Failed to load users');
        return;
    }
    const tbody = document.getElementById('users-list');
    if(tbody) tbody.innerHTML = (data || []).map(u => `<tr class="border-b border-slate-100"><td class="p-5 font-bold">${u.username}</td><td class="p-5 text-center"><button onclick="deleteUser(${u.id})" class="text-rose-500"><i class="fas fa-trash-alt"></i></button></td></tr>`).join('');
}

window.openUserModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-4 md:p-6 bg-gradient-to-b from-slate-950 via-slate-900 to-black text-right text-white rounded-[2rem]">
            <div class="flex items-center justify-between mb-5">
                <div>
                    <h3 class="text-2xl font-black tracking-tight">إضافة مستخدم</h3>
                    <p class="text-slate-400 text-sm mt-1">إدارة وصول المستخدمين للنظام</p>
                </div>
                <div class="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/40 text-orange-300 flex items-center justify-center">
                    <i class="fas fa-user-plus text-lg"></i>
                </div>
            </div>

            <form id="u-form" class="space-y-4">
                <div class="bg-white/5 border border-white/10 rounded-2xl p-3">
                    <input type="text" id="u-name" placeholder="اسم المستخدم" class="w-full p-3 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-orange-400 outline-none" required>
                    <input type="password" id="u-pass" placeholder="كلمة المرور" class="w-full p-3 mt-3 rounded-xl bg-slate-900/80 border border-white/10 text-white placeholder:text-slate-400 focus:ring-2 focus:ring-orange-400 outline-none" required>
                </div>

                <div class="bg-white/5 border border-white/10 rounded-2xl p-4">
                    <p class="font-bold text-orange-300 mb-3">صلاحيات الأقسام</p>
                    <div class="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="sales" class="u-perm accent-orange-500" checked> <span>المبيعات</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="purchases" class="u-perm accent-orange-500"> <span>المشتريات</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="inventory" class="u-perm accent-orange-500"> <span>المخزن</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="expenses" class="u-perm accent-orange-500"> <span>المصاريف</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="treasury" class="u-perm accent-orange-500"> <span>الخزينة</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="employee-advances" class="u-perm accent-orange-500"> <span>سلف الموظفين</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="projects" class="u-perm accent-orange-500"> <span>المشاريع</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="contracts" class="u-perm accent-orange-500"> <span>العقود</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="returns" class="u-perm accent-orange-500"> <span>المرتجعات</span></label>
                        <label class="flex items-center gap-2 bg-slate-900/70 rounded-xl px-3 py-2"><input type="checkbox" value="maintenance" class="u-perm accent-orange-500"> <span>الصيانات</span></label>
                    </div>
                </div>

                <label class="flex items-center justify-between gap-3 bg-orange-500/10 border border-orange-400/30 rounded-2xl px-4 py-3">
                    <span class="font-bold text-orange-200">السماح بعرض الربح والتكلفة</span>
                    <input type="checkbox" id="u-financials" class="accent-orange-500 w-5 h-5">
                </label>

                <button type="submit" class="w-full bg-gradient-to-r from-orange-500 to-amber-500 text-black py-3.5 rounded-2xl font-black text-lg hover:brightness-110 transition">
                    إنشاء المستخدم
                </button>
            </form>
        </div>
    `;
    document.getElementById('u-form').onsubmit = async (e) => {
        e.preventDefault();
        const username = document.getElementById('u-name').value.trim();
        const password = document.getElementById('u-pass').value.trim();
        const permissions = Array.from(document.querySelectorAll('.u-perm:checked')).map(el => el.value);
        if (document.getElementById('u-financials').checked) permissions.push('financials');

        let result = await _supabase.from('users').insert([{ username, password, permissions }]);
        if (result.error) {
            result = await _supabase.from('users').insert([{ username, password, permissions: JSON.stringify(permissions) }]);
        }
        if (result.error) {
            console.error(result.error);
            alert(`Failed to create user: ${readText(result.error.message) || 'unknown error'}`);
            return;
        }
        closeModal(); renderUsers();
    };
};

window.deleteUser = async (id) => {
    if (confirm("حذف؟")) {
        const { error } = await _supabase.from('users').delete().eq('id', id);
        if (error) {
            console.error(error);
            alert('Failed to delete user');
            return;
        }
        renderUsers();
    }
};

async function updateDashboard() {
    const from = document.getElementById('dash-from').value;
    const to = document.getElementById('dash-to').value;
    
    let sq = _supabase.from('sales').select('total');
    let pq = _supabase.from('purchases').select('total');
    let eq = _supabase.from('expenses').select('amount');
    
    if (from) {
        sq = sq.gte('date', from);
        pq = pq.gte('date', from);
        eq = eq.gte('date', from);
    }
    if (to) {
        sq = sq.lte('date', to);
        pq = pq.lte('date', to);
        eq = eq.lte('date', to);
    }
    
    const { data: s } = await sq;
    const { data: p } = await pq;
    const { data: e } = await eq;
    
    const ts = (s || []).reduce((a, b) => a + safeNumber(b.total), 0);
    const tp = (p || []).reduce((a, b) => a + safeNumber(b.total), 0);
    const te = (e || []).reduce((a, b) => a + safeNumber(b.amount), 0);
    
    document.getElementById('total-sales').innerText = ts.toFixed(2);
    document.getElementById('total-purchases').innerText = tp.toFixed(2);
    document.getElementById('total-expenses').innerText = te.toFixed(2);
    document.getElementById('net-profit').innerText = (ts - tp - te).toFixed(2);
}

function getTreasuryEntries() {
    try {
        const raw = localStorage.getItem(TREASURY_LOCAL_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function setTreasuryEntries(entries) {
    localStorage.setItem(TREASURY_LOCAL_STORAGE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
}

async function renderTreasury() {
    const treasuryDateInput = document.getElementById('treasury-date');
    if (treasuryDateInput && !treasuryDateInput.value) {
        treasuryDateInput.value = new Date().toLocaleDateString('en-CA');
    }

    const [{ data: sales }, { data: purchases }, { data: expenses }] = await Promise.all([
        _supabase.from('sales').select('total'),
        _supabase.from('purchases').select('total'),
        _supabase.from('expenses').select('amount')
    ]);

    const operational = (sales || []).reduce((a, b) => a + safeNumber(b.total), 0)
        - (purchases || []).reduce((a, b) => a + safeNumber(b.total), 0)
        - (expenses || []).reduce((a, b) => a + safeNumber(b.amount), 0);

    let advancesImpact = 0;
    try {
        const { entries: advEntries } = await fetchEmployeeAdvanceEntries();
        const totalAdvances = (advEntries || [])
            .filter(x => readText(x.entry_type) === 'advance')
            .reduce((sum, x) => sum + safeNumber(x.amount), 0);
        const totalRepayments = (advEntries || [])
            .filter(x => readText(x.entry_type) === 'repayment')
            .reduce((sum, x) => sum + safeNumber(x.amount), 0);
        // Advances reduce treasury, repayments increase treasury.
        advancesImpact = totalRepayments - totalAdvances;
    } catch (err) {
        advancesImpact = 0;
    }

    const entries = getTreasuryEntries();
    const manual = entries.reduce((sum, item) => sum + (item.type === 'in' ? 1 : -1) * safeNumber(item.amount), 0);
    const balance = operational + manual + advancesImpact;

    const operationalEl = document.getElementById('treasury-operational');
    const manualEl = document.getElementById('treasury-manual');
    const balanceEl = document.getElementById('treasury-balance');
    if (operationalEl) operationalEl.innerText = operational.toFixed(2);
    if (manualEl) manualEl.innerText = (manual + advancesImpact).toFixed(2);
    if (balanceEl) balanceEl.innerText = balance.toFixed(2);

    const tbody = document.getElementById('treasury-list');
    if (tbody) {
        const sorted = [...entries].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        tbody.innerHTML = sorted.map(item => `
            <tr class="hover:bg-slate-50 transition border-b border-slate-100">
                <td class="p-5">${escapeHtmlAttr(item.date || '')}</td>
                <td class="p-5 font-bold ${item.type === 'in' ? 'text-emerald-600' : 'text-rose-600'}">${item.type === 'in' ? 'إيداع' : 'سحب'}</td>
                <td class="p-5 text-center font-black">${safeNumber(item.amount).toFixed(2)}</td>
                <td class="p-5">${escapeHtmlAttr(item.note || '-')}</td>
                <td class="p-5 text-center"><button onclick="deleteTreasuryEntry('${escapeHtmlAttr(item.id)}')" class="text-rose-500"><i class="fas fa-trash-alt"></i></button></td>
            </tr>
        `).join('');
    }

    const form = document.getElementById('treasury-form');
    if (form) {
        form.onsubmit = (e) => {
            e.preventDefault();
            const date = readText(document.getElementById('treasury-date').value);
            const type = readText(document.getElementById('treasury-type').value) === 'out' ? 'out' : 'in';
            const amount = safeNumber(document.getElementById('treasury-amount').value);
            const note = readText(document.getElementById('treasury-note').value);
            if (!date || amount <= 0) {
                alert('تحقق من بيانات الحركة');
                return;
            }
            const next = getTreasuryEntries();
            next.push({
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                date,
                type,
                amount,
                note
            });
            setTreasuryEntries(next);
            form.reset();
            if (treasuryDateInput) treasuryDateInput.value = new Date().toLocaleDateString('en-CA');
            renderTreasury();
        };
    }
}

window.deleteTreasuryEntry = (id) => {
    if (!id) return;
    if (!confirm('حذف الحركة؟')) return;
    const next = getTreasuryEntries().filter(item => String(item.id) !== String(id));
    setTreasuryEntries(next);
    renderTreasury();
};

function isMissingEmployeeAdvancesTableError(error) {
    const msg = readText(error && (error.message || error.details || error.hint)).toLowerCase();
    const code = readText(error && error.code).toUpperCase();
    return code === '42P01' || code === 'PGRST205' || (msg.includes('employee_advances') && (msg.includes('schema cache') || msg.includes('not find') || msg.includes('does not exist')));
}

function getEmployeeAdvancesLocalEntries() {
    try {
        const raw = localStorage.getItem(EMPLOYEE_ADVANCES_LOCAL_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        return [];
    }
}

function setEmployeeAdvancesLocalEntries(entries) {
    localStorage.setItem(EMPLOYEE_ADVANCES_LOCAL_STORAGE_KEY, JSON.stringify(Array.isArray(entries) ? entries : []));
}

async function fetchEmployeeAdvanceEntries() {
    const result = await _supabase.from('employee_advances').select('*').order('entry_date', { ascending: false });
    if (!result.error) {
        const normalized = (result.data || []).map(row => ({
            id: row.id,
            entry_date: row.entry_date,
            employee_name: readText(row.employee_name || row.employee),
            entry_type: readText(row.entry_type || row.type) === 'repayment' ? 'repayment' : 'advance',
            amount: safeNumber(row.amount),
            note: readText(row.note)
        }));
        return { entries: normalized, source: 'supabase' };
    }
    if (isMissingEmployeeAdvancesTableError(result.error)) {
        return { entries: getEmployeeAdvancesLocalEntries(), source: 'local' };
    }
    throw result.error;
}

async function renderEmployeeAdvances() {
    const dateInput = document.getElementById('adv-date');
    if (dateInput && !dateInput.value) dateInput.value = new Date().toLocaleDateString('en-CA');

    let dataset = { entries: [], source: 'local' };
    try {
        dataset = await fetchEmployeeAdvanceEntries();
    } catch (err) {
        console.error(err);
        alert(`تعذر تحميل سلف الموظفين: ${readText(err && err.message) || 'خطأ غير معروف'}`);
        return;
    }
    const entries = dataset.entries || [];

    const totalAdvances = entries.filter(x => x.entry_type === 'advance').reduce((s, x) => s + safeNumber(x.amount), 0);
    const totalRepayments = entries.filter(x => x.entry_type === 'repayment').reduce((s, x) => s + safeNumber(x.amount), 0);
    const outstanding = totalAdvances - totalRepayments;

    const totalAdvancesEl = document.getElementById('adv-total-advances');
    const totalRepaymentsEl = document.getElementById('adv-total-repayments');
    const outstandingEl = document.getElementById('adv-outstanding');
    if (totalAdvancesEl) totalAdvancesEl.innerText = formatAmount(totalAdvances);
    if (totalRepaymentsEl) totalRepaymentsEl.innerText = formatAmount(totalRepayments);
    if (outstandingEl) outstandingEl.innerText = formatAmount(outstanding);

    const byEmployee = {};
    entries.forEach(item => {
        const emp = readText(item.employee_name) || 'غير محدد';
        if (!byEmployee[emp]) byEmployee[emp] = { advance: 0, repayment: 0 };
        byEmployee[emp][item.entry_type === 'repayment' ? 'repayment' : 'advance'] += safeNumber(item.amount);
    });
    const summaryRows = Object.keys(byEmployee).sort((a, b) => a.localeCompare(b, 'ar')).map(emp => {
        const item = byEmployee[emp];
        const balance = item.advance - item.repayment;
        return `
            <tr class="border-b border-slate-100">
                <td class="p-5 font-bold">${escapeHtmlAttr(emp)}</td>
                <td class="p-5 text-center text-amber-600 font-black">${formatAmount(item.advance)}</td>
                <td class="p-5 text-center text-emerald-600 font-black">${formatAmount(item.repayment)}</td>
                <td class="p-5 text-center font-black ${balance > 0 ? 'text-rose-600' : 'text-emerald-700'}">${formatAmount(balance)}</td>
            </tr>
        `;
    }).join('');
    const summaryTbody = document.getElementById('adv-summary-list');
    if (summaryTbody) summaryTbody.innerHTML = summaryRows || `<tr><td class="p-5 text-center text-slate-400" colspan="4">لا توجد بيانات</td></tr>`;

    const txRows = entries.map(item => `
        <tr class="border-b border-slate-100">
            <td class="p-5">${escapeHtmlAttr(item.entry_date || '-')}</td>
            <td class="p-5 font-bold">${escapeHtmlAttr(item.employee_name || '-')}</td>
            <td class="p-5 ${item.entry_type === 'repayment' ? 'text-emerald-600' : 'text-amber-600'} font-bold">${item.entry_type === 'repayment' ? 'تسديد' : 'سلفة'}</td>
            <td class="p-5 text-center font-black">${formatAmount(item.amount)}</td>
            <td class="p-5">${escapeHtmlAttr(item.note || '-')}</td>
            <td class="p-5 text-center">
                <button onclick="deleteEmployeeAdvanceEntry('${escapeHtmlAttr(String(item.id || ''))}', '${dataset.source}')" class="text-rose-500"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
    const txTbody = document.getElementById('adv-transactions-list');
    if (txTbody) txTbody.innerHTML = txRows || `<tr><td class="p-5 text-center text-slate-400" colspan="6">لا توجد حركات</td></tr>`;

    const form = document.getElementById('employee-advance-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const payload = {
                entry_date: readText(document.getElementById('adv-date').value) || new Date().toLocaleDateString('en-CA'),
                employee_name: readText(document.getElementById('adv-employee').value),
                entry_type: readText(document.getElementById('adv-type').value) === 'repayment' ? 'repayment' : 'advance',
                amount: safeNumber(document.getElementById('adv-amount').value),
                note: readText(document.getElementById('adv-note').value)
            };
            if (!payload.employee_name || payload.amount <= 0) {
                alert('يرجى إدخال اسم الموظف والمبلغ بشكل صحيح');
                return;
            }

            if (dataset.source === 'supabase') {
                const { error } = await _supabase.from('employee_advances').insert([payload]);
                if (error) {
                    if (isMissingEmployeeAdvancesTableError(error)) {
                        const local = getEmployeeAdvancesLocalEntries();
                        local.push({ ...payload, id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });
                        setEmployeeAdvancesLocalEntries(local);
                    } else {
                        console.error(error);
                        alert(`فشل الحفظ: ${readText(error.message) || 'خطأ غير معروف'}`);
                        return;
                    }
                }
            } else {
                const local = getEmployeeAdvancesLocalEntries();
                local.push({ ...payload, id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}` });
                setEmployeeAdvancesLocalEntries(local);
            }

            form.reset();
            if (dateInput) dateInput.value = new Date().toLocaleDateString('en-CA');
            renderEmployeeAdvances();
            renderTreasury();
        };
    }
}

window.deleteEmployeeAdvanceEntry = async (id, source = 'supabase') => {
    if (!id) return;
    if (!confirm('حذف الحركة؟')) return;
    if (source === 'supabase') {
        const { error } = await _supabase.from('employee_advances').delete().eq('id', id);
        if (error && !isMissingEmployeeAdvancesTableError(error)) {
            console.error(error);
            alert('تعذر حذف الحركة');
            return;
        }
    } else {
        const next = getEmployeeAdvancesLocalEntries().filter(item => String(item.id) !== String(id));
        setEmployeeAdvancesLocalEntries(next);
    }
    renderEmployeeAdvances();
    renderTreasury();
};

function closeModal() { document.getElementById('modal-container').classList.add('hidden'); }
window.closeModal = closeModal;

// Initialize
checkAuth();


