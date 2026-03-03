// Catch global errors
window.onerror = function(message, source, lineno, colno, error) {
    alert("خطأ في النظام: " + message + "\nفي السطر: " + lineno);
    return true;
};

// Check if Dexie is loaded
if (typeof Dexie === 'undefined') {
    alert("تحذير: مكتبة قاعدة البيانات (Dexie) لم يتم تحميلها. يرجى التأكد من اتصال الإنترنت.");
}

// Initialize Database
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

db.open().then(() => {
    console.log("Database opened successfully");
}).catch(err => {
    console.error("Failed to open DB:", err);
    alert("فشل فتح قاعدة البيانات: " + err.message);
});

// Sidebar Toggle
const openSidebarBtn = document.getElementById('open-sidebar');
if(openSidebarBtn) openSidebarBtn.onclick = () => document.getElementById('sidebar').classList.add('active');

const closeSidebarBtn = document.getElementById('close-sidebar');
if(closeSidebarBtn) closeSidebarBtn.onclick = () => document.getElementById('sidebar').classList.remove('active');

// Auth logic
async function checkAuth() {
    console.log("Checking authentication...");
    try {
        const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
        if (isLoggedIn) {
            const userStr = sessionStorage.getItem('currentUser');
            if (userStr) {
                const user = JSON.parse(userStr);
                const loginScreen = document.getElementById('login-screen');
                const mainLayout = document.getElementById('main-layout');
                if(loginScreen) loginScreen.classList.add('hidden');
                if(mainLayout) mainLayout.classList.remove('hidden');
                const userDisplay = document.getElementById('user-display');
                if(userDisplay) userDisplay.innerText = user.username;
                applyPermissions(user);
                updateDashboard();
            } else {
                logout();
            }
        }
    } catch (err) {
        console.error("Auth error:", err);
        logout();
    }
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

// Helper for Arabic numbers
function toEnglish(str) {
    return str.replace(/[٠١٢٣٤٥٦٧٨٩]/g, function(d) {
        return d.charCodeAt(0) - 1632;
    }).replace(/[۰۱۲۳۴۵۶۷۸۹]/g, function(d) {
        return d.charCodeAt(0) - 1776;
    });
}

// Login Process
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const user = toEnglish(document.getElementById('username').value.trim());
        const pass = toEnglish(document.getElementById('password').value.trim());
        
        // Debugging
        console.log("Login attempt:", user, pass);
        
        // Hardcoded Master Admin
        if (user.toLowerCase() === "admin" && pass === "1234") {
            sessionStorage.setItem('isLoggedIn', 'true');
            sessionStorage.setItem('currentUser', JSON.stringify({username: 'admin', permissions: ['all']}));
            location.reload();
            return;
        }
        
        try {
            const dbUser = await db.users.where('username').equalsIgnoreCase(user).first();
            if (dbUser && dbUser.password === pass) {
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('currentUser', JSON.stringify(dbUser));
                location.reload();
            } else { 
                alert("خطأ: اسم المستخدم أو كلمة المرور غير صحيحة"); 
            }
        } catch (err) {
            console.error("Login DB error:", err);
            alert("خطأ في الاتصال بقاعدة البيانات: " + err.message);
        }
    };
} else {
    console.error("Login form not found in DOM");
}

function logout() { sessionStorage.clear(); location.reload(); }

// Section Navigation
function showSection(section) {
    const sections = ['dashboard', 'sales', 'purchases', 'inventory', 'expenses', 'projects', 'reports', 'users', 'returns', 'maintenance'];
    sections.forEach(s => {
        const el = document.getElementById(`section-${s}`);
        if (el) el.classList.add('hidden');
    });
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
    if (section === 'reports') renderReports();
    if (section === 'dashboard') updateDashboard();
}

function getSectionTitle(s) {
    const titles = { 
        dashboard:'لوحة التحكم', 
        sales:'المبيعات', 
        purchases:'المشتريات', 
        inventory:'المخزن', 
        expenses:'المصاريف', 
        projects:'المشاريع', 
        reports:'التقارير', 
        users:'المستخدمين', 
        returns:'المرتجعات',
        maintenance: 'الصيانات'
    };
    return titles[s] || s;
}

// --- MODULES ---

