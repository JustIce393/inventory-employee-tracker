// Global State
let employees = [];
let inventory = [];
let logs = [];
let assignments = [];
let currentTab = 'dashboard';
let companyData = null;

// DOM Elements
const tabs = document.querySelectorAll('.menu-item');
const panels = document.querySelectorAll('.tab-panel');
const pageTitle = document.getElementById('pageTitle');
const backendBadge = document.getElementById('backendBadge');

// Fetch and Refresh Data
async function refreshData() {
    try {
        // Fetch stats & status
        const statsRes = await fetch('/api/dashboard');
        const statsData = await statsRes.json();
        
        if (statsData.success) {
            updateDashboardStats(statsData.stats);
        }

        // Fetch employees
        const empRes = await fetch('/api/employees');
        const empData = await empRes.json();
        if (empData.success) {
            employees = empData.data;
            renderEmployees();
            updateEmployeeDeptDropdown();
            renderActiveEmployeesStream();
        }

        // Fetch inventory
        const invRes = await fetch('/api/inventory');
        const invData = await invRes.json();
        if (invData.success) {
            inventory = invData.data;
            renderInventory();
            updateLowStockWidget();
            updateAnalyticsWidget();
            updateMostStockedWidget();
            updateInventoryCategoryDropdown();
        }

        // Fetch assignments
        const assignRes = await fetch('/api/assignments');
        const assignData = await assignRes.json();
        if (assignData.success) {
            assignments = assignData.data;
            renderAssignments();
        }

        // Fetch audit logs
        const logsRes = await fetch('/api/logs');
        const logsData = await logsRes.json();
        if (logsData.success) {
            logs = logsData.data;
            renderLogs();
            renderRecentActivityWidget();
            updateSalesAnalytics();
        }

        // Fetch company details
        const companyRes = await fetch('/api/company');
        const companyDataRes = await companyRes.json();
        if (companyDataRes.success) {
            companyData = companyDataRes.company;
            renderCompanyHub();
        }

        // Check backend engine type
        detectBackendEngine();

    } catch (err) {
        console.error("Error fetching data:", err);
        showToast("Error connecting to the database server.", "error");
    }
}

// Check if C++ binary is being used
async function detectBackendEngine() {
    try {
        const res = await fetch('/api/dashboard'); // Use dashboard query as status probe
        // The server console logs which one is running, but let's check files
        // We can inspect the console log or let the server tell us.
        // We'll make a custom status query if available, or deduce it
        const headers = res.headers;
        // Simple indicator: check if data directory exists or query server
        const statusRes = await fetch('/api/employees');
        const statusData = await statusRes.json();
        
        // Since we are running in the browser, let's make an API call to server
        // to check backend binary existence.
        const engineRes = await fetch('/api/status').catch(() => null);
        if (engineRes && engineRes.ok) {
            const engineData = await engineRes.json();
            updateEngineBadge(engineData.engine);
        } else {
            // Standard fallback indicator if endpoint isn't fully updated yet
            updateEngineBadge("Flow Engine");
        }
    } catch(e) {
        updateEngineBadge("Flow Engine");
    }
}

function updateEngineBadge(engineName) {
    backendBadge.textContent = engineName;
    if (engineName.includes("C++")) {
        backendBadge.className = "badge backend-status status-cpp";
    } else {
        backendBadge.className = "badge backend-status status-js";
    }
}

// ----------------------------------------------------
// UI Renderers
// ----------------------------------------------------

function updateDashboardStats(stats) {
    document.getElementById('statEmployees').textContent = stats.totalEmployees;
    document.getElementById('statInventory').textContent = stats.totalInventoryItems;
    
    const valEl = document.getElementById('statInventoryValue');
    if (valEl) {
        valEl.textContent = `₹${(stats.totalInventoryValue || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    
    const lowStockVal = document.getElementById('statLowStock');
    if (lowStockVal) {
        lowStockVal.textContent = stats.lowStockItems;
        if (stats.lowStockItems > 0) {
            lowStockVal.classList.add('text-red');
        } else {
            lowStockVal.classList.remove('text-red');
        }
    }
}

function updateLowStockWidget() {
    const list = document.getElementById('dashboardLowStockList');
    const badgeCount = document.getElementById('lowStockAlertCount');
    const lowStockItems = inventory.filter(item => item.quantity <= item.threshold);
    
    badgeCount.textContent = `${lowStockItems.length} Items`;
    
    // Update sidebar alert badge dynamically
    const sidebarBadge = document.getElementById('inventoryAlertBadge');
    if (sidebarBadge) {
        if (lowStockItems.length > 0) {
            sidebarBadge.textContent = lowStockItems.length;
            sidebarBadge.style.display = 'inline-block';
        } else {
            sidebarBadge.style.display = 'none';
        }
    }
    
    if (lowStockItems.length === 0) {
        list.innerHTML = `<div class="empty-state">No low stock items! All inventories are healthy.</div>`;
        return;
    }

    list.innerHTML = lowStockItems.map(item => `
        <div class="alert-item" style="gap: 16px;">
            <div class="alert-info" style="flex: 1;">
                <h3>${escapeHtml(item.name)}</h3>
                <p>SKU: ${escapeHtml(item.sku)} | Location: ${escapeHtml(item.location)}</p>
            </div>
            <div class="alert-status" style="display: flex; align-items: center; gap: 12px; text-align: right;">
                <div>
                    <span class="alert-qty">${item.quantity} left</span>
                    <div class="alert-limit">Threshold: ${item.threshold}</div>
                </div>
                <button class="btn btn-primary" onclick="quickRestock(${item.id}, 5)" style="padding: 6px 10px; font-size: 0.75rem; font-weight: 700; border-radius: 6px; box-shadow: none;">
                    +5 Units
                </button>
            </div>
        </div>
    `).join('');
}

function renderRecentActivityWidget() {
    const feed = document.getElementById('dashboardActivityList');
    const recentLogs = logs.slice(0, 5); // display latest 5 logs

    if (recentLogs.length === 0) {
        feed.innerHTML = `<div class="empty-state">No recent activities found.</div>`;
        return;
    }

    feed.innerHTML = recentLogs.map(log => {
        let dotClass = 'dot-add';
        if (log.action.includes('ASSIGN')) dotClass = 'dot-assign';
        if (log.action.includes('RETURN')) dotClass = 'dot-return';
        if (log.action.includes('DELETE')) dotClass = 'dot-delete';

        return `
            <div class="activity-item">
                <div class="activity-dot ${dotClass}"></div>
                <div class="activity-details">
                    <p class="activity-text">${escapeHtml(log.details)}</p>
                    <span class="activity-time" title="${formatTimestamp(log.timestamp)}">${formatRelativeTime(log.timestamp)}</span>
                </div>
            </div>
        `;
    }).join('');
}

// QoL Feature: Category Analytics Widget
function updateAnalyticsWidget() {
    const list = document.getElementById('dashboardAnalyticsList');
    const badge = document.getElementById('analyticsCategoryCount');
    
    // Group quantities by category
    const categories = {};
    inventory.forEach(item => {
        const cat = item.category || 'Other';
        categories[cat] = (categories[cat] || 0) + Number(item.quantity);
    });
    
    const catKeys = Object.keys(categories);
    badge.textContent = `${catKeys.length} Categories`;
    
    if (catKeys.length === 0) {
        list.innerHTML = `<div class="empty-state">No inventory data to analyze.</div>`;
        return;
    }
    
    const maxQty = Math.max(...Object.values(categories));
    
    list.innerHTML = catKeys.map(cat => {
        const qty = categories[cat];
        const percent = maxQty > 0 ? (qty / maxQty) * 100 : 0;
        return `
            <div class="analytics-item" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 500; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary);">${escapeHtml(cat)}</span>
                    <span style="color: var(--text-primary); font-weight: 700;">${qty} Units</span>
                </div>
                <div style="background-color: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, var(--color-indigo), var(--color-primary)); width: ${percent}%; height: 100%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// Filter Variables
let employeeFilter = 'all';
let employeeDeptFilter = 'ALL';
let inventoryFilter = 'all';
let inventoryCategoryFilter = 'ALL';

function updateEmployeeDeptDropdown() {
    const deptSelect = document.getElementById('filterEmployeeDept');
    if (!deptSelect) return;
    const currentVal = deptSelect.value;
    
    const depts = new Set();
    employees.forEach(emp => {
        if (emp.department) depts.add(emp.department.trim());
    });
    
    deptSelect.innerHTML = `<option value="ALL">All Departments</option>`;
    depts.forEach(dept => {
        const option = document.createElement('option');
        option.value = dept;
        option.textContent = dept;
        if (dept === currentVal) option.selected = true;
        deptSelect.appendChild(option);
    });
}

function updateInventoryCategoryDropdown() {
    const catSelect = document.getElementById('filterInventoryCategory');
    if (!catSelect) return;
    const currentVal = catSelect.value;
    
    const cats = new Set();
    inventory.forEach(item => {
        if (item.category) cats.add(item.category.trim());
    });
    
    catSelect.innerHTML = `<option value="ALL">All Categories</option>`;
    cats.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        if (cat === currentVal) option.selected = true;
        catSelect.appendChild(option);
    });
}

