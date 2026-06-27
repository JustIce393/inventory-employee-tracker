const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

// Initialize database file if it doesn't exist
function initDb() {
    const defaultCompany = {
        name: "StockFlow Solutions Ltd.",
        owner: "Radhika Sen",
        cash_available: 5000000.0,
        debts: 1200000.0,
        other_assets_value: 800000.0,
        partners: [
            { name: "Radhika Sen", shares: 60.0 },
            { name: "Amit Sharma", shares: 25.0 },
            { name: "Vikas Verma", shares: 15.0 }
        ]
    };

    if (!fs.existsSync(DB_FILE)) {
        const defaultDb = {
            company: defaultCompany,
            employees: [],
            inventory: [],
            assignments: [],
            logs: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 4), 'utf8');
        return defaultDb;
    }
    try {
        const content = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(content);
        if (!db.company) {
            db.company = defaultCompany;
            fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4), 'utf8');
        }
        return db;
    } catch (e) {
        // Fallback in case of corruption
        const defaultDb = {
            company: defaultCompany,
            employees: [],
            inventory: [],
            assignments: [],
            logs: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 4), 'utf8');
        return defaultDb;
    }
}

function saveDb(db) {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 4), 'utf8');
}

function logAction(db, action, details) {
    const log = {
        id: db.logs.length > 0 ? Math.max(...db.logs.map(l => l.id)) + 1 : 1,
        action,
        details,
        timestamp: new Date().toISOString()
    };
    db.logs.push(log);
}