// 1. Inventory
async function renderInventory() {
    const data = await db.products.toArray();
    const tbody = document.getElementById('inventory-list');
    if(tbody) tbody.innerHTML = data.map(p => `
        <tr class="hover:bg-slate-50 transition">
            <td class="p-5 font-bold text-slate-900">${p.name}</td>
            <td class="p-5 text-center bg-blue-50/50 font-black text-blue-900">${p.quantity}</td>
            <td class="p-5 text-center text-emerald-600 font-bold">${p.buyPrice.toFixed(2)}</td>
            <td class="p-5 text-center text-indigo-600 font-bold">${p.sellPrice.toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick="editProduct(${p.id})" class="text-blue-600 hover:text-blue-800 ml-4 transition"><i class="fas fa-edit"></i></button>
                <button onclick="deleteProduct(${p.id})" class="text-rose-500 hover:text-rose-700 transition"><i class="fas fa-trash-alt"></i></button>
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
            <h3 class="text-3xl font-black mb-8 text-slate-800">إضافة منتج جديد</h3>
            <form id="prod-form" class="space-y-6">
                <div class="space-y-2">
                    <label class="block font-bold text-slate-700">اسم المنتج</label>
                    <input type="text" id="p-name" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right focus:ring-2 focus:ring-blue-500 outline-none" placeholder="مثلاً: مفصلات أبواب" required>
                </div>
                <div class="grid grid-cols-2 gap-4">
                    <div class="space-y-2">
                        <label class="block font-bold text-slate-700">سعر الشراء</label>
                        <input type="number" id="p-buy" step="0.01" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right" required>
                    </div>
                    <div class="space-y-2">
                        <label class="block font-bold text-slate-700">سعر البيع</label>
                        <input type="number" id="p-sell" step="0.01" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right" required>
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="block font-bold text-slate-700">الكمية الافتتاحية</label>
                    <input type="number" id="p-qty" class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-right" required>
                </div>
                <div class="flex gap-4 pt-4">
                    <button type="submit" class="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-bold hover:bg-blue-800 transition">حفظ المنتج</button>
                    <button type="button" onclick="closeModal()" class="px-8 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200">إلغاء</button>
                </div>
            </form>
        </div>
    `;
    document.getElementById('prod-form').onsubmit = async (e) => {
        e.preventDefault();
        await db.products.add({
            name: document.getElementById('p-name').value,
            buyPrice: Number(document.getElementById('p-buy').value),
            sellPrice: Number(document.getElementById('p-sell').value),
            quantity: Number(document.getElementById('p-qty').value)
        });
        closeModal();
        renderInventory();
    };
};

window.deleteProduct = async (id) => { if(confirm("هل أنت متأكد من حذف هذا المنتج؟")) { await db.products.delete(id); renderInventory(); } };

// 2. Invoicing (Sales & Purchases)
async function renderSales() {
    const data = await db.sales.toArray();
    const tbody = document.getElementById('sales-list');
    if(tbody) tbody.innerHTML = data.reverse().map(s => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-5 font-bold">#INV-${s.id}</td>
            <td class="p-5">${s.date}</td>
            <td class="p-5 font-black text-slate-700">${s.customer}</td>
            <td class="p-5 text-center text-emerald-600 font-black">${s.total.toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick="viewInvoice(${s.id}, 'sale')" class="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-sm font-bold ml-2">عرض</button>
                <button onclick="deleteInvoice(${s.id}, 'sale')" class="text-rose-400 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
}

async function renderPurchases() {
    const data = await db.purchases.toArray();
    const tbody = document.getElementById('purchases-list');
    if(tbody) tbody.innerHTML = data.reverse().map(p => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-5 font-bold">#PUR-${p.id}</td>
            <td class="p-5">${p.date}</td>
            <td class="p-5 font-black text-slate-700">${p.supplier}</td>
            <td class="p-5 text-center text-amber-600 font-black">${p.total.toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick="viewInvoice(${p.id}, 'purchase')" class="bg-amber-50 text-amber-600 px-4 py-2 rounded-xl text-sm font-bold ml-2">عرض</button>
                <button onclick="deleteInvoice(${p.id}, 'purchase')" class="text-rose-400 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openInvoiceModal = async (type) => {
    const products = await db.products.toArray();
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    let items = [];
    
    content.innerHTML = `
        <div class="p-6 bg-white text-right">
            <h3 class="text-2xl font-black mb-6 text-slate-800">${type === 'sale' ? 'فاتورة مبيعات جديدة' : 'فاتورة مشتريات جديدة'}</h3>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                   <input type="text" id="party-name" placeholder="${type === 'sale' ? 'اسم العميل' : 'اسم المورد'}" class="w-full p-3 border rounded-xl text-right bg-slate-50 font-bold">
                   <input type="date" id="inv-date" class="w-full p-3 border rounded-xl text-right bg-slate-50" value="${new Date().toISOString().split('T')[0]}">
                </div>
                
                <div class="flex gap-2 bg-slate-100 p-4 rounded-2xl">
                    <select id="item-select" class="flex-1 p-3 border rounded-xl text-right bg-white font-bold">
                        <option value="">-- اختر منتجاً --</option>
                        ${products.map(p => `<option value="${p.id}">${p.name} (متوفر: ${p.quantity})</option>`).join('')}
                    </select>
                    <input type="number" id="item-qty" placeholder="الكمية" class="w-24 p-3 border rounded-xl text-right bg-white">
                    <button onclick="addItemToInvoice()" class="bg-blue-600 text-white px-6 rounded-xl font-bold"><i class="fas fa-plus"></i></button>
                </div>

                <div class="border rounded-2xl overflow-hidden shadow-sm">
                    <table class="w-full text-right border-collapse">
                        <thead class="bg-slate-900 text-white text-xs">
                            <tr>
                                <th class="p-3">المنتج</th>
                                <th class="p-3 text-center">الكمية</th>
                                <th class="p-3 text-center">السعر</th>
                                <th class="p-3 text-center">الإجمالي</th>
                                <th class="p-3 w-10"></th>
                            </tr>
                        </thead>
                        <tbody id="invoice-items-list" class="text-sm"></tbody>
                    </table>
                </div>

                <div class="flex justify-between items-center bg-slate-900 text-white p-6 rounded-2xl">
                    <span class="text-xl font-black">إجمالي الفاتورة:</span>
                    <div class="flex items-baseline gap-2">
                        <span id="invoice-total" class="text-3xl font-black text-emerald-400">0.00</span>
                        <span class="text-sm">ر.س</span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <button onclick="saveInvoice('${type}')" class="bg-emerald-600 text-white py-4 rounded-2xl font-black text-lg hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">حفظ الفاتورة</button>
                    <button type="button" onclick="closeModal()" class="bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold hover:bg-slate-200 transition">إلغاء</button>
                </div>
            </div>
        </div>
    `;

    window.addItemToInvoice = () => {
        const id = parseInt(document.getElementById('item-select').value);
        const qty = parseInt(document.getElementById('item-qty').value);
        const product = products.find(p => p.id === id);
        if(!product || !qty) return;
        
        const price = type === 'sale' ? product.sellPrice : product.buyPrice;
        const exists = items.find(it => it.productId === id);
        
        if(exists) {
            exists.qty += qty;
            exists.total = exists.qty * exists.price;
        } else {
            items.push({ productId: id, name: product.name, qty, price, total: qty * price });
        }
        
        renderInvoiceItems();
        document.getElementById('item-qty').value = '';
    };

    window.removeItemFromInvoice = (index) => {
        items.splice(index, 1);
        renderInvoiceItems();
    };

    function renderInvoiceItems() {
        const tbody = document.getElementById('invoice-items-list');
        tbody.innerHTML = items.map((it, idx) => `
            <tr class="border-b">
                <td class="p-3 font-bold text-slate-700">${it.name}</td>
                <td class="p-3 text-center font-bold">${it.qty}</td>
                <td class="p-3 text-center">${it.price.toFixed(2)}</td>
                <td class="p-3 text-center font-black">${it.total.toFixed(2)}</td>
                <td class="p-3"><button onclick="removeItemFromInvoice(${idx})" class="text-rose-500"><i class="fas fa-times"></i></button></td>
            </tr>
        `).join('');
        const total = items.reduce((sum, it) => sum + it.total, 0);
        document.getElementById('invoice-total').innerText = total.toFixed(2);
    }

    window.saveInvoice = async (invType) => {
        const party = document.getElementById('party-name').value;
        const dateStr = document.getElementById('inv-date').value;
        const total = items.reduce((sum, it) => sum + it.total, 0);
        
        if(!party || items.length === 0) return alert("يرجى إكمال بيانات الفاتورة وإضافة أصناف");
        
        const data = { date: dateStr, total, items };
        let id;
        
        if(invType === 'sale') {
            data.customer = party;
            id = await db.sales.add(data);
            for(let it of items) await updateStock(it.productId, -it.qty);
        } else {
            data.supplier = party;
            id = await db.purchases.add(data);
            for(let it of items) await updateStock(it.productId, it.qty);
        }
        
        alert("تم حفظ الفاتورة بنجاح");
        closeModal();
        showSection(invType === 'sale' ? 'sales' : 'purchases');
        updateDashboard();
    };
};

// 3. Returns Logic
async function renderReturns() {
    const data = await db.returns.toArray();
    const tbody = document.getElementById('returns-list');
    if(tbody) tbody.innerHTML = data.reverse().map(r => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100">
            <td class="p-5 font-bold">#RET-${r.id}</td>
            <td class="p-5">${r.date}</td>
            <td class="p-5 font-bold ${r.type === 'sale' ? 'text-orange-600' : 'text-amber-600'}">
                ${r.type === 'sale' ? 'مرتجع مبيعات' : 'مرتجع مشتريات'}
            </td>
            <td class="p-5 font-black text-slate-700">${r.party}</td>
            <td class="p-5 text-center font-black">${r.total.toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick="viewInvoice(${r.id}, 'return')" class="bg-slate-100 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold ml-2">عرض</button>
            </td>
        </tr>
    `).join('');
}

window.openReturnModal = async () => {
    const products = await db.products.toArray();
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    let items = [];

    content.innerHTML = `
        <div class="p-6 bg-white text-right">
            <h3 class="text-2xl font-black mb-6 text-slate-800">فاتورة مرتجع جديدة</h3>
            <div class="space-y-4">
                <div class="grid grid-cols-2 gap-4">
                   <select id="ret-type" class="w-full p-3 border rounded-xl text-right bg-slate-50 font-bold">
                       <option value="sale">مرتجع مبيعات (رد للمخزن)</option>
                       <option value="purchase">مرتجع مشتريات (سحب من المخزن)</option>
                   </select>
                   <input type="text" id="ret-party" placeholder="اسم الطرف الآخر" class="w-full p-3 border rounded-xl text-right bg-slate-50 font-bold">
                </div>
                
                <div class="flex gap-2 bg-slate-50 p-4 rounded-2xl">
                    <select id="ret-item-select" class="flex-1 p-3 border rounded-xl text-right bg-white font-bold">
                        <option value="">-- اختر منتجاً --</option>
                        ${products.map(p => `<option value="${p.id}">${p.name}</option>`).join('')}
                    </select>
                    <input type="number" id="ret-item-qty" placeholder="الكمية" class="w-24 p-3 border rounded-xl text-right bg-white">
                    <input type="number" id="ret-item-price" placeholder="السعر" class="w-24 p-3 border rounded-xl text-right bg-white">
                    <button onclick="addItemToReturn()" class="bg-orange-600 text-white px-6 rounded-xl font-bold"><i class="fas fa-plus"></i></button>
                </div>

                <div class="border rounded-2xl overflow-hidden">
                    <table class="w-full text-right">
                        <thead class="bg-slate-800 text-white text-xs">
                            <tr><th class="p-3">المنتج</th><th class="p-3 text-center">الكمية</th><th class="p-3 text-center">السعر</th><th class="p-3 text-center">الإجمالي</th></tr>
                        </thead>
                        <tbody id="return-items-list" class="text-sm"></tbody>
                    </table>
                </div>

                <div class="text-left py-4 border-t flex justify-between">
                    <span class="text-xl font-black">إجمالي المرتجع:</span>
                    <span id="ret-total" class="text-2xl font-black text-rose-600">0.00</span>
                </div>

                <button onclick="saveReturn()" class="w-full bg-rose-600 text-white py-4 rounded-2xl font-black">حفظ المرتجع</button>
                <button type="button" onclick="closeModal()" class="w-full mt-2 text-slate-400 font-bold py-2 text-center">إلغاء</button>
            </div>
        </div>
    `;

    window.addItemToReturn = () => {
        const id = parseInt(document.getElementById('ret-item-select').value);
        const qty = parseInt(document.getElementById('ret-item-qty').value);
        const price = parseFloat(document.getElementById('ret-item-price').value);
        const product = products.find(p => p.id === id);
        if(!product || !qty || !price) return;
        
        items.push({ productId: id, name: product.name, qty, price, total: qty * price });
        
        document.getElementById('return-items-list').innerHTML = items.map(it => `
            <tr class="border-b">
                <td class="p-3">${it.name}</td>
                <td class="p-3 text-center">${it.qty}</td>
                <td class="p-3 text-center">${it.price.toFixed(2)}</td>
                <td class="p-3 text-center font-bold">${it.total.toFixed(2)}</td>
            </tr>
        `).join('');
        document.getElementById('ret-total').innerText = items.reduce((s, it) => s + it.total, 0).toFixed(2);
    };

    window.saveReturn = async () => {
        const type = document.getElementById('ret-type').value;
        const party = document.getElementById('ret-party').value;
        const total = items.reduce((s, it) => s + it.total, 0);
        
        if(!party || items.length === 0) return alert("بيانات غير كاملة");
        
        await db.returns.add({ date: new Date().toLocaleDateString('ar-EG'), type, party, items, total });
        
        // Update stock
        for(let it of items) {
            // Sale return: add back to stock. Purchase return: remove from stock.
            const change = type === 'sale' ? it.qty : -it.qty;
            await updateStock(it.productId, change);
        }
        
        alert("تم حفظ المرتجع");
        closeModal();
        renderReturns();
        updateDashboard();
    };
};

async function updateStock(id, change) { 
    const p = await db.products.get(id); 
    if(p) await db.products.update(id, { quantity: p.quantity + change }); 
}

// 4. Projects Logic
async function renderProjects() {
    const data = await db.projects.toArray();
    const tbody = document.getElementById('projects-list');
    if(tbody) tbody.innerHTML = data.reverse().map(p => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="p-5 font-bold">${p.name}</td>
            <td class="p-5">${p.customer}</td>
            <td class="p-5 text-center text-rose-600 font-bold">${p.totalCosts.toFixed(2)}</td>
            <td class="p-5 text-center text-blue-900 font-bold">${p.contractValue.toFixed(2)}</td>
            <td class="p-5 text-center text-emerald-600 font-black">${p.profit.toFixed(2)}</td>
            <td class="p-5 text-center">
                <button onclick="viewProject(${p.id})" class="text-indigo-600 hover:text-indigo-900 ml-4 font-bold">عرض</button>
                <button onclick="deleteProject(${p.id})" class="text-rose-400 hover:text-rose-600 transition"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openProjectModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    let costs = [];
    
    content.innerHTML = `
        <div class="p-8 bg-white text-right">
            <h3 class="text-3xl font-black mb-8">مشروع جديد</h3>
            <div class="grid grid-cols-2 gap-6 mb-8">
                <div class="space-y-2">
                    <label class="font-bold">اسم المشروع</label>
                    <input type="text" id="proj-name" class="w-full p-4 border rounded-2xl bg-slate-50 text-right">
                </div>
                <div class="space-y-2">
                    <label class="font-bold">اسم العميل</label>
                    <input type="text" id="proj-customer" class="w-full p-4 border rounded-2xl bg-slate-50 text-right">
                </div>
                <div class="space-y-2">
                    <label class="font-bold">الموقع / العنوان</label>
                    <input type="text" id="proj-location" class="w-full p-4 border rounded-2xl bg-slate-50 text-right">
                </div>
                <div class="space-y-2">
                    <label class="font-bold">قيمة العقد الإجمالية</label>
                    <input type="number" id="proj-value" class="w-full p-4 border rounded-2xl bg-slate-50 text-right">
                </div>
            </div>

            <div class="bg-indigo-50 p-6 rounded-3xl mb-8">
                <h4 class="font-black text-indigo-900 mb-4">بنود التكاليف</h4>
                <div class="flex gap-4 mb-4">
                    <input type="text" id="cost-item" placeholder="مثلاً: مواد بناء، عمالة..." class="flex-1 p-4 border rounded-xl text-right">
                    <input type="number" id="cost-amount" placeholder="المبلغ" class="w-32 p-4 border rounded-xl text-right">
                    <button onclick="addCostToProj()" class="bg-indigo-600 text-white px-8 rounded-xl font-bold">إضافة</button>
                </div>
                <div class="bg-white rounded-2xl overflow-hidden border border-indigo-100">
                    <table class="w-full text-right">
                        <thead class="bg-indigo-100 text-indigo-900 text-xs"><tr><th class="p-3">البند</th><th class="p-3 text-center">التكلفة</th><th class="p-3 w-10"></th></tr></thead>
                        <tbody id="proj-costs-list" class="text-sm"></tbody>
                    </table>
                </div>
            </div>

            <button onclick="saveProjectNow()" class="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xl hover:bg-black transition shadow-xl">حفظ المشروع</button>
            <button onclick="closeModal()" class="w-full mt-4 text-slate-400 font-bold py-2">إلغاء</button>
        </div>
    `;

    window.addCostToProj = () => {
        const item = document.getElementById('cost-item').value;
        const amount = parseFloat(document.getElementById('cost-amount').value);
        if(!item || !amount) return;
        costs.push({item, amount});
        renderCosts();
        document.getElementById('cost-item').value = ''; document.getElementById('cost-amount').value = '';
    };

    function renderCosts() {
        document.getElementById('proj-costs-list').innerHTML = costs.map((c, i) => `<tr class="border-b"><td class="p-3">${c.item}</td><td class="p-3 text-center font-bold text-rose-600">${c.amount.toFixed(2)}</td><td class="p-3"><button onclick="costs.splice(${i},1);renderCosts();" class="text-slate-400"><i class="fas fa-times"></i></button></td></tr>`).join('');
    }

    window.saveProjectNow = async () => {
        const name = document.getElementById('proj-name').value, customer = document.getElementById('proj-customer').value, value = parseFloat(document.getElementById('proj-value').value);
        const totalCosts = costs.reduce((s, c) => s + c.amount, 0);
        if(!name || !customer || isNaN(value)) return alert("يرجى إكمال البيانات الأساسية");
        
        await db.projects.add({ 
            name, customer, 
            location: document.getElementById('proj-location').value, 
            contractValue: value, totalCosts, 
            profit: value - totalCosts, costs, 
            date: new Date().toLocaleDateString('ar-EG') 
        });
        alert("تم حفظ المشروع بنجاح"); 
        closeModal(); 
        renderProjects();
        updateDashboard();
    };
};

// 5. Printing & Viewing (FIXED FOR A5)
window.viewInvoice = async (id, type) => {
    let inv;
    if(type === 'sale') inv = await db.sales.get(id);
    else if(type === 'purchase') inv = await db.purchases.get(id);
    else if(type === 'return') inv = await db.returns.get(id);
    
    if(!inv) return;

    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');

    const title = type === 'sale' ? 'فاتورة مبيعات' : (type === 'purchase' ? 'فاتورة مشتريات' : 'فاتورة مرتجع');
    const partyLabel = type === 'sale' ? 'العميل' : (type === 'purchase' ? 'المورد' : 'الطرف الثاني');
    const partyName = inv.customer || inv.supplier || inv.party;

    content.innerHTML = `
        <div id="printable-area" class="p-8 bg-white text-right max-w-[148mm] mx-auto">
            <div class="flex justify-between items-start border-b-4 border-blue-900 pb-6 mb-6">
                <div>
                    <h1 class="text-3xl font-black text-blue-900">ريم الخليج</h1>
                    <p class="text-sm font-bold text-slate-500">للتجارة والمقاولات العامة</p>
                    <p class="text-xs text-slate-400">سجل تجاري: 1234567890</p>
                </div>
                <div class="text-left">
                    <h2 class="text-2xl font-black text-slate-800">${title}</h2>
                    <p class="text-sm font-bold bg-slate-100 px-3 py-1 rounded mt-2">رقم: ${id}</p>
                    <p class="text-sm text-slate-500 mt-1">${inv.date}</p>
                </div>
            </div>

            <div class="grid grid-cols-2 gap-4 mb-8 bg-slate-50 p-4 rounded-2xl">
                <div>
                    <span class="text-xs text-slate-400 block mb-1">${partyLabel}:</span>
                    <span class="text-lg font-black text-slate-800">${partyName}</span>
                </div>
                <div class="text-left">
                    <span class="text-xs text-slate-400 block mb-1">طريقة الدفع:</span>
                    <span class="text-lg font-black text-slate-800">نقداً</span>
                </div>
            </div>

            <table class="w-full mb-8">
                <thead>
                    <tr class="bg-blue-900 text-white">
                        <th class="p-3 text-right">البيان</th>
                        <th class="p-3 text-center">الكمية</th>
                        <th class="p-3 text-center">السعر</th>
                        <th class="p-3 text-center">الإجمالي</th>
                    </tr>
                </thead>
                <tbody class="text-sm border-b-2 border-slate-200">
                    ${inv.items.map(it => `
                        <tr class="border-b border-slate-100">
                            <td class="p-3 font-bold text-slate-800">${it.name}</td>
                            <td class="p-3 text-center">${it.qty}</td>
                            <td class="p-3 text-center">${it.price.toFixed(2)}</td>
                            <td class="p-3 text-center font-black">${it.total.toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <div class="w-full flex justify-end">
                <div class="w-64 space-y-2">
                    <div class="flex justify-between p-2 border-b border-slate-100">
                        <span class="text-slate-500 font-bold">المجموع الفرعي:</span>
                        <span class="font-black">${inv.total.toFixed(2)}</span>
                    </div>
                    <div class="flex justify-between p-3 bg-blue-900 text-white rounded-xl">
                        <span class="text-lg font-bold">الإجمالي:</span>
                        <div class="flex items-baseline gap-1">
                            <span class="text-2xl font-black">${inv.total.toFixed(2)}</span>
                            <span class="text-xs">ر.س</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="mt-12 pt-8 border-t border-slate-100 flex justify-between text-[10px] text-slate-400 italic">
                <span>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</span>
                <span>تصميم وبرمجة: ريم الخليج</span>
            </div>
            
            <div class="flex gap-4 mt-8 no-print">
                <button onclick="printProfessionalInvoice()" class="flex-1 bg-blue-900 text-white py-4 rounded-2xl font-black hover:bg-blue-800"><i class="fas fa-print ml-2"></i> طباعة الفاتورة (A5)</button>
                <button onclick="closeModal()" class="px-8 bg-slate-100 text-slate-500 py-4 rounded-2xl font-bold">إغلاق</button>
            </div>
        </div>
    `;
};

window.printProfessionalInvoice = () => {
    const content = document.getElementById('printable-area').innerHTML;
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    
    printWindow.document.write(`
        <html dir="rtl">
        <head>
            <title>طباعة فاتورة - ريم الخليج</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
            <style>
                body { font-family: 'Cairo', sans-serif; padding: 10mm; }
                @page { size: A5; margin: 0; }
                .no-print { display: none !important; }
                @media print {
                    body { padding: 5mm; width: 148mm; height: 210mm; overflow: hidden; }
                }
            </style>
        </head>
        <body>
            <div class="max-w-full">
                ${content}
            </div>
            <script>
                // Wait for styles/fonts to load
                setTimeout(() => {
                    window.print();
                    window.close();
                }, 1000);
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

// 6. Global Helpers & Dashboard
async function updateDashboard() {
    const [s, p, e, r] = await Promise.all([
        db.sales.toArray(), 
        db.purchases.toArray(), 
        db.expenses.toArray(),
        db.returns.toArray()
    ]);
    
    // Total Sales: Sales - Sale Returns
    const ts = s.reduce((a, b) => a + b.total, 0) - r.filter(x => x.type === 'sale').reduce((a, b) => a + b.total, 0);
    // Total Purchases: Purchases - Purchase Returns
    const tp = p.reduce((a, b) => a + b.total, 0) - r.filter(x => x.type === 'purchase').reduce((a, b) => a + b.total, 0);
    // Total Expenses
    const te = e.reduce((a, b) => a + b.amount, 0);
    
    document.getElementById('total-sales').innerText = ts.toFixed(2);
    document.getElementById('total-purchases').innerText = tp.toFixed(2);
    document.getElementById('total-expenses').innerText = te.toFixed(2);
    document.getElementById('net-profit').innerText = (ts - tp - te).toFixed(2);
}

function closeModal() { document.getElementById('modal-container').classList.add('hidden'); }
window.closeModal = closeModal;

// Users Logic
async function renderUsers() {
    const data = await db.users.toArray();
    const tbody = document.getElementById('users-list');
    if(tbody) tbody.innerHTML = data.map(u => `
        <tr class="border-b border-slate-100">
            <td class="p-5 font-bold">${u.username}</td>
            <td class="p-5">
                <div class="flex flex-wrap gap-1">
                    ${(u.permissions || []).map(p => `<span class="bg-blue-50 text-blue-600 px-2 py-1 rounded text-xs font-bold">${getSectionTitle(p)}</span>`).join('')}
                </div>
            </td>
            <td class="p-5 text-center"><button onclick="deleteUser(${u.id})" class="text-rose-500"><i class="fas fa-trash-alt"></i></button></td>
        </tr>
    `).join('');
}

window.openUserModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right">
            <h3 class="text-2xl font-black mb-6">مستخدم جديد</h3>
            <form id="u-form" class="space-y-6">
                <input type="text" id="u-name" placeholder="اسم المستخدم" class="w-full p-4 border rounded-2xl text-right bg-slate-50" required>
                <input type="password" id="u-pass" placeholder="كلمة المرور" class="w-full p-4 border rounded-2xl text-right bg-slate-50" required>
                <div class="bg-slate-50 p-6 rounded-3xl">
                    <h4 class="font-black mb-4">صلاحيات الوصول:</h4>
                    <div class="grid grid-cols-2 gap-4">
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="sales"> مبيعات</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="purchases"> مشتريات</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="inventory"> مخزن</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="expenses"> مصاريف</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="projects"> مشاريع</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="maintenance"> الصيانات</label>
                        <label class="flex items-center gap-2 cursor-pointer"><input type="checkbox" name="p" value="returns"> المرتجعات</label>
                    </div>
                </div>
                <button type="submit" class="w-full bg-slate-900 text-white py-5 rounded-2xl font-bold text-lg">إنشاء المستخدم</button>
                <button type="button" onclick="closeModal()" class="w-full text-slate-400 py-2">إلغاء</button>
            </form>
        </div>
    `;
    document.getElementById('u-form').onsubmit = async (e) => {
        e.preventDefault();
        const perms = Array.from(document.querySelectorAll('input[name="p"]:checked')).map(el => el.value);
        await db.users.add({ 
            username: document.getElementById('u-name').value, 
            password: document.getElementById('u-pass').value, 
            permissions: perms 
        });
        alert("تم إنشاء المستخدم بنجاح");
        closeModal();
        renderUsers();
    };
};

window.deleteUser = async (id) => { if(confirm("حذف المستخدم؟")) { await db.users.delete(id); renderUsers(); } };

// Expenses Logic
async function renderExpenses() {
    const data = await db.expenses.toArray();
    const tbody = document.getElementById('expenses-list');
    if(tbody) tbody.innerHTML = data.reverse().map(e => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="p-5">${e.date}</td>
            <td class="p-5 font-bold">${e.category}</td>
            <td class="p-5 font-black text-rose-600">${e.amount.toFixed(2)}</td>
            <td class="p-5 text-slate-400 text-sm">${e.description || '-'}</td>
            <td class="p-5 text-center"><button onclick="deleteExpense(${e.id})" class="text-rose-400 hover:text-rose-600"><i class="fas fa-trash-alt"></i></button></td>
        </tr>
    `).join('');
}

window.openExpenseModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right">
            <h3 class="text-2xl font-black mb-6">تسجيل مصروف جديد</h3>
            <form id="exp-form" class="space-y-6">
                <input type="text" id="e-cat" placeholder="بند المصروف (مثلاً: كهرباء، إيجار...)" class="w-full p-4 border rounded-2xl text-right bg-slate-50" required>
                <input type="number" id="e-amount" step="0.01" placeholder="المبلغ" class="w-full p-4 border rounded-2xl text-right bg-slate-50" required>
                <textarea id="e-desc" placeholder="ملاحظات إضافية" class="w-full p-4 border rounded-2xl text-right bg-slate-50 h-32"></textarea>
                <button type="submit" class="w-full bg-rose-600 text-white py-5 rounded-2xl font-black text-lg">حفظ المصروف</button>
                <button type="button" onclick="closeModal()" class="w-full text-slate-400 py-2">إلغاء</button>
            </form>
        </div>
    `;
    document.getElementById('exp-form').onsubmit = async (e) => {
        e.preventDefault();
        await db.expenses.add({
            date: new Date().toLocaleDateString('ar-EG'),
            category: document.getElementById('e-cat').value,
            amount: parseFloat(document.getElementById('e-amount').value),
            description: document.getElementById('e-desc').value
        });
        closeModal();
        renderExpenses();
        updateDashboard();
    };
};

window.deleteExpense = async (id) => { if(confirm("حذف؟")) { await db.expenses.delete(id); renderExpenses(); updateDashboard(); } };

// Maintenance Logic
async function renderMaintenances() {
    const data = await db.maintenances.toArray();
    const tbody = document.getElementById('maintenance-list');
    if(tbody) tbody.innerHTML = data.reverse().map(m => `
        <tr class="border-b border-slate-100 hover:bg-slate-50 transition">
            <td class="p-5">${m.date}</td>
            <td class="p-5 font-bold">${m.customer}</td>
            <td class="p-5">${m.location}</td>
            <td class="p-5">${m.type}</td>
            <td class="p-5 text-center">
                <span class="px-3 py-1 rounded-full text-xs font-bold ${m.status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}">
                    ${m.status === 'completed' ? 'مكتملة' : 'قيد التنفيذ'}
                </span>
            </td>
            <td class="p-5 text-center">
                <button onclick="deleteMaintenance(${m.id})" class="text-rose-400 hover:text-rose-600"><i class="fas fa-trash-alt"></i></button>
            </td>
        </tr>
    `).join('');
}

window.openMaintenanceModal = () => {
    const modal = document.getElementById('modal-container');
    const content = document.getElementById('modal-content');
    modal.classList.remove('hidden');
    content.innerHTML = `
        <div class="p-8 bg-white text-right">
            <h3 class="text-3xl font-black mb-8 text-cyan-900">سجل صيانة جديدة</h3>
            <form id="maint-form" class="space-y-6">
                <div class="grid grid-cols-2 gap-6">
                    <div class="space-y-2">
                        <label class="font-bold">العميل</label>
                        <input type="text" id="m-customer" class="w-full p-4 border rounded-2xl bg-slate-50 text-right" required>
                    </div>
                    <div class="space-y-2">
                        <label class="font-bold">الموقع</label>
                        <input type="text" id="m-location" class="w-full p-4 border rounded-2xl bg-slate-50 text-right" required>
                    </div>
                    <div class="space-y-2">
                        <label class="font-bold">نوع الصيانة</label>
                        <input type="text" id="m-type" placeholder="مثلاً: صيانة تكييف، كهرباء..." class="w-full p-4 border rounded-2xl bg-slate-50 text-right" required>
                    </div>
                    <div class="space-y-2">
                        <label class="font-bold">الحالة</label>
                        <select id="m-status" class="w-full p-4 border rounded-2xl bg-slate-50 text-right">
                            <option value="pending">قيد التنفيذ</option>
                            <option value="completed">مكتملة</option>
                        </select>
                    </div>
                </div>
                <div class="space-y-2">
                    <label class="font-bold">وصف الصيانة / ملاحظات</label>
                    <textarea id="m-desc" class="w-full p-4 border rounded-2xl bg-slate-50 text-right h-32"></textarea>
                </div>
                <button type="submit" class="w-full bg-cyan-600 text-white py-5 rounded-2xl font-black text-xl hover:bg-cyan-700 transition shadow-xl">حفظ الصيانة</button>
                <button type="button" onclick="closeModal()" class="w-full mt-4 text-slate-400 font-bold py-2">إلغاء</button>
            </form>
        </div>
    `;
    document.getElementById('maint-form').onsubmit = async (e) => {
        e.preventDefault();
        await db.maintenances.add({
            date: new Date().toLocaleDateString('ar-EG'),
            customer: document.getElementById('m-customer').value,
            location: document.getElementById('m-location').value,
            type: document.getElementById('m-type').value,
            status: document.getElementById('m-status').value,
            description: document.getElementById('m-desc').value
        });
        alert("تم حفظ الصيانة بنجاح");
        closeModal();
        renderMaintenances();
    };
};

window.deleteMaintenance = async (id) => { if(confirm("حذف سجل الصيانة؟")) { await db.maintenances.delete(id); renderMaintenances(); } };

// Initialize
checkAuth();