function renderEmployees() {
    const grid = document.getElementById('employeesGrid');
    const searchVal = document.getElementById('searchEmployees') ? document.getElementById('searchEmployees').value.toLowerCase() : '';
    
    let filtered = employees;

    // Filter by tab
    if (employeeFilter === 'active-gear') {
        filtered = filtered.filter(emp => (emp.assignedGear || []).length > 0);
    } else if (employeeFilter === 'no-gear') {
        filtered = filtered.filter(emp => (emp.assignedGear || []).length === 0);
    }

    // Filter by department
    if (employeeDeptFilter !== 'ALL') {
        filtered = filtered.filter(emp => emp.department === employeeDeptFilter);
    }

    // Filter by search
    if (searchVal !== '') {
        filtered = filtered.filter(emp => 
            emp.name.toLowerCase().includes(searchVal) || 
            emp.role.toLowerCase().includes(searchVal) ||
            emp.department.toLowerCase().includes(searchVal) ||
            emp.email.toLowerCase().includes(searchVal)
        );
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Matching Employees</h3>
                <p>Try resetting filters or search queries.</p>
            </div>
        `;
        return;
    }

    // Aggregate units sold and detailed item breakdown by employee ID from logs
    const unitsSoldMap = {};
    const employeeSalesDetailMap = {}; // empId -> { itemId: { name, sku, qty, revenue } }

    (logs || []).forEach(log => {
        if (log.action === 'SALE') {
            const parts = log.details.split('|');
            if (parts.length >= 6) {
                const empId = Number(parts[0]);
                const itemId = Number(parts[2]);
                const itemName = parts[3];
                const sku = parts[4];
                const qty = parseInt(parts[5], 10) || 0;
                
                unitsSoldMap[empId] = (unitsSoldMap[empId] || 0) + qty;

                // Try to find the item in inventory to get current selling price
                const invItem = inventory.find(i => Number(i.id) === itemId);
                const sellingPrice = invItem ? (invItem.selling_price !== undefined ? invItem.selling_price : invItem.price) : 0;
                const revenue = qty * (sellingPrice || 0);

                if (!employeeSalesDetailMap[empId]) {
                    employeeSalesDetailMap[empId] = {};
                }
                if (!employeeSalesDetailMap[empId][itemId]) {
                    employeeSalesDetailMap[empId][itemId] = { name: itemName, sku: sku, qty: 0, revenue: 0 };
                }
                employeeSalesDetailMap[empId][itemId].qty += qty;
                employeeSalesDetailMap[empId][itemId].revenue += revenue;
            }
        }
    });

    grid.innerHTML = filtered.map(emp => {
        const unitsSold = unitsSoldMap[Number(emp.id)] || 0;
        const salesDetails = employeeSalesDetailMap[Number(emp.id)] || {};
        const salesDetailList = Object.values(salesDetails);
        const salesBreakdownHtml = salesDetailList.length === 0
            ? `<div style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; text-align: center;">No sales recorded yet.</div>`
            : salesDetailList.map(s => `
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 2px;">
                    <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">🏷️ ${escapeHtml(s.name)} <code style="font-size: 0.65rem; opacity: 0.7;">(x${s.qty})</code></span>
                    <strong style="color: var(--color-green);">₹${s.revenue.toLocaleString('en-IN', { minimumFractionDigits: 0 })}</strong>
                </div>
            `).join('');

        const gearItems = emp.assignedGear || [];
        const gearListHtml = gearItems.length === 0 
            ? `<div class="empty-state" style="padding: 8px 0; font-size: 0.8rem; color: var(--text-muted);">All clear! No equipment assigned.</div>`
            : gearItems.map(gear => `
                <div class="gear-item">
                    <div class="gear-name" title="${escapeHtml(gear.notes || '')}">
                        📦 ${escapeHtml(gear.item_name)} 
                        <span style="font-size: 0.7rem; opacity: 0.6;">(SKU: ${escapeHtml(gear.sku)})</span>
                    </div>
                    <button class="btn-gear-return" onclick="returnGear(${gear.assignment_id})">Return</button>
                </div>
            `).join('');

        return `
            <div class="grid-card">
                <div class="grid-card-header" style="align-items: center; gap: 12px;">
                    <div class="avatar-circle" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.95rem; background-color: ${getAvatarColor(emp.name)}; color: ${getAvatarTextColor(emp.name)}; flex-shrink: 0; box-shadow: 0 4px 8px rgba(0,0,0,0.12); border: 2px solid rgba(255,255,255,0.05);">
                        ${getInitials(emp.name)}
                    </div>
                    <div class="grid-card-title" style="flex: 1; min-width: 0;">
                        <h3 style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(emp.name)}">${escapeHtml(emp.name)}</h3>
                        <p style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 0.8rem; color: var(--text-secondary);">${escapeHtml(emp.role)} | ${escapeHtml(emp.department)}</p>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-icon-only" onclick="openEditEmployeeModal(${emp.id})" title="Edit Employee">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                        </button>
                        <button class="btn-icon-only btn-danger-hover" onclick="deleteEmployee(${emp.id})" title="Delete Employee">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="grid-card-details">
                    <div class="detail-row">
                        <span class="detail-label">Email:</span>
                        <span class="detail-value" style="font-size:0.8rem; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${escapeHtml(emp.email)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Contact:</span>
                        <span class="detail-value">${escapeHtml(emp.contact_number || 'N/A')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Salary:</span>
                        <span class="detail-value">₹${(emp.salary || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Status:</span>
                        <span class="detail-value"><span class="badge ${emp.status === 'Inactive' ? 'stock-out' : 'stock-ok'}" style="padding: 2px 6px; font-size: 0.65rem; border-radius: 4px; line-height: 1;">${emp.status || 'Active'}</span></span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Joined:</span>
                        <span class="detail-value">${emp.joined_date}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Units Sold:</span>
                        <span class="detail-value" style="font-weight: 700; color: var(--color-indigo);">${unitsSold} unit${unitsSold !== 1 ? 's' : ''}</span>
                    </div>
                </div>
                <div class="grid-card-gear">
                    <div class="gear-label">Assigned Gear (${gearItems.length})</div>
                    <div class="gear-list">
                        ${gearListHtml}
                    </div>
                </div>

                <!-- Detailed Sales Breakdown -->
                <div class="grid-card-gear" style="margin-top: 8px; border-top: 1px dashed var(--border-color); padding-top: 8px;">
                    <div class="gear-label" style="display: flex; justify-content: space-between; align-items: center;">
                        <span>Sales Breakdown</span>
                        <span style="font-size: 0.7rem; color: var(--text-muted);">Qty & Revenue</span>
                    </div>
                    <div style="max-height: 80px; overflow-y: auto; margin-top: 4px; padding-right: 2px;">
                        ${salesBreakdownHtml}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; margin-top: 8px;">
                    <button class="btn btn-outline" style="flex: 1; font-size: 0.8rem; padding: 6px 12px; white-space: nowrap;" onclick="openAssignModalForEmployee(${emp.id})">
                        + Assign Gear
                    </button>
                    ${emp.status !== 'Inactive' ? `
                    <button class="btn btn-secondary btn-success-hover" style="flex: 1; font-size: 0.8rem; padding: 6px 12px; white-space: nowrap;" onclick="payEmployeeSalary(${emp.id})">
                        💸 Pay Salary
                    </button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    const searchVal = document.getElementById('searchInventory') ? document.getElementById('searchInventory').value.toLowerCase() : '';
    
    let filtered = inventory;

    // Filter by tab
    if (inventoryFilter === 'low-stock') {
        filtered = filtered.filter(item => item.quantity <= item.threshold);
    } else if (inventoryFilter === 'out-of-stock') {
        filtered = filtered.filter(item => item.quantity === 0);
    }

    // Filter by category
    if (inventoryCategoryFilter !== 'ALL') {
        filtered = filtered.filter(item => item.category === inventoryCategoryFilter);
    }

    // Filter by search
    if (searchVal !== '') {
        filtered = filtered.filter(item => 
            item.name.toLowerCase().includes(searchVal) || 
            item.sku.toLowerCase().includes(searchVal) ||
            item.category.toLowerCase().includes(searchVal) ||
            item.location.toLowerCase().includes(searchVal)
        );
    }

    // Sort logic
    const sortVal = document.getElementById('sortInventory') ? document.getElementById('sortInventory').value : 'name';
    if (sortVal === 'name') {
        filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortVal === 'price-asc') {
        filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortVal === 'price-desc') {
        filtered.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortVal === 'qty-asc') {
        filtered.sort((a, b) => a.quantity - b.quantity);
    } else if (sortVal === 'qty-desc') {
        filtered.sort((a, b) => b.quantity - a.quantity);
    }
    
    if (filtered.length === 0) {
        grid.innerHTML = `
            <div class="empty-state" style="grid-column: 1 / -1;">
                <h3>No Matching Assets</h3>
                <p>Try resetting filters or search queries.</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = filtered.map(item => {
        let statusClass = 'stock-ok';
        let statusText = 'In Stock';
        if (item.quantity === 0) {
            statusClass = 'stock-out';
            statusText = 'Out of Stock';
        } else if (item.quantity <= item.threshold) {
            statusClass = 'stock-low';
            statusText = 'Low Stock';
        }

        const assignees = item.activeAssignments || [];
        const assigneeListHtml = assignees.length === 0
            ? `<span class="detail-value" style="color: var(--color-green); font-weight: 600; display: flex; align-items: center; gap: 4px;">🟢 Ready for checkout</span>`
            : assignees.map(a => `
                <span class="detail-value" style="font-size: 0.8rem; display:block; margin-bottom: 2px; color: var(--text-secondary);" title="Assigned on ${a.assigned_date}">
                    🤝 In use by <strong>${escapeHtml(a.employee_name)}</strong>
                </span>
            `).join('');

        // Progress bar for visual stock status
        const maxLimit = Math.max(10, item.threshold * 3);
        const stockPct = Math.min(100, Math.max(0, (item.quantity / maxLimit) * 100));
        let progressColor = 'var(--color-primary)';
        if (item.quantity === 0) progressColor = 'var(--color-red)';
        else if (item.quantity <= item.threshold) progressColor = 'var(--color-orange)';

        return `
            <div class="grid-card">
                <div class="grid-card-header">
                    <div class="grid-card-title">
                        <h3>${escapeHtml(item.name)}</h3>
                        <p>${escapeHtml(item.category)} | SKU: ${escapeHtml(item.sku)}</p>
                    </div>
                    <div style="display: flex; gap: 4px;">
                        <button class="btn-icon-only" onclick="openEditItemModal(${item.id})" title="Edit Item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                        </button>
                        <button class="btn-icon-only btn-danger-hover" onclick="deleteInventoryItem(${item.id})" title="Delete Item">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="grid-card-details">
                    <div class="detail-row" style="align-items: center;">
                        <span class="detail-label">Quantity:</span>
                        <div class="qty-adjuster">
                            <button class="btn-qty" onclick="adjustQty(${item.id}, -1)">−</button>
                            <input type="number" class="qty-input" value="${item.quantity}" min="0" onchange="setQty(${item.id}, parseInt(this.value, 10))">
                            <button class="btn-qty" onclick="adjustQty(${item.id}, 1)">+</button>
                        </div>
                    </div>
                    <div class="stock-progress-container" title="Stock availability level">
                        <div class="stock-progress-bar" style="width: ${stockPct}%; background-color: ${progressColor};"></div>
                    </div>
                    <div class="detail-row" style="margin-top: 10px;">
                        <span class="detail-label">Purchase Price (Cost):</span>
                        <span class="detail-value">₹${(item.purchase_price !== undefined ? item.purchase_price : (item.price || 0) * 0.7).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Selling Price (Retail):</span>
                        <span class="detail-value">₹${(item.selling_price !== undefined ? item.selling_price : (item.price || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Total Asset Value:</span>
                        <span class="detail-value">₹${((item.purchase_price !== undefined ? item.purchase_price : (item.price || 0) * 0.7) * item.quantity).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Barcode:</span>
                        <span class="detail-value">${escapeHtml(item.barcode || 'N/A')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Threshold:</span>
                        <span class="detail-value">${item.threshold}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Location:</span>
                        <span class="detail-value">${escapeHtml(item.location)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="detail-label">Supplier:</span>
                        <span class="detail-value" title="${escapeHtml(item.supplier_contact || '')}">${escapeHtml(item.supplier_name || 'N/A')}</span>
                    </div>
                    <div class="detail-row" style="flex-direction:column; border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 6px;">
                        <span class="gear-label" style="margin-bottom:4px;">Status / Assignment</span>
                        <div style="margin-top:2px;">
                            ${assigneeListHtml}
                        </div>
                    </div>
                </div>
                <div class="grid-card-footer">
                    <span class="stock-status-badge ${statusClass}">${statusText}</span>
                    <button class="btn btn-outline" style="font-size: 0.8rem; padding: 6px 12px;" 
                            onclick="openAssignModalForItem(${item.id})" 
                            ${item.quantity === 0 ? 'disabled' : ''}>
                        Assign Item
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderAssignments() {
    const tbody = document.getElementById('assignmentsTableBody');
    const badgeCount = document.getElementById('activeAssignBadgeCount');
    const searchVal = document.getElementById('searchAssignments') ? document.getElementById('searchAssignments').value.toLowerCase() : '';
    
    let filtered = assignments;
    
    if (searchVal !== '') {
        filtered = filtered.filter(a => 
            a.employee_name.toLowerCase().includes(searchVal) ||
            a.item_name.toLowerCase().includes(searchVal) ||
            a.sku.toLowerCase().includes(searchVal) ||
            a.notes.toLowerCase().includes(searchVal)
        );
    }
    
    badgeCount.textContent = `${filtered.length} Items Out`;
    
    const sideBadge = document.getElementById('assignmentsBadge');
    if (sideBadge) {
        if (assignments.length > 0) {
            sideBadge.textContent = assignments.length;
            sideBadge.style.display = 'inline-block';
        } else {
            sideBadge.style.display = 'none';
        }
    }

    if (filtered.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-state" style="text-align:center; padding: 25px;">No active gear assignments found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filtered.map(a => `
        <tr>
            <td>#${a.assignment_id}</td>
            <td>
                <strong>${escapeHtml(a.employee_name)}</strong>
                <div style="font-size:0.75rem; color:var(--text-muted);">Emp ID: #${a.employee_id}</div>
            </td>
            <td>${escapeHtml(a.item_name)}</td>
            <td><code style="background:rgba(255,255,255,0.05); padding:2px 6px; border-radius:4px; font-size:0.8rem;">${escapeHtml(a.sku)}</code></td>
            <td>${a.assigned_date}</td>
            <td><span style="font-size:0.8rem; color:var(--text-secondary); max-width:200px; display:inline-block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${escapeHtml(a.notes)}">${escapeHtml(a.notes || '—')}</span></td>
            <td>
                <button class="btn btn-outline" style="padding: 4px 8px; font-size: 0.75rem;" onclick="returnGear(${a.assignment_id})">
                    Return Gear
                </button>
            </td>
        </tr>
    `).join('');
}

function renderLogs() {
    const tbody = document.getElementById('logsTableBody');
    const actionFilter = document.getElementById('filterLogAction').value;
    const searchVal = document.getElementById('searchLogs').value.toLowerCase();
    
    let filteredLogs = logs;
    
    if (actionFilter !== 'ALL') {
        filteredLogs = filteredLogs.filter(log => log.action === actionFilter);
    }
    
    if (searchVal !== '') {
        filteredLogs = filteredLogs.filter(log => log.details.toLowerCase().includes(searchVal));
    }
    
    if (filteredLogs.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="empty-state">No matching transaction logs found.</td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredLogs.map(log => {
        let badgeClass = 'badge-add';
        if (log.action.includes('ASSIGN')) badgeClass = 'badge-assign';
        if (log.action.includes('RETURN')) badgeClass = 'badge-return';
        if (log.action.includes('DELETE')) badgeClass = 'badge-delete';
        if (log.action.includes('SET_QUANTITY') || log.action.includes('UPDATE_QUANTITY')) badgeClass = 'badge-assign';
        if (log.action.includes('EDIT')) badgeClass = 'badge-return';
        if (log.action.includes('RESET') || log.action.includes('LOAD_DEMO')) badgeClass = 'badge-delete';

        return `
            <tr>
                <td>#${log.id}</td>
                <td>
                    <strong>${formatRelativeTime(log.timestamp)}</strong>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${formatTimestamp(log.timestamp)}</div>
                </td>
                <td><span class="log-action-badge ${badgeClass}">${log.action.replace(/_/g, ' ')}</span></td>
                <td style="font-weight: 500;">${escapeHtml(log.details)}</td>
            </tr>
        `;
    }).join('');
}

// ----------------------------------------------------
// Modal and Navigation Functions
// ----------------------------------------------------

// Breadcrumb label map
const TAB_LABELS = {
    dashboard:   { label: 'Dashboard',   icon: '📊' },
    employees:   { label: 'Employees',   icon: '👥' },
    inventory:   { label: 'Inventory',   icon: '📦' },
    assignments: { label: 'Assignments', icon: '🔗' },
    company:     { label: 'Company Hub', icon: '🏢' },
    logs:        { label: 'Audit Logs',  icon: '📋' }
};

function updateBreadcrumb(tabName) {
    const crumb = document.getElementById('breadcrumbCurrent');
    if (!crumb) return;
    const tab = TAB_LABELS[tabName] || { label: tabName, icon: '' };
    // Animate update by briefly resetting
    crumb.style.opacity = '0';
    crumb.style.transform = 'translateX(-6px)';
    setTimeout(() => {
        crumb.textContent = `${tab.icon} ${tab.label}`;
        crumb.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        crumb.style.opacity = '1';
        crumb.style.transform = 'translateX(0)';
    }, 80);
}

function switchTab(tabName) {
    currentTab = tabName;
    tabs.forEach(t => {
        if (t.getAttribute('data-tab') === tabName) {
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });

    panels.forEach(p => {
        if (p.getAttribute('id') === `tab-${tabName}`) {
            p.classList.add('active');
        } else {
            p.classList.remove('active');
        }
    });

    const tab = TAB_LABELS[tabName] || { label: tabName.charAt(0).toUpperCase() + tabName.slice(1), icon: '' };
    pageTitle.textContent = tab.label;

    // Update breadcrumb
    updateBreadcrumb(tabName);
    
    // Change top bar header actions depending on active view
    const quickAssignBtn = document.getElementById('quickAssignBtn');
    if (tabName === 'logs') {
        quickAssignBtn.style.display = 'none';
    } else {
        quickAssignBtn.style.display = 'inline-flex';
    }
}

function openModal(modalId) {
    document.getElementById(modalId).classList.add('active');
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.remove('active');
}

// Populate assignment modal options dynamically
function populateAssignmentDropdowns(preselectedEmpId = null, preselectedItemId = null) {
    const empSelect = document.getElementById('assignEmployee');
    const itemSelect = document.getElementById('assignItem');

    // Reset dropdowns
    empSelect.innerHTML = `<option value="" disabled selected>Choose an employee...</option>`;
    itemSelect.innerHTML = `<option value="" disabled selected>Choose an item...</option>`;

    // Populate employees
    employees.forEach(emp => {
        const option = document.createElement('option');
        option.value = emp.id;
        option.textContent = `${emp.name} (${emp.role})`;
        if (preselectedEmpId && Number(emp.id) === Number(preselectedEmpId)) {
            option.selected = true;
        }
        empSelect.appendChild(option);
    });

    // Populate items (only those in stock)
    inventory.forEach(item => {
        if (item.quantity > 0 || (preselectedItemId && Number(item.id) === Number(preselectedItemId))) {
            const option = document.createElement('option');
            option.value = item.id;
            option.textContent = `${item.name} (SKU: ${item.sku}) | Qty: ${item.quantity}`;
            if (preselectedItemId && Number(item.id) === Number(preselectedItemId)) {
                option.selected = true;
            }
            itemSelect.appendChild(option);
        }
    });
}

function openAssignModalForEmployee(empId) {
    populateAssignmentDropdowns(empId, null);
    openModal('assignModal');
}

function openAssignModalForItem(itemId) {
    populateAssignmentDropdowns(null, itemId);
    openModal('assignModal');
}

// ----------------------------------------------------
// Form Submissions & API Actions
// ----------------------------------------------------

// Add or Edit Employee
document.getElementById('employeeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editEmployeeId').value;
    const isEdit = editId !== "";

    const payload = {
        name: document.getElementById('empName').value,
        email: document.getElementById('empEmail').value,
        role: document.getElementById('empRole').value,
        department: document.getElementById('empDept').value,
        salary: parseFloat(document.getElementById('empSalary').value || 0),
        contact_number: document.getElementById('empContact').value || '',
        status: document.getElementById('empStatus').value || 'Active'
    };

    try {
        const url = isEdit ? `/api/employees/${editId}` : '/api/employees';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.success) {
            showToast(isEdit ? "Employee details updated successfully." : "Employee added successfully.");
            closeModal('employeeModal');
            document.getElementById('employeeForm').reset();
            refreshData();
        } else {
            showToast(result.error || "Failed to save employee.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Open Edit Employee Modal
function openEditEmployeeModal(id) {
    const emp = employees.find(e => Number(e.id) === Number(id));
    if (!emp) return;

    document.getElementById('employeeModalTitle').textContent = "Edit Employee Details";
    document.getElementById('editEmployeeId').value = emp.id;
    
    document.getElementById('empName').value = emp.name;
    document.getElementById('empEmail').value = emp.email;
    document.getElementById('empRole').value = emp.role;
    document.getElementById('empDept').value = emp.department;
    document.getElementById('empSalary').value = emp.salary || 0;
    document.getElementById('empContact').value = emp.contact_number || '';
    document.getElementById('empStatus').value = emp.status || 'Active';

    openModal('employeeModal');
}

// Delete Employee
async function deleteEmployee(id) {
    if (!confirm("Are you sure you want to remove this employee?")) return;
    try {
        const res = await fetch(`/api/employees/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast("Employee removed successfully.");
            refreshData();
        } else {
            showToast(result.error || "Failed to remove employee.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
}

// Add or Edit Inventory Item
document.getElementById('inventoryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const editId = document.getElementById('editItemId').value;
    const isEdit = editId !== "";

    const payload = {
        name: document.getElementById('itemName').value,
        category: document.getElementById('itemCategory').value,
        sku: document.getElementById('itemSku').value,
        threshold: parseInt(document.getElementById('itemThreshold').value, 10),
        location: document.getElementById('itemLocation').value,
        price: parseFloat(document.getElementById('itemSellingPrice').value || 0),
        purchase_price: parseFloat(document.getElementById('itemPurchasePrice').value || 0),
        selling_price: parseFloat(document.getElementById('itemSellingPrice').value || 0),
        barcode: document.getElementById('itemBarcode').value || '',
        supplier_name: document.getElementById('itemSupplierName').value || '',
        supplier_contact: document.getElementById('itemSupplierContact').value || ''
    };

    if (!isEdit) {
        payload.quantity = parseInt(document.getElementById('itemQty').value, 10);
    }

    try {
        const url = isEdit ? `/api/inventory/${editId}` : '/api/inventory';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.success) {
            showToast(isEdit ? "Item updated successfully." : "Item cataloged successfully.");
            closeModal('inventoryModal');
            document.getElementById('inventoryForm').reset();
            refreshData();
        } else {
            showToast(result.error || "Failed to save inventory item.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Open Edit Modal pre-filled
function openEditItemModal(id) {
    const item = inventory.find(i => Number(i.id) === Number(id));
    if (!item) return;

    document.getElementById('inventoryModalTitle').textContent = "Edit Inventory Item";
    document.getElementById('editItemId').value = item.id;
    
    document.getElementById('itemName').value = item.name;
    document.getElementById('itemCategory').value = item.category;
    document.getElementById('itemSku').value = item.sku;
    document.getElementById('itemThreshold').value = item.threshold;
    document.getElementById('itemLocation').value = item.location;
    document.getElementById('itemPrice').value = item.price || 0;
    document.getElementById('itemPurchasePrice').value = item.purchase_price !== undefined ? item.purchase_price : (item.price || 0) * 0.7;
    document.getElementById('itemSellingPrice').value = item.selling_price !== undefined ? item.selling_price : (item.price || 0);
    document.getElementById('itemBarcode').value = item.barcode || '';
    document.getElementById('itemSupplierName').value = item.supplier_name || '';
    document.getElementById('itemSupplierContact').value = item.supplier_contact || '';

    // Hide quantity inputs in Edit mode
    const qtyRow = document.getElementById('itemQty').closest('.form-row');
    if (qtyRow) qtyRow.style.display = 'none';
    document.getElementById('itemQty').required = false;

    openModal('inventoryModal');
}

// Open Add Modal reset
function openAddInventoryModal() {
    document.getElementById('inventoryModalTitle').textContent = "Add Inventory Item";
    document.getElementById('editItemId').value = "";
    document.getElementById('inventoryForm').reset();
    
    // Show quantity inputs in Add mode
    const qtyRow = document.getElementById('itemQty').closest('.form-row');
    if (qtyRow) qtyRow.style.display = 'flex';
    document.getElementById('itemQty').required = true;
    
    openModal('inventoryModal');
}

// Delete Inventory Item
async function deleteInventoryItem(id) {
    if (!confirm("Are you sure you want to remove this item from catalog?")) return;
    try {
        const res = await fetch(`/api/inventory/${id}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast("Item deleted successfully.");
            refreshData();
        } else {
            showToast(result.error || "Failed to delete item.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
}

// Adjust inventory quantity directly
async function adjustQty(id, change) {
    if (change < 0) {
        triggerSaleModal(id, Math.abs(change));
        return;
    }
    try {
        const res = await fetch(`/api/inventory/${id}/quantity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ change })
        });
        const result = await res.json();
        if (result.success) {
            showToast(`Quantity updated by ${change >= 0 ? '+' : ''}${change}.`);
            refreshData();
        } else {
            showToast(result.error || "Failed to update quantity.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
}

// Set inventory quantity directly
async function setQty(id, value) {
    if (isNaN(value) || value < 0) {
        showToast("Quantity must be a positive number.", "error");
        refreshData(); // Revert in UI
        return;
    }
    
    const item = inventory.find(i => Number(i.id) === Number(id));
    if (item && value < item.quantity) {
        const diff = item.quantity - value;
        triggerSaleModal(id, diff);
        return;
    }

    try {
        const res = await fetch(`/api/inventory/${id}/quantity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value })
        });
        const result = await res.json();
        if (result.success) {
            showToast(`Quantity set to ${value}.`);
            refreshData();
        } else {
            showToast(result.error || "Failed to update quantity.", "error");
            refreshData(); // Revert in UI
        }
    } catch (err) {
        showToast("Error processing request.", "error");
        refreshData(); // Revert in UI
    }
}

// Quick restock button action on Dashboard alerts
async function quickRestock(id, qty) {
    try {
        const res = await fetch(`/api/inventory/${id}/quantity`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ change: qty })
        });
        const result = await res.json();
        if (result.success) {
            showToast(`Restocked catalog item by +${qty} units.`);
            refreshData();
        } else {
            showToast("Failed to restock item.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
}

// Assign Gear
document.getElementById('assignForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        employee_id: parseInt(document.getElementById('assignEmployee').value, 10),
        inventory_id: parseInt(document.getElementById('assignItem').value, 10),
        notes: document.getElementById('assignNotes').value
    };

    try {
        const res = await fetch('/api/inventory/assign', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.success) {
            showToast("Gear assigned successfully.");
            closeModal('assignModal');
            document.getElementById('assignForm').reset();
            refreshData();
        } else {
            showToast(result.error || "Failed to assign gear.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Return Gear
async function returnGear(assignmentId) {
    if (!confirm("Confirm receipt of returned inventory gear?")) return;
    try {
        const res = await fetch('/api/inventory/return', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ assignment_id: assignmentId })
        });
        const result = await res.json();
        if (result.success) {
            showToast("Gear returned to stock.");
            refreshData();
        } else {
            showToast(result.error || "Failed to process return.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
}

// ----------------------------------------------------
// UI Helpers & Setup
// ----------------------------------------------------

function showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    // Add simple icon
    const icon = type === 'success' 
        ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>`
        : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
        
    toast.innerHTML = `${icon} <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.remove();
    }, 4000);
}

function escapeHtml(unsafe) {
    if (!unsafe) return "";
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

function formatTimestamp(isoStr) {
    if (!isoStr) return "";
    try {
        const d = new Date(isoStr);
        return d.toLocaleString();
    } catch (e) {
        return isoStr;
    }
}

// Search filters using new centralized renderers
document.getElementById('searchEmployees').addEventListener('input', () => renderEmployees());
document.getElementById('searchInventory').addEventListener('input', () => renderInventory());
document.getElementById('sortInventory').addEventListener('change', () => renderInventory());

// Filter tab event handlers (Employees)
document.querySelectorAll('#employeeFilterTabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#employeeFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        employeeFilter = btn.getAttribute('data-filter');
        renderEmployees();
    });
});
document.getElementById('filterEmployeeDept').addEventListener('change', (e) => {
    employeeDeptFilter = e.target.value;
    renderEmployees();
});

// Filter tab event handlers (Inventory)
document.querySelectorAll('#inventoryFilterTabs .filter-tab').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('#inventoryFilterTabs .filter-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        inventoryFilter = btn.getAttribute('data-filter');
        renderInventory();
    });
});
document.getElementById('filterInventoryCategory').addEventListener('change', (e) => {
    inventoryCategoryFilter = e.target.value;
    renderInventory();
});

// Assignments search
document.getElementById('searchAssignments').addEventListener('input', () => renderAssignments());

// Event Listeners for Tabs
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        switchTab(tab.getAttribute('data-tab'));
    });
});

// Modal control buttons
document.getElementById('quickAssignBtn').addEventListener('click', () => {
    populateAssignmentDropdowns();
    openModal('assignModal');
});
document.getElementById('addEmployeeBtn').addEventListener('click', () => {
    document.getElementById('employeeModalTitle').textContent = "Add New Employee";
    document.getElementById('editEmployeeId').value = "";
    document.getElementById('employeeForm').reset();
    openModal('employeeModal');
});
document.getElementById('addInventoryBtn').addEventListener('click', () => openAddInventoryModal());
document.getElementById('viewAllLogsBtn').addEventListener('click', () => switchTab('logs'));

// QoL Feature: Load Demo Data
document.getElementById('loadDemoBtn').addEventListener('click', async () => {
    if (!confirm("Are you sure you want to load demo data? This will overwrite your current database.")) return;
    try {
        const res = await fetch('/api/demo', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            showToast("Demo dataset loaded successfully!");
            refreshData();
        } else {
            showToast(result.error || "Failed to load demo data.", "error");
        }
    } catch (err) {
        showToast("Error connecting to server.", "error");
    }
});

// QoL Feature: CSV Exports
document.getElementById('exportEmployeesCsvBtn').addEventListener('click', () => {
    if (employees.length === 0) {
        showToast("No employee records to export.", "error");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Name,Email,Role,Department,Joined Date,Gear Checked Out Count,Gear Details\n";
    
    employees.forEach(emp => {
        const gearList = emp.assignedGear || [];
        const gearStr = gearList.map(g => `${g.item_name} (SKU: ${g.sku})`).join(" | ");
        
        // Escape values to prevent CSV issues
        const name = `"${emp.name.replace(/"/g, '""')}"`;
        const role = `"${emp.role.replace(/"/g, '""')}"`;
        const dept = `"${emp.department.replace(/"/g, '""')}"`;
        const gear = `"${gearStr.replace(/"/g, '""')}"`;
        
        csvContent += `${emp.id},${name},${emp.email},${role},${dept},${emp.joined_date},${gearList.length},${gear}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `employees_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Employees list exported as CSV.");
});

document.getElementById('exportInventoryCsvBtn').addEventListener('click', () => {
    if (inventory.length === 0) {
        showToast("No inventory items to export.", "error");
        return;
    }
    
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "ID,Item Name,Category,SKU,Available Qty,Low Alert Threshold,Location,Active Assignment Count,Assignees\n";
    
    inventory.forEach(item => {
        const assignments = item.activeAssignments || [];
        const assigneesStr = assignments.map(a => `${a.employee_name} (on ${a.assigned_date})`).join(" | ");
        
        const name = `"${item.name.replace(/"/g, '""')}"`;
        const category = `"${item.category.replace(/"/g, '""')}"`;
        const sku = `"${item.sku.replace(/"/g, '""')}"`;
        const location = `"${item.location.replace(/"/g, '""')}"`;
        const assignees = `"${assigneesStr.replace(/"/g, '""')}"`;
        
        csvContent += `${item.id},${name},${category},${sku},${item.quantity},${item.threshold},${location},${assignments.length},${assignees}\n`;
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventory_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Inventory catalog exported as CSV.");
});

// Admin Features: Backup & Reset Database
document.getElementById('backupDbBtn').addEventListener('click', () => {
    const link = document.createElement("a");
    link.setAttribute("href", "/api/backup");
    link.setAttribute("download", "flow_backup.json");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Database backup downloaded successfully.");
});

document.getElementById('resetDbBtn').addEventListener('click', async () => {
    if (!confirm("WARNING: Are you sure you want to WIPE the database? This deletes all employees, inventory, and active assignments, and cannot be undone!")) return;
    try {
        const res = await fetch('/api/reset', { method: 'POST' });
        const result = await res.json();
        if (result.success) {
            showToast("Database wiped. Starting fresh!", "error");
            refreshData();
        } else {
            showToast(result.error || "Failed to reset database.", "error");
        }
    } catch (err) {
        showToast("Error connecting to server.", "error");
    }
});

// Log Search & Action Filters
document.getElementById('searchLogs').addEventListener('input', () => renderLogs());
document.getElementById('filterLogAction').addEventListener('change', () => renderLogs());

// ----------------------------------------------------
// Humanizing Helpers & Welcoming Features
// ----------------------------------------------------

function getInitials(name) {
    if (!name) return "?";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.trim().substring(0, Math.min(name.trim().length, 2)).toUpperCase();
}

function getAvatarColor(name) {
    const colors = [
        '#38bdf8', // Cyan
        '#818cf8', // Indigo
        '#f472b6', // Pink
        '#fb7185', // Rose
        '#fb923c', // Orange
        '#fbbf24', // Amber
        '#34d399', // Emerald
        '#2dd4bf', // Teal
        '#a78bfa'  // Purple
    ];
    if (!name) return colors[0];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

function getAvatarTextColor(name) {
    return '#0f172a'; // Dark color is clean and readable on bright pastel badges
}

function formatRelativeTime(isoStr) {
    if (!isoStr) return "";
    try {
        const date = new Date(isoStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMs < 30000) {
            return "just now";
        }
        if (diffMins < 60) {
            return `${diffMins}m ago`;
        }
        if (diffHours < 24) {
            return `${diffHours}h ago`;
        }
        if (diffDays === 1) {
            return "yesterday";
        }
        if (diffDays < 7) {
            return `${diffDays}d ago`;
        }
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch (e) {
        return isoStr;
    }
}

function updateGreeting() {
    const greetingEl = document.getElementById('dashboardGreeting');
    const subheadingEl = document.getElementById('dashboardSubheading');
    const emojiEl = document.getElementById('greetingEmoji');
    if (!greetingEl) return;
    
    const hours = new Date().getHours();
    let greeting = "Welcome back!";
    let emoji = "👋";
    let subheading = "Here is a snapshot of your workspace catalog and active team equipment assignments.";

    if (hours < 12) {
        greeting = "Good morning!";
        emoji = "🌅";
        subheading = "Start your day by checking on inventory levels and assigning gear to your new team members.";
    } else if (hours < 18) {
        greeting = "Good afternoon!";
        emoji = "☀️";
        subheading = "Keep track of active equipment and maintain a smooth workflow for your departments.";
    } else {
        greeting = "Good evening!";
        emoji = "🌙";
        subheading = "Reviewing the day's checkout logs? Let's check on active assignments and inventory health.";
    }

    greetingEl.textContent = greeting;
    emojiEl.textContent = emoji;
    subheadingEl.textContent = subheading;
}

function renderActiveEmployeesStream() {
    const streamEl = document.getElementById('activeEmployeesStream');
    if (!streamEl) return;
    
    // Find unique employees with assigned gear
    const activeEmps = employees.filter(emp => (emp.assignedGear || []).length > 0);
    
    if (activeEmps.length === 0) {
        streamEl.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;">😴 All team equipment is currently in stock.</span>`;
        return;
    }
    
    const maxAvatars = 5;
    const slice = activeEmps.slice(0, maxAvatars);
    
    const avatarsHtml = slice.map((emp, idx) => `
        <div class="stream-avatar" style="width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.75rem; background-color: ${getAvatarColor(emp.name)}; color: ${getAvatarTextColor(emp.name)}; border: 2px solid var(--bg-sidebar); margin-left: ${idx > 0 ? '-10px' : '0'}; box-shadow: 0 2px 5px rgba(0,0,0,0.2);" title="${escapeHtml(emp.name)} (${escapeHtml(emp.role)})">
            ${getInitials(emp.name)}
        </div>
    `).join('');
    
    const countText = activeEmps.length > maxAvatars 
        ? `and ${activeEmps.length - maxAvatars} others are currently using gear`
        : `are active with gear today`;
        
    streamEl.innerHTML = `
        <div style="display: flex; align-items: center; margin-right: 4px;">
            ${avatarsHtml}
        </div>
        <span style="font-size: 0.8rem; color: var(--text-secondary); font-weight: 500;">
            ${slice.map(e => e.name.split(' ')[0]).join(', ')} ${countText}
        </span>
    `;
}

// Initial Load & Theme Settings
document.addEventListener('DOMContentLoaded', () => {
    // Check Authentication first
    checkAuth();

    // Theme Initializer
    const themeSelector = document.getElementById('themeSelector');
    if (themeSelector) {
        const savedTheme = localStorage.getItem('flow-theme') || 'midnight';
        themeSelector.value = savedTheme;
        document.documentElement.setAttribute('data-theme', savedTheme);

        themeSelector.addEventListener('change', (e) => {
            const theme = e.target.value;
            document.documentElement.setAttribute('data-theme', theme);
            localStorage.setItem('flow-theme', theme);
            showToast(`Active Theme: ${theme.charAt(0).toUpperCase() + theme.slice(1)}`);
            updateGreeting(); // Dynamic update banner for theme consistency
        });
    }

    const isAdjCheck = document.getElementById('saleIsAdjustment');
    if (isAdjCheck) {
        isAdjCheck.addEventListener('change', (e) => {
            const empGroup = document.getElementById('saleEmployeeGroup');
            const empSelect = document.getElementById('saleEmployee');
            if (e.target.checked) {
                empGroup.style.display = 'none';
                empSelect.required = false;
            } else {
                empGroup.style.display = 'flex';
                empSelect.required = true;
            }
        });
    }

    updateGreeting();
    refreshData();
    // Poll stats every 10 seconds to keep UI live
    setInterval(refreshData, 10000);
});

// ----------------------------------------------------
// Sales / Consumption Feature Controllers
// ----------------------------------------------------

function triggerSaleModal(itemId, qtyChange) {
    const item = inventory.find(i => Number(i.id) === Number(itemId));
    if (!item) return;

    document.getElementById('saleItemId').value = itemId;
    document.getElementById('saleQtyChange').value = qtyChange;
    document.getElementById('saleQtyDisplay').value = qtyChange;
    
    document.getElementById('saleItemName').textContent = item.name;
    document.getElementById('saleItemDetails').textContent = `SKU: ${item.sku} | Current Stock: ${item.quantity}`;
    
    // Reset checkbox and employee selection
    const checkEl = document.getElementById('saleIsAdjustment');
    if (checkEl) checkEl.checked = false;
    
    const empGroup = document.getElementById('saleEmployeeGroup');
    if (empGroup) empGroup.style.display = 'flex';
    
    const empSelect = document.getElementById('saleEmployee');
    if (empSelect) {
        empSelect.required = true;
        empSelect.innerHTML = `<option value="" disabled selected>Select an employee...</option>`;
        
        // Populate employees dropdown
        employees.forEach(emp => {
            const opt = document.createElement('option');
            opt.value = emp.id;
            opt.textContent = `${emp.name} (${emp.role})`;
            empSelect.appendChild(opt);
        });
    }

    openModal('saleModal');
}

function cancelSaleModal() {
    closeModal('saleModal');
    refreshData(); // Revert any inputs
}

// Handle Sale Form Submission
document.getElementById('saleForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const itemId = document.getElementById('saleItemId').value;
    const qtyChange = parseInt(document.getElementById('saleQtyChange').value, 10);
    const isAdjustment = document.getElementById('saleIsAdjustment').checked;
    
    try {
        if (isAdjustment) {
            // Direct adjustment (negative quantity adjustment)
            const res = await fetch(`/api/inventory/${itemId}/quantity`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ change: -qtyChange })
            });
            const result = await res.json();
            if (result.success) {
                showToast(`Inventory updated (direct subtraction of -${qtyChange}).`);
                closeModal('saleModal');
                refreshData();
            } else {
                showToast(result.error || "Failed to update inventory.", "error");
            }
        } else {
            // Record a Sale
            const empId = document.getElementById('saleEmployee').value;
            const res = await fetch('/api/sales', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    employee_id: parseInt(empId, 10),
                    inventory_id: parseInt(itemId, 10),
                    quantity: qtyChange
                })
            });
            const result = await res.json();
            if (result.success) {
                const empName = document.getElementById('saleEmployee').options[document.getElementById('saleEmployee').selectedIndex].text.split(' (')[0];
                showToast(`Sale recorded! ${empName} processed checkout of ${qtyChange} units. 🎉`);
                closeModal('saleModal');
                refreshData();
            } else {
                showToast(result.error || "Failed to record sale.", "error");
            }
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

function updateSalesAnalytics() {
    const totalCountEl = document.getElementById('salesTotalCount');
    const mostSoldItemEl = document.getElementById('salesMostSoldItem');
    const mostSoldCountEl = document.getElementById('salesMostSoldCount');
    const leastSoldItemEl = document.getElementById('salesLeastSoldItem');
    const leastSoldCountEl = document.getElementById('salesLeastSoldCount');
    const breakdownListEl = document.getElementById('salesBreakdownList');
    
    if (!totalCountEl) return;

    // Filter sale logs
    const saleLogs = logs.filter(log => log.action === 'SALE');
    
    if (saleLogs.length === 0) {
        totalCountEl.textContent = "0 Sold";
        mostSoldItemEl.textContent = "None";
        mostSoldCountEl.textContent = "0 units (0%)";
        leastSoldItemEl.textContent = "None";
        leastSoldCountEl.textContent = "0 units (0%)";
        breakdownListEl.innerHTML = `<div class="empty-state">No sales recorded yet.</div>`;
        return;
    }

    // Parse and aggregate sales
    let totalSalesQty = 0;
    const itemSales = {}; // itemId -> { name, sku, qty }
    const parsedSales = [];

    saleLogs.forEach(log => {
        const parts = log.details.split('|');
        if (parts.length >= 6) {
            const empId = parts[0];
            const empName = parts[1];
            const itemId = parts[2];
            const itemName = parts[3];
            const sku = parts[4];
            const qty = parseInt(parts[5], 10);
            
            totalSalesQty += qty;
            
            if (!itemSales[itemId]) {
                itemSales[itemId] = { name: itemName, sku: sku, qty: 0 };
            }
            itemSales[itemId].qty += qty;
            
            parsedSales.push({
                empName,
                itemName,
                sku,
                qty,
                timestamp: log.timestamp
            });
        }
    });

    totalCountEl.textContent = `${totalSalesQty} Sold`;

    // Find most and least sold
    let mostSold = null;
    let leastSold = null;

    Object.keys(itemSales).forEach(itemId => {
        const current = itemSales[itemId];
        if (!mostSold || current.qty > mostSold.qty) mostSold = current;
        if (!leastSold || current.qty < leastSold.qty) leastSold = current;
    });

    if (mostSold) {
        const pct = totalSalesQty > 0 ? ((mostSold.qty / totalSalesQty) * 100).toFixed(0) : 0;
        mostSoldItemEl.textContent = mostSold.name;
        mostSoldCountEl.textContent = `${mostSold.qty} units (${pct}%)`;
    }
    
    if (leastSold) {
        const pct = totalSalesQty > 0 ? ((leastSold.qty / totalSalesQty) * 100).toFixed(0) : 0;
        leastSoldItemEl.textContent = leastSold.name;
        leastSoldCountEl.textContent = `${leastSold.qty} units (${pct}%)`;
    }

    // Render list of item breakdown percentages and top sellers
    const breakdownHtml = Object.keys(itemSales).map(itemId => {
        const item = itemSales[itemId];
        const pct = totalSalesQty > 0 ? (item.qty / totalSalesQty) * 100 : 0;
        return `
            <div class="analytics-item" style="margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 500; margin-bottom: 4px;">
                    <span style="color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.name)} <code style="font-size: 0.7rem; opacity: 0.7;">(${escapeHtml(item.sku)})</code></span>
                    <span style="color: var(--text-primary); font-weight: 700;">${item.qty} units (${pct.toFixed(0)}%)</span>
                </div>
                <div style="background-color: rgba(255, 255, 255, 0.05); height: 5px; border-radius: 2px; overflow: hidden;">
                    <div style="background: linear-gradient(90deg, var(--color-green), var(--color-primary)); width: ${pct}%; height: 100%; border-radius: 2px;"></div>
                </div>
            </div>
        `;
    }).join('');

    breakdownListEl.innerHTML = `
        <div style="max-height: 180px; overflow-y: auto; padding-right: 4px; margin-bottom: 10px;">
            ${breakdownHtml}
        </div>
        <div style="border-top: 1px solid var(--border-color); padding-top: 10px; margin-top: 10px;">
            <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; margin-bottom: 6px;">Recent Seller Activity</div>
            <div style="display: flex; flex-direction: column; gap: 8px; max-height: 100px; overflow-y: auto;">
                ${parsedSales.slice(0, 3).map(s => `
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                        <span style="color: var(--text-primary); font-weight: 500;">👤 ${escapeHtml(s.empName)}</span>
                        <span style="color: var(--text-secondary); max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(s.itemName)} (×${s.qty})</span>
                        <span style="color: var(--text-muted); font-size: 0.7rem;">${formatRelativeTime(s.timestamp)}</span>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
}

// ----------------------------------------------------
// Most Stocked Products Widget
// ----------------------------------------------------
function updateMostStockedWidget() {
    const list = document.getElementById('dashboardMostStockedList');
    if (!list) return;

    // Sort inventory items by quantity descending
    const sorted = [...inventory].sort((a, b) => b.quantity - a.quantity);
    const top5 = sorted.slice(0, 5);

    if (top5.length === 0) {
        list.innerHTML = `<div class="empty-state">No inventory data to display.</div>`;
        return;
    }

    const maxQty = Math.max(...top5.map(item => Number(item.quantity)), 1);

    list.innerHTML = top5.map(item => {
        const qty = item.quantity;
        const percent = (qty / maxQty) * 100;
        let progressColor = 'var(--color-primary)';
        if (qty === 0) progressColor = 'var(--color-red)';
        else if (qty <= item.threshold) progressColor = 'var(--color-orange)';

        return `
            <div class="analytics-item" style="margin-bottom: 16px;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 500; margin-bottom: 6px;">
                    <span style="color: var(--text-secondary); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(item.name)} <code style="font-size: 0.75rem; opacity: 0.7;">(${escapeHtml(item.sku)})</code></span>
                    <span style="color: var(--text-primary); font-weight: 700;">${qty} Units</span>
                </div>
                <div style="background-color: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; overflow: hidden;">
                    <div style="background: ${progressColor}; width: ${percent}%; height: 100%; border-radius: 3px; transition: width 0.5s ease;"></div>
                </div>
            </div>
        `;
    }).join('');
}

// ----------------------------------------------------
// Mock Auth & Session Management
// ----------------------------------------------------
function checkAuth() {
    const authOverlay = document.getElementById('authOverlay');
    if (!authOverlay) return;

    const session = localStorage.getItem('flow-session');
    if (session === 'true') {
        authOverlay.style.display = 'none';
    } else {
        authOverlay.style.display = 'flex';
    }
}

// Auth Form Submission
document.getElementById('authForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const passwordInput = document.getElementById('authPassword').value;
    const correctPwd = localStorage.getItem('stockflow-admin-pwd') || 'admin123';
    
    if (passwordInput === correctPwd) {
        localStorage.setItem('flow-session', 'true');
        showToast("Logged in successfully!");
        document.getElementById('authPassword').value = "";
        checkAuth();
    } else {
        showToast("Incorrect administrator password.", "error");
    }
});

// Logout Action
document.getElementById('logoutBtn').addEventListener('click', () => {
    localStorage.removeItem('flow-session');
    showToast("Logged out successfully.");
    checkAuth();
});

// Change Password Action Trigger
document.getElementById('changePasswordBtn').addEventListener('click', () => {
    openModal('changePasswordModal');
});

// Change Password Form Submission
document.getElementById('changePasswordForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const currentPwd = document.getElementById('currentPassword').value;
    const newPwd = document.getElementById('newPassword').value;
    const confirmNew = document.getElementById('confirmNewPassword').value;

    const correctPwd = localStorage.getItem('flow-admin-pwd') || 'admin123';
    if (currentPwd !== correctPwd) {
        showToast("Current password is incorrect.", "error");
        return;
    }
    if (newPwd !== confirmNew) {
        showToast("New passwords do not match.", "error");
        return;
    }
    localStorage.setItem('flow-admin-pwd', newPwd);
    showToast("Password updated successfully!");
    closeModal('changePasswordModal');
    document.getElementById('changePasswordForm').reset();
});

// ----------------------------------------------------
// Restore Database Backup Actions
// ----------------------------------------------------
document.getElementById('restoreDbBtn').addEventListener('click', () => {
    document.getElementById('restoreFileInput').click();
});

document.getElementById('restoreFileInput').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
        try {
            const parsed = JSON.parse(evt.target.result);
            if (!parsed.employees || !parsed.inventory || !parsed.assignments || !parsed.logs) {
                showToast("Invalid backup file: missing tables.", "error");
                return;
            }

            const res = await fetch('/api/restore', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(parsed)
            });
            const result = await res.json();
            if (result.success) {
                showToast("Database restored successfully!");
                refreshData();
            } else {
                showToast(result.error || "Failed to restore database.", "error");
            }
        } catch (err) {
            showToast("Invalid JSON backup file.", "error");
        }
        // Reset file input value
        e.target.value = "";
    };
    reader.readAsText(file);
});

// ----------------------------------------------------
// Company Hub Features
// ----------------------------------------------------

function renderCompanyHub() {
    if (!companyData) return;

    const companyCashVal = document.getElementById('companyCashVal');
    const companyInventoryAssetVal = document.getElementById('companyInventoryAssetVal');
    const companyOtherAssetsVal = document.getElementById('companyOtherAssetsVal');
    const companyTotalAssetsVal = document.getElementById('companyTotalAssetsVal');
    const companyDebtsVal = document.getElementById('companyDebtsVal');
    const companyNetWorthVal = document.getElementById('companyNetWorthVal');
    
    const profileCompanyName = document.getElementById('profileCompanyName');
    const profileCompanyOwner = document.getElementById('profileCompanyOwner');
    const companyPartnersCountBadge = document.getElementById('companyPartnersCountBadge');
    const companyPartnersList = document.getElementById('companyPartnersList');

    const formatRupees = (val) => `₹${(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    // Calculate inventory asset value dynamically
    const totalInventoryValue = inventory.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.purchase_price !== undefined ? item.purchase_price : (item.price || 0) * 0.7)), 0);
    const totalAssets = Number(companyData.cash_available || 0) + totalInventoryValue + Number(companyData.other_assets_value || 0);
    const netWorth = totalAssets - Number(companyData.debts || 0);

    if (companyCashVal) companyCashVal.textContent = formatRupees(companyData.cash_available);
    if (companyInventoryAssetVal) companyInventoryAssetVal.textContent = formatRupees(totalInventoryValue);
    if (companyOtherAssetsVal) companyOtherAssetsVal.textContent = formatRupees(companyData.other_assets_value);
    if (companyTotalAssetsVal) companyTotalAssetsVal.textContent = formatRupees(totalAssets);
    if (companyDebtsVal) companyDebtsVal.textContent = formatRupees(companyData.debts);
    if (companyNetWorthVal) companyNetWorthVal.textContent = formatRupees(netWorth);

    if (profileCompanyName) profileCompanyName.textContent = companyData.name;
    if (profileCompanyOwner) profileCompanyOwner.textContent = companyData.owner;

    const partners = companyData.partners || [];
    if (companyPartnersCountBadge) {
        companyPartnersCountBadge.textContent = `${partners.length} Partner${partners.length !== 1 ? 's' : ''}`;
    }

    if (companyPartnersList) {
        if (partners.length === 0) {
            companyPartnersList.innerHTML = `<div class="empty-state">No share partners registered.</div>`;
            return;
        }

        const maxShares = Math.max(...partners.map(p => Number(p.shares)), 1);

        companyPartnersList.innerHTML = partners.map((p, index) => {
            const percent = (p.shares / maxShares) * 100;
            return `
                <div class="partner-item">
                    <div class="partner-meta">
                        <span style="color: var(--text-primary); font-weight: 600;">👤 ${escapeHtml(p.name)}</span>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <span style="color: var(--text-secondary); font-weight: 700;">${p.shares.toFixed(2)}%</span>
                            <div class="partner-actions">
                                <button class="btn-icon-only" onclick="openEditPartnerModal(${index})" title="Edit Partner">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path></svg>
                                </button>
                                <button class="btn-icon-only btn-danger-hover" onclick="deletePartner(${index})" title="Remove Partner">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                                </button>
                            </div>
                        </div>
                    </div>
                    <div style="background-color: rgba(255, 255, 255, 0.05); height: 6px; border-radius: 3px; overflow: hidden;">
                        <div style="background: linear-gradient(90deg, var(--color-primary), var(--color-indigo)); width: ${percent}%; height: 100%; border-radius: 3px;"></div>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Open Edit Profile Modal
document.getElementById('editCompanyProfileBtn').addEventListener('click', () => {
    if (!companyData) return;
    document.getElementById('companyNameInput').value = companyData.name;
    document.getElementById('companyOwnerInput').value = companyData.owner;
    document.getElementById('companyOtherAssetsInput').value = companyData.other_assets_value || 0;
    openModal('companyProfileModal');
});

// Edit Profile Form Submit
document.getElementById('companyProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
        name: document.getElementById('companyNameInput').value,
        owner: document.getElementById('companyOwnerInput').value,
        other_assets_value: parseFloat(document.getElementById('companyOtherAssetsInput').value || 0)
    };

    try {
        const res = await fetch('/api/company', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            showToast("Company profile updated successfully.");
            closeModal('companyProfileModal');
            refreshData();
        } else {
            showToast(result.error || "Failed to update profile.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Open Adjust Funds Modal
document.getElementById('adjustFundsTriggerBtn').addEventListener('click', () => {
    document.getElementById('adjustFundsForm').reset();
    openModal('adjustFundsModal');
});

// Adjust Funds Form Submit
document.getElementById('adjustFundsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const cash_change = parseFloat(document.getElementById('fundCashChange').value || 0);
    const debt_change = parseFloat(document.getElementById('fundDebtChange').value || 0);
    const details = document.getElementById('fundDetailsInput').value;

    if (cash_change === 0 && debt_change === 0) {
        showToast("Please enter a cash or debt adjustment value.", "error");
        return;
    }

    const payload = { cash_change, debt_change, details };

    try {
        const res = await fetch('/api/company/finances', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (result.success) {
            showToast("Finances adjusted successfully.");
            closeModal('adjustFundsModal');
            refreshData();
        } else {
            showToast(result.error || "Failed to adjust finances.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Open Add Partner Modal
document.getElementById('addPartnerTriggerBtn').addEventListener('click', () => {
    document.getElementById('partnerModalTitle').textContent = "Add Share Partner";
    document.getElementById('editPartnerIndex').value = "";
    document.getElementById('partnerForm').reset();
    openModal('partnerModal');
});

// Open Edit Partner Modal (Global Scope)
window.openEditPartnerModal = function(index) {
    if (!companyData || !companyData.partners || !companyData.partners[index]) return;
    const partner = companyData.partners[index];
    
    document.getElementById('partnerModalTitle').textContent = "Edit Share Partner";
    document.getElementById('editPartnerIndex').value = index;
    document.getElementById('partnerNameInput').value = partner.name;
    document.getElementById('partnerSharesInput').value = partner.shares;
    
    openModal('partnerModal');
};

// Partner Form Submit (Add/Edit)
document.getElementById('partnerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const index = document.getElementById('editPartnerIndex').value;
    const isEdit = index !== "";
    
    const payload = {
        name: document.getElementById('partnerNameInput').value,
        shares: parseFloat(document.getElementById('partnerSharesInput').value || 0)
    };

    try {
        const url = isEdit ? `/api/company/partners/${index}` : '/api/company/partners';
        const method = isEdit ? 'PUT' : 'POST';

        const res = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await res.json();
        
        if (result.success) {
            showToast(isEdit ? "Partner stake updated successfully." : "Share partner added successfully.");
            closeModal('partnerModal');
            document.getElementById('partnerForm').reset();
            refreshData();
        } else {
            showToast(result.error || "Failed to save partner.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Delete Partner (Global Scope)
window.deletePartner = async function(index) {
    if (!confirm("Are you sure you want to remove this share partner?")) return;
    try {
        const res = await fetch(`/api/company/partners/${index}`, { method: 'DELETE' });
        const result = await res.json();
        if (result.success) {
            showToast("Partner removed successfully.");
            refreshData();
        } else {
            showToast(result.error || "Failed to remove partner.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
};

// Pay individual employee salary (Global Scope)
window.payEmployeeSalary = async function(empId) {
    const emp = employees.find(e => Number(e.id) === Number(empId));
    if (!emp) return;
    if (!confirm(`Are you sure you want to pay the salary of ₹${(emp.salary || 0).toLocaleString()} to ${emp.name}?`)) return;
    
    try {
        const res = await fetch(`/api/employees/${empId}/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ months: 1 })
        });
        const result = await res.json();
        if (result.success) {
            showToast(`Salary of ₹${result.data.amount_paid.toLocaleString()} paid to ${emp.name}.`);
            refreshData();
        } else {
            showToast(result.error || "Failed to pay salary.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
};

// Bulk Payroll Processing
document.getElementById('runPayrollManualBtn')?.addEventListener('click', async () => {
    if (!confirm("Are you sure you want to run payroll for all active employees?")) return;
    try {
        const res = await fetch('/api/company/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ months: 1 })
        });
        const result = await res.json();
        if (result.success) {
            showToast(`Payroll processed successfully! Paid ₹${result.data.amount_paid.toLocaleString()} to ${result.data.active_count} active employees.`);
            refreshData();
        } else {
            showToast(result.error || "Failed to process payroll.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Payroll Simulation Fast Forward
document.getElementById('runSimulationPayrollBtn')?.addEventListener('click', async () => {
    const monthsInput = document.getElementById('simulateMonthsInput');
    const months = parseInt(monthsInput?.value || '1', 10);
    if (isNaN(months) || months <= 0) {
        showToast("Please enter a valid number of months.", "error");
        return;
    }
    
    if (!confirm(`Are you sure you want to process payroll simulation for ${months} month(s)?`)) return;
    try {
        const res = await fetch('/api/company/payroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ months })
        });
        const result = await res.json();
        if (result.success) {
            showToast(`Payroll simulation processed! Paid ₹${result.data.amount_paid.toLocaleString()} over ${months} month(s).`);
            refreshData();
        } else {
            showToast(result.error || "Failed to process payroll simulation.", "error");
        }
    } catch (err) {
        showToast("Error processing request.", "error");
    }
});

// Auto-Payroll Scheduling
let autoPayrollIntervalId = null;

function updatePayrollScheduler() {
    const toggle = document.getElementById('autoPayrollToggle');
    const intervalSelect = document.getElementById('autoPayrollInterval');
    const statusBadge = document.getElementById('payrollStatusBadge');
    
    if (!toggle || !statusBadge) return;
    
    // Clear existing interval
    if (autoPayrollIntervalId) {
        clearInterval(autoPayrollIntervalId);
        autoPayrollIntervalId = null;
    }
    
    if (toggle.checked) {
        const intervalMs = parseInt(intervalSelect?.value || '30000', 10);
        statusBadge.textContent = "Auto-Payroll: Active";
        statusBadge.className = "card-badge bg-green-glow";
        
        autoPayrollIntervalId = setInterval(async () => {
            try {
                const res = await fetch('/api/company/payroll', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ months: 1 })
                });
                const result = await res.json();
                if (result.success) {
                    showToast(`💸 [Auto-Payroll] Paid ₹${result.data.amount_paid.toLocaleString()} to ${result.data.active_count} employee(s).`);
                    refreshData();
                } else {
                    // Turn toggle off on failure (e.g. Insufficient funds) and alert
                    showToast(`[Auto-Payroll Stopped]: ${result.error}`, "error");
                    toggle.checked = false;
                    updatePayrollScheduler();
                }
            } catch (err) {
                console.error("Auto-payroll error:", err);
            }
        }, intervalMs);
    } else {
        statusBadge.textContent = "Auto-Payroll: Disabled";
        statusBadge.className = "card-badge bg-indigo-glow";
    }
}

document.getElementById('autoPayrollToggle')?.addEventListener('change', updatePayrollScheduler);
document.getElementById('autoPayrollInterval')?.addEventListener('change', () => {
    const toggle = document.getElementById('autoPayrollToggle');
    if (toggle && toggle.checked) {
        updatePayrollScheduler();
    }
});