function main() {
    const db = initDb();
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (!cmd) {
        console.log(JSON.stringify({ success: false, error: "No subcommand specified" }));
        return;
    }

    try {
        switch (cmd) {
            case 'get-dashboard-stats': {
                const totalEmployees = db.employees.length;
                const totalInventoryItems = db.inventory.reduce((sum, item) => sum + Number(item.quantity), 0);
                const activeAssignments = db.assignments.length;
                const lowStockItems = db.inventory.filter(item => Number(item.quantity) <= Number(item.threshold)).length;
                const totalInventoryValue = db.inventory.reduce((sum, item) => sum + (Number(item.quantity) * Number(item.price || 0)), 0);

                console.log(JSON.stringify({
                    success: true,
                    stats: {
                        totalEmployees,
                        totalInventoryItems,
                        activeAssignments,
                        lowStockItems,
                        totalInventoryValue
                    }
                }));
                break;
            }

            case 'list-employees': {
                // Return employees with their assigned gear details
                const result = db.employees.map(emp => {
                    const assignedGear = db.assignments
                        .filter(a => Number(a.employee_id) === Number(emp.id))
                        .map(a => {
                            const item = db.inventory.find(i => Number(i.id) === Number(a.inventory_id));
                            return {
                                assignment_id: a.id,
                                item_id: a.inventory_id,
                                item_name: item ? item.name : 'Unknown Item',
                                sku: item ? item.sku : '',
                                assigned_date: a.assigned_date,
                                notes: a.notes
                            };
                        });
                    return { ...emp, assignedGear };
                });
                console.log(JSON.stringify({ success: true, data: result }));
                break;
            }

            case 'add-employee': {
                const [_, name, email, role, department, salaryStr, contact_number, status] = args;
                if (!name || !email || !role || !department) {
                    console.log(JSON.stringify({ success: false, error: "Missing employee attributes" }));
                    return;
                }

                if (db.employees.some(e => e.email.toLowerCase() === email.toLowerCase())) {
                    console.log(JSON.stringify({ success: false, error: "Employee email already exists" }));
                    return;
                }

                const nextId = db.employees.length > 0 ? Math.max(...db.employees.map(e => e.id)) + 1 : 1;
                const salary = salaryStr ? parseFloat(salaryStr) : 0;
                const newEmp = {
                    id: nextId,
                    name,
                    email,
                    role,
                    department,
                    joined_date: new Date().toISOString().split('T')[0],
                    salary,
                    contact_number: contact_number || "",
                    status: status || "Active"
                };

                db.employees.push(newEmp);
                logAction(db, "ADD_EMPLOYEE", `Added employee: ${name} (${role})`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Employee added successfully", data: newEmp }));
                break;
            }

            case 'delete-employee': {
                const empId = Number(args[1]);
                if (isNaN(empId)) {
                    console.log(JSON.stringify({ success: false, error: "Invalid employee ID" }));
                    return;
                }

                const empIndex = db.employees.findIndex(e => Number(e.id) === empId);
                if (empIndex === -1) {
                    console.log(JSON.stringify({ success: false, error: "Employee not found" }));
                    return;
                }

                // Check if employee has active assignments
                const activeGearCount = db.assignments.filter(a => Number(a.employee_id) === empId).length;
                if (activeGearCount > 0) {
                    console.log(JSON.stringify({ 
                        success: false, 
                        error: "Cannot delete employee. They currently have active inventory items assigned." 
                    }));
                    return;
                }

                const empName = db.employees[empIndex].name;
                db.employees.splice(empIndex, 1);
                logAction(db, "DELETE_EMPLOYEE", `Deleted employee: ${empName}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Employee deleted successfully" }));
                break;
            }

            case 'list-inventory': {
                // Return items along with details of who has them assigned
                const result = db.inventory.map(item => {
                    const activeAssignments = db.assignments
                        .filter(a => Number(a.inventory_id) === Number(item.id))
                        .map(a => {
                            const emp = db.employees.find(e => Number(e.id) === Number(a.employee_id));
                            return {
                                assignment_id: a.id,
                                employee_id: a.employee_id,
                                employee_name: emp ? emp.name : 'Unknown Employee',
                                assigned_date: a.assigned_date,
                                notes: a.notes
                            };
                        });
                    return { ...item, activeAssignments };
                });
                console.log(JSON.stringify({ success: true, data: result }));
                break;
            }

            case 'add-item': {
                const [_, name, category, sku, quantityStr, thresholdStr, location, priceStr, purchasePriceStr, sellingPriceStr, supplier_name, supplier_contact, barcode] = args;
                if (!name || !category || !sku || !quantityStr || !thresholdStr || !location) {
                    console.log(JSON.stringify({ success: false, error: "Missing inventory item attributes" }));
                    return;
                }

                if (db.inventory.some(i => i.sku.toLowerCase() === sku.toLowerCase())) {
                    console.log(JSON.stringify({ success: false, error: "SKU already exists" }));
                    return;
                }

                const quantity = parseInt(quantityStr, 10);
                const threshold = parseInt(thresholdStr, 10);

                if (isNaN(quantity) || isNaN(threshold) || quantity < 0 || threshold < 0) {
                    console.log(JSON.stringify({ success: false, error: "Quantity and threshold must be positive integers" }));
                    return;
                }

                const price = priceStr ? parseFloat(priceStr) : 0;
                const selling_price = sellingPriceStr ? parseFloat(sellingPriceStr) : price;
                const purchase_price = purchasePriceStr ? parseFloat(purchasePriceStr) : (selling_price * 0.7);

                // Auto cash adjustment for initial stock purchase
                const cost = quantity * purchase_price;
                if (cost > 0) {
                    if ((db.company.cash_available || 0) < cost) {
                        console.log(JSON.stringify({ 
                            success: false, 
                            error: `Insufficient company cash available to purchase initial stock (Required: ${cost}, Available: ${db.company.cash_available || 0})` 
                        }));
                        return;
                    }
                    db.company.cash_available = (db.company.cash_available || 0) - cost;
                    logAction(db, "FINANCE_TRANSACTION", `Deducted ₹${cost} for initial stock purchase of ${name} (${quantity} units)`);
                }

                const nextId = db.inventory.length > 0 ? Math.max(...db.inventory.map(i => i.id)) + 1 : 1;
                const newItem = {
                    id: nextId,
                    name,
                    category,
                    sku,
                    quantity,
                    threshold,
                    location,
                    price,
                    purchase_price,
                    selling_price,
                    supplier_name: supplier_name || "",
                    supplier_contact: supplier_contact || "",
                    barcode: barcode || ""
                };

                db.inventory.push(newItem);
                logAction(db, "ADD_ITEM", `Added inventory item: ${name} (SKU: ${sku}) with Qty: ${quantity}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Inventory item added successfully", data: newItem }));
                break;
            }

            case 'delete-item': {
                const itemId = Number(args[1]);
                if (isNaN(itemId)) {
                    console.log(JSON.stringify({ success: false, error: "Invalid item ID" }));
                    return;
                }

                const itemIndex = db.inventory.findIndex(i => Number(i.id) === itemId);
                if (itemIndex === -1) {
                    console.log(JSON.stringify({ success: false, error: "Inventory item not found" }));
                    return;
                }

                // Check active assignments
                const activeCount = db.assignments.filter(a => Number(a.inventory_id) === itemId).length;
                if (activeCount > 0) {
                    console.log(JSON.stringify({ 
                        success: false, 
                        error: "Cannot delete item. It is currently assigned to one or more employees." 
                    }));
                    return;
                }

                const itemName = db.inventory[itemIndex].name;
                db.inventory.splice(itemIndex, 1);
                logAction(db, "DELETE_ITEM", `Deleted inventory item: ${itemName}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Inventory item deleted successfully" }));
                break;
            }

            case 'update-quantity': {
                const itemId = Number(args[1]);
                const change = Number(args[2]);

                if (isNaN(itemId) || isNaN(change)) {
                    console.log(JSON.stringify({ success: false, error: "Invalid item ID or change value" }));
                    return;
                }

                const item = db.inventory.find(i => Number(i.id) === itemId);
                if (!item) {
                    console.log(JSON.stringify({ success: false, error: "Inventory item not found" }));
                    return;
                }

                const originalQty = Number(item.quantity);
                const newQty = originalQty + change;
                if (newQty < 0) {
                    console.log(JSON.stringify({ success: false, error: "Quantity cannot fall below 0" }));
                    return;
                }

                // Auto cash adjustment for restock (purchase)
                if (change > 0) {
                    const purchase_price = item.purchase_price !== undefined ? item.purchase_price : (item.price || 0) * 0.7;
                    const cost = change * purchase_price;
                    if ((db.company.cash_available || 0) < cost) {
                        console.log(JSON.stringify({ 
                            success: false, 
                            error: `Insufficient company cash available to purchase stock (Required: ${cost}, Available: ${db.company.cash_available || 0})` 
                        }));
                        return;
                    }
                    db.company.cash_available = (db.company.cash_available || 0) - cost;
                    logAction(db, "FINANCE_TRANSACTION", `Deducted ₹${cost} for restocking ${item.name} (+${change} units)`);
                }

                item.quantity = newQty;
                const sign = change >= 0 ? "+" : "";
                logAction(db, "UPDATE_QUANTITY", `Adjusted quantity of ${item.name} (SKU: ${item.sku}) by ${sign}${change}. New quantity: ${newQty}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Quantity updated successfully", data: item }));
                break;
            }

            case 'set-quantity': {
                const itemId = Number(args[1]);
                const targetQty = Number(args[2]);

                if (isNaN(itemId) || isNaN(targetQty) || targetQty < 0) {
                    console.log(JSON.stringify({ success: false, error: "Invalid item ID or negative target quantity" }));
                    return;
                }

                const item = db.inventory.find(i => Number(i.id) === itemId);
                if (!item) {
                    console.log(JSON.stringify({ success: false, error: "Inventory item not found" }));
                    return;
                }

                const originalQty = Number(item.quantity);

                // Auto cash adjustment for restock (purchase)
                if (targetQty > originalQty) {
                    const diff = targetQty - originalQty;
                    const purchase_price = item.purchase_price !== undefined ? item.purchase_price : (item.price || 0) * 0.7;
                    const cost = diff * purchase_price;
                    if ((db.company.cash_available || 0) < cost) {
                        console.log(JSON.stringify({ 
                            success: false, 
                            error: `Insufficient company cash available to purchase stock (Required: ${cost}, Available: ${db.company.cash_available || 0})` 
                        }));
                        return;
                    }
                    db.company.cash_available = (db.company.cash_available || 0) - cost;
                    logAction(db, "FINANCE_TRANSACTION", `Deducted ₹${cost} for restocking ${item.name} (set qty from ${originalQty} to ${targetQty})`);
                }

                item.quantity = targetQty;
                logAction(db, "SET_QUANTITY", `Set quantity of ${item.name} (SKU: ${item.sku}) from ${originalQty} to ${targetQty}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Quantity set successfully", data: item }));
                break;
            }

            case 'edit-item': {
                const itemId = Number(args[1]);
                const [_, __, name, category, sku, thresholdStr, location, priceStr, purchasePriceStr, sellingPriceStr, supplier_name, supplier_contact, barcode] = args;

                if (isNaN(itemId) || !name || !category || !sku || !thresholdStr || !location) {
                    console.log(JSON.stringify({ success: false, error: "Missing edit attributes" }));
                    return;
                }

                const threshold = parseInt(thresholdStr, 10);
                if (isNaN(threshold) || threshold < 0) {
                    console.log(JSON.stringify({ success: false, error: "Threshold must be a positive integer" }));
                    return;
                }

                const item = db.inventory.find(i => Number(i.id) === itemId);
                if (!item) {
                    console.log(JSON.stringify({ success: false, error: "Inventory item not found" }));
                    return;
                }

                // SKU uniqueness check (excluding current item itself)
                if (db.inventory.some(i => Number(i.id) !== itemId && i.sku.toLowerCase() === sku.toLowerCase())) {
                    console.log(JSON.stringify({ success: false, error: "SKU already exists on another item" }));
                    return;
                }

                const oldName = item.name;
                item.name = name;
                item.category = category;
                item.sku = sku;
                item.threshold = threshold;
                item.location = location;
                item.price = priceStr ? parseFloat(priceStr) : item.price;
                item.purchase_price = purchasePriceStr ? parseFloat(purchasePriceStr) : (item.purchase_price !== undefined ? item.purchase_price : item.price * 0.7);
                item.selling_price = sellingPriceStr ? parseFloat(sellingPriceStr) : (item.selling_price !== undefined ? item.selling_price : item.price);
                item.supplier_name = supplier_name !== undefined ? supplier_name : item.supplier_name;
                item.supplier_contact = supplier_contact !== undefined ? supplier_contact : item.supplier_contact;
                item.barcode = barcode !== undefined ? barcode : item.barcode;

                logAction(db, "EDIT_ITEM", `Edited inventory item: ${oldName} (New Name: ${name}, SKU: ${sku})`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Inventory item edited successfully", data: item }));
                break;
            }

            case 'assign-item': {
                const empId = Number(args[1]);
                const itemId = Number(args[2]);
                const notes = args[3] || "";

                if (isNaN(empId) || isNaN(itemId)) {
                    console.log(JSON.stringify({ success: false, error: "Invalid employee ID or inventory ID" }));
                    return;
                }

                const employee = db.employees.find(e => Number(e.id) === empId);
                const item = db.inventory.find(i => Number(i.id) === itemId);

                if (!employee) {
                    console.log(JSON.stringify({ success: false, error: "Employee not found" }));
                    return;
                }
                if (!item) {
                    console.log(JSON.stringify({ success: false, error: "Inventory item not found" }));
                    return;
                }

                if (Number(item.quantity) <= 0) {
                    console.log(JSON.stringify({ success: false, error: "Item is out of stock" }));
                    return;
                }

                // Decrement inventory stock
                item.quantity = Number(item.quantity) - 1;

                const nextId = db.assignments.length > 0 ? Math.max(...db.assignments.map(a => a.id)) + 1 : 1;
                const newAssignment = {
                    id: nextId,
                    employee_id: empId,
                    inventory_id: itemId,
                    assigned_date: new Date().toISOString().split('T')[0],
                    notes
                };

                db.assignments.push(newAssignment);
                logAction(db, "ASSIGN_ITEM", `Assigned ${item.name} to ${employee.name}. Remaining quantity: ${item.quantity}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Item assigned successfully", data: newAssignment }));
                break;
            }

            case 'return-item': {
                const assignmentId = Number(args[1]);
                if (isNaN(assignmentId)) {
                    console.log(JSON.stringify({ success: false, error: "Invalid assignment ID" }));
                    return;
                }

                const assignIndex = db.assignments.findIndex(a => Number(a.id) === assignmentId);
                if (assignIndex === -1) {
                    console.log(JSON.stringify({ success: false, error: "Active assignment not found" }));
                    return;
                }

                const assignment = db.assignments[assignIndex];
                const item = db.inventory.find(i => Number(i.id) === Number(assignment.inventory_id));
                const employee = db.employees.find(e => Number(e.id) === Number(assignment.employee_id));

                if (item) {
                    // Re-increment inventory stock
                    item.quantity = Number(item.quantity) + 1;
                }

                db.assignments.splice(assignIndex, 1);
                logAction(db, "RETURN_ITEM", `Returned ${item ? item.name : 'item'} from ${employee ? employee.name : 'employee'}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Item returned successfully" }));
                break;
            }

            case 'list-logs': {
                // Sort logs in reverse chronological order
                const sortedLogs = [...db.logs].sort((a, b) => b.id - a.id);
                console.log(JSON.stringify({ success: true, data: sortedLogs }));
                break;
            }

            case 'load-demo': {
                db.employees = [
                    { id: 1, name: "Arvind Kumar", email: "arvind@company.com", role: "Senior SDE", department: "Engineering", joined_date: "2025-01-10", salary: 120000.0, contact_number: "9876543210", status: "Active" },
                    { id: 2, name: "Sneha Patel", email: "sneha@company.com", role: "UX Designer", department: "Product", joined_date: "2025-03-15", salary: 85000.0, contact_number: "9876543211", status: "Active" },
                    { id: 3, name: "Rohan Sharma", email: "rohan@company.com", role: "QA Lead", department: "Engineering", joined_date: "2025-06-01", salary: 95000.0, contact_number: "9876543212", status: "Active" },
                    { id: 4, name: "Priya Nair", email: "priya@company.com", role: "HR Manager", department: "Operations", joined_date: "2025-09-20", salary: 75000.0, contact_number: "9876543213", status: "Active" }
                ];
                db.inventory = [
                    { id: 1, name: "MacBook Pro M3", category: "Laptops", sku: "LAP-MBP-M3-01", quantity: 7, threshold: 2, location: "Cabinet A", price: 199999.0, purchase_price: 139999.0, selling_price: 199999.0, supplier_name: "Apple India", supplier_contact: "1800-165-2273", barcode: "1901901901" },
                    { id: 2, name: "Dell UltraSharp 27\"", category: "Monitors", sku: "MON-DEL-27-05", quantity: 4, threshold: 1, location: "Storage Room 2", price: 34999.0, purchase_price: 24499.0, selling_price: 34999.0, supplier_name: "Dell Service", supplier_contact: "1800-425-4026", barcode: "2902902902" },
                    { id: 3, name: "Keychron K2 Keyboard", category: "Accessories", sku: "ACC-KEY-K2-12", quantity: 0, threshold: 3, location: "Cabinet B", price: 8499.0, purchase_price: 5949.0, selling_price: 8499.0, supplier_name: "Keychron IN", supplier_contact: "contact@keychron.in", barcode: "3903903903" },
                    { id: 4, name: "iPhone 15 Pro", category: "Mobile", sku: "MOB-IPH-15-02", quantity: 3, threshold: 1, location: "Safe Vault", price: 134900.0, purchase_price: 94430.0, selling_price: 134900.0, supplier_name: "Apple India", supplier_contact: "1800-165-2273", barcode: "4904904904" }
                ];
                db.assignments = [
                    { id: 1, employee_id: 1, inventory_id: 1, assigned_date: "2025-01-12", notes: "Serial: C02DF123XYZ" },
                    { id: 2, employee_id: 2, inventory_id: 2, assigned_date: "2025-03-18", notes: "Asset ID: MON-987" }
                ];
                db.company = {
                    name: "StockFlow Solutions Ltd.",
                    owner: "Radhika Sen",
                    cash_available: 5000000.0,
                    debts: 1200000.0,
                    other_assets_value: 800000.0,
                    partners: [
                        { name: "Radhika Sen", shares: 60.0 },
                        { name: "Amit Sharma", shares: 25.0 },
                        { name: "Vikas Verma", shares: 15.0 }
                    ]
                };
                db.logs = [];

                logAction(db, "LOAD_DEMO", "Initialized database with professional mock demo dataset");
                logAction(db, "ASSIGN_ITEM", "Assigned MacBook Pro M3 to Arvind Kumar");
                logAction(db, "ASSIGN_ITEM", "Assigned Dell UltraSharp 27\" to Sneha Patel");

                saveDb(db);
                console.log(JSON.stringify({ success: true, message: "Demo data loaded successfully" }));
                break;
            }

            case 'edit-employee': {
                const empId = Number(args[1]);
                const [_, __, name, email, role, department, salaryStr, contact_number, status] = args;

                if (isNaN(empId) || !name || !email || !role || !department) {
                    console.log(JSON.stringify({ success: false, error: "Missing edit employee attributes" }));
                    return;
                }

                const emp = db.employees.find(e => Number(e.id) === empId);
                if (!emp) {
                    console.log(JSON.stringify({ success: false, error: "Employee not found" }));
                    return;
                }

                // email uniqueness check (excluding current employee)
                if (db.employees.some(e => Number(e.id) !== empId && e.email.toLowerCase() === email.toLowerCase())) {
                    console.log(JSON.stringify({ success: false, error: "Employee email already exists on another employee" }));
                    return;
                }

                const oldName = emp.name;
                emp.name = name;
                emp.email = email;
                emp.role = role;
                emp.department = department;
                emp.salary = salaryStr ? parseFloat(salaryStr) : emp.salary;
                emp.contact_number = contact_number !== undefined ? contact_number : emp.contact_number;
                emp.status = status !== undefined ? status : emp.status;

                logAction(db, "EDIT_EMPLOYEE", `Edited employee: ${oldName} (New Name: ${name}, Role: ${role})`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Employee updated successfully", data: emp }));
                break;
            }

            case 'list-assignments': {
                const result = db.assignments.map(a => {
                    const emp = db.employees.find(e => Number(e.id) === Number(a.employee_id));
                    const item = db.inventory.find(i => Number(i.id) === Number(a.inventory_id));
                    return {
                        assignment_id: a.id,
                        employee_id: a.employee_id,
                        employee_name: emp ? emp.name : 'Unknown Employee',
                        inventory_id: a.inventory_id,
                        item_name: item ? item.name : 'Unknown Item',
                        sku: item ? item.sku : '',
                        assigned_date: a.assigned_date,
                        notes: a.notes
                    };
                });
                console.log(JSON.stringify({ success: true, data: result }));
                break;
            }

            case 'record-sale': {
                const empId = Number(args[1]);
                const itemId = Number(args[2]);
                const qty = Number(args[3]);

                if (isNaN(empId) || isNaN(itemId) || isNaN(qty) || qty <= 0) {
                    console.log(JSON.stringify({ success: false, error: "Invalid parameters for sale" }));
                    return;
                }

                const employee = db.employees.find(e => Number(e.id) === empId);
                const item = db.inventory.find(i => Number(i.id) === itemId);

                if (!employee) {
                    console.log(JSON.stringify({ success: false, error: "Employee not found" }));
                    return;
                }
                if (!item) {
                    console.log(JSON.stringify({ success: false, error: "Inventory item not found" }));
                    return;
                }

                if (Number(item.quantity) < qty) {
                    console.log(JSON.stringify({ success: false, error: "Not enough stock available" }));
                    return;
                }

                // Decrement stock
                item.quantity = Number(item.quantity) - qty;

                // Auto cash adjustment for sale (revenue)
                const selling_price = item.selling_price !== undefined ? item.selling_price : (item.price || 0);
                const revenue = qty * selling_price;
                db.company.cash_available = (db.company.cash_available || 0) + revenue;

                // Add logs
                const saleDetails = `${empId}|${employee.name}|${itemId}|${item.name}|${item.sku}|${qty}`;
                logAction(db, "SALE", saleDetails);
                logAction(db, "FINANCE_TRANSACTION", `Received ₹${revenue} revenue from sale of ${item.name} (x${qty})`);

                saveDb(db);

                console.log(JSON.stringify({
                    success: true,
                    message: "Sale recorded successfully",
                    data: {
                        employee_id: empId,
                        inventory_id: itemId,
                        quantity: qty
                    }
                }));
                break;
            }

            case 'reset-db': {
                db.employees = [];
                db.inventory = [];
                db.assignments = [];
                db.logs = [];
                db.company = {
                    name: "StockFlow Solutions Ltd.",
                    owner: "Radhika Sen",
                    cash_available: 0,
                    debts: 0,
                    other_assets_value: 0,
                    partners: []
                };

                logAction(db, "RESET_DATABASE", "Cleared all databases and logs");
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Database reset successfully" }));
                break;
            }

            case 'get-company-data': {
                console.log(JSON.stringify({
                    success: true,
                    company: db.company
                }));
                break;
            }

            case 'update-company-profile': {
                const [_, name, owner, otherAssetsStr] = args;
                if (!name || !owner || !otherAssetsStr) {
                    console.log(JSON.stringify({ success: false, error: "Missing company profile attributes" }));
                    return;
                }

                db.company.name = name;
                db.company.owner = owner;
                db.company.other_assets_value = parseFloat(otherAssetsStr) || 0;

                logAction(db, "EDIT_COMPANY", `Updated company profile: ${name} (Owner: ${owner})`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Company profile updated successfully" }));
                break;
            }

            case 'adjust-finances': {
                const [_, cashChangeStr, debtChangeStr, details] = args;
                if (!cashChangeStr || !debtChangeStr || !details) {
                    console.log(JSON.stringify({ success: false, error: "Missing finance arguments" }));
                    return;
                }

                const cashChange = parseFloat(cashChangeStr) || 0;
                const debtChange = parseFloat(debtChangeStr) || 0;

                db.company.cash_available = (db.company.cash_available || 0) + cashChange;
                db.company.debts = (db.company.debts || 0) + debtChange;

                logAction(db, "FINANCE_TRANSACTION", details);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Finances adjusted successfully" }));
                break;
            }

            case 'add-partner': {
                const [_, name, sharesStr] = args;
                if (!name || !sharesStr) {
                    console.log(JSON.stringify({ success: false, error: "Missing partner attributes" }));
                    return;
                }

                const shares = parseFloat(sharesStr) || 0;

                // Validate total shares
                const totalShares = (db.company.partners || []).reduce((sum, p) => sum + p.shares, 0);
                if (totalShares + shares > 100.01) {
                    console.log(JSON.stringify({ success: false, error: "Total shares cannot exceed 100%" }));
                    return;
                }

                if (!db.company.partners) db.company.partners = [];
                db.company.partners.push({ name, shares });

                logAction(db, "ADD_PARTNER", `Added share partner: ${name} with ${shares}% shares`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Partner added successfully" }));
                break;
            }

            case 'edit-partner': {
                const [_, indexStr, name, sharesStr] = args;
                if (!indexStr || !name || !sharesStr) {
                    console.log(JSON.stringify({ success: false, error: "Missing edit partner attributes" }));
                    return;
                }

                const index = parseInt(indexStr, 10);
                const shares = parseFloat(sharesStr) || 0;

                if (!db.company.partners || index < 0 || index >= db.company.partners.length) {
                    console.log(JSON.stringify({ success: false, error: "Invalid partner index" }));
                    return;
                }

                // Validate total shares excluding current partner
                const totalShares = db.company.partners.reduce((sum, p, idx) => idx === index ? sum : sum + p.shares, 0);
                if (totalShares + shares > 100.01) {
                    console.log(JSON.stringify({ success: false, error: "Total shares cannot exceed 100%" }));
                    return;
                }

                const oldName = db.company.partners[index].name;
                db.company.partners[index].name = name;
                db.company.partners[index].shares = shares;

                logAction(db, "EDIT_PARTNER", `Updated partner: ${oldName} -> ${name} (${shares}%)`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Partner updated successfully" }));
                break;
            }

            case 'delete-partner': {
                const [_, indexStr] = args;
                if (!indexStr) {
                    console.log(JSON.stringify({ success: false, error: "Missing partner index" }));
                    return;
                }

                const index = parseInt(indexStr, 10);
                if (!db.company.partners || index < 0 || index >= db.company.partners.length) {
                    console.log(JSON.stringify({ success: false, error: "Invalid partner index" }));
                    return;
                }

                const name = db.company.partners[index].name;
                db.company.partners.splice(index, 1);

                logAction(db, "DELETE_PARTNER", `Removed share partner: ${name}`);
                saveDb(db);

                console.log(JSON.stringify({ success: true, message: "Partner removed successfully" }));
                break;
            }

            case 'pay-salary': {
                const empId = Number(args[1]);
                const months = Number(args[2]) || 1;

                if (isNaN(empId) || months <= 0) {
                    console.log(JSON.stringify({ success: false, error: "Invalid parameters for pay-salary" }));
                    return;
                }

                const emp = db.employees.find(e => Number(e.id) === empId);
                if (!emp) {
                    console.log(JSON.stringify({ success: false, error: "Employee not found" }));
                    return;
                }

                const amount = (emp.salary || 0) * months;
                const cashAvailable = db.company.cash_available || 0;
                if (cashAvailable < amount) {
                    console.log(JSON.stringify({ 
                        success: false, 
                        error: `Insufficient company cash available to pay salary (Required: ${amount}, Available: ${cashAvailable})` 
                    }));
                    return;
                }

                db.company.cash_available = cashAvailable - amount;
                logAction(db, "FINANCE_TRANSACTION", `Paid salary of ₹${amount} to ${emp.name} for ${months} month(s)`);
                saveDb(db);

                console.log(JSON.stringify({
                    success: true,
                    message: "Salary paid successfully",
                    data: {
                        employee_id: empId,
                        amount_paid: amount,
                        months: months
                    }
                }));
                break;
            }

            case 'run-payroll': {
                const months = Number(args[1]) || 1;

                if (months <= 0) {
                    console.log(JSON.stringify({ success: false, error: "Invalid months value for payroll" }));
                    return;
                }

                let totalPayroll = 0;
                let activeCount = 0;
                db.employees.forEach(emp => {
                    if (emp.status === "Active") {
                        totalPayroll += (emp.salary || 0) * months;
                        activeCount++;
                    }
                });

                if (activeCount === 0) {
                    console.log(JSON.stringify({ success: true, message: "No active employees found to process payroll", data: { amount_paid: 0, active_count: 0 } }));
                    return;
                }

                const cashAvailable = db.company.cash_available || 0;
                if (cashAvailable < totalPayroll) {
                    console.log(JSON.stringify({ 
                        success: false, 
                        error: `Insufficient company cash available to process payroll (Required: ${totalPayroll}, Available: ${cashAvailable})` 
                    }));
                    return;
                }

                db.company.cash_available = cashAvailable - totalPayroll;
                logAction(db, "FINANCE_TRANSACTION", `Processed payroll of ₹${totalPayroll} for ${activeCount} active employee(s) for ${months} month(s)`);
                saveDb(db);

                console.log(JSON.stringify({
                    success: true,
                    message: "Payroll processed successfully",
                    data: {
                        amount_paid: totalPayroll,
                        active_count: activeCount,
                        months: months
                    }
                }));
                break;
            }

            default:
                console.log(JSON.stringify({ success: false, error: "Unknown command: " + cmd }));
        }
    } catch (e) {
        console.log(JSON.stringify({ success: false, error: "Internal fallback error", details: e.message }));
    }
}

main();
