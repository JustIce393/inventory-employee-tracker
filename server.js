const express = require('express');
const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Connect to SQLite database
const dbPath = path.join(__dirname, 'flow.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('[Flow] Error connecting to SQLite database:', err.message);
    } else {
        console.log('[Flow] Connected to SQLite database at:', dbPath);
    }
});

// Helper functions to wrap sqlite3 methods in Promises
function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve(this); // 'this' contains lastID and changes
        });
    });
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Custom async dynamic list wrapper
function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Database schema initialization
async function initDatabase() {
    try {
        await dbRun(`CREATE TABLE IF NOT EXISTS company (
            name TEXT,
            owner TEXT,
            cash_available REAL,
            debts REAL,
            other_assets_value REAL
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS partners (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            shares REAL
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS employees (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            email TEXT UNIQUE,
            role TEXT,
            department TEXT,
            joined_date TEXT,
            salary REAL,
            contact_number TEXT,
            status TEXT DEFAULT 'Active'
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            category TEXT,
            sku TEXT UNIQUE,
            quantity INTEGER,
            threshold INTEGER,
            location TEXT,
            price REAL,
            purchase_price REAL,
            selling_price REAL,
            supplier_name TEXT,
            supplier_contact TEXT,
            barcode TEXT
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS assignments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            employee_id INTEGER,
            inventory_id INTEGER,
            assigned_date TEXT,
            notes TEXT,
            FOREIGN KEY(employee_id) REFERENCES employees(id),
            FOREIGN KEY(inventory_id) REFERENCES inventory(id)
        )`);

        await dbRun(`CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            action TEXT,
            details TEXT,
            timestamp TEXT
        )`);

        // Check if company table has data; if not, initialize with default records
        const comp = await dbGet(`SELECT * FROM company LIMIT 1`);
        if (!comp) {
            await dbRun(`INSERT INTO company (name, owner, cash_available, debts, other_assets_value)
                VALUES (?, ?, ?, ?, ?)`, [
                    "StockFlow Solutions Ltd.",
                    "Radhika Sen",
                    5000000.0,
                    1200000.0,
                    800000.0
                ]);
            
            await dbRun(`INSERT INTO partners (name, shares) VALUES (?, ?)`, ["Radhika Sen", 60.0]);
            await dbRun(`INSERT INTO partners (name, shares) VALUES (?, ?)`, ["Amit Sharma", 25.0]);
            await dbRun(`INSERT INTO partners (name, shares) VALUES (?, ?)`, ["Vikas Verma", 15.0]);
            console.log('[Flow] Database initialized with default company and partner records.');
        }
    } catch (err) {
        console.error('[Flow] Error initializing database tables:', err.message);
    }
}

// Log action to the audit logs table
async function logAction(action, details) {
    const timestamp = new Date().toISOString();
    await dbRun(`INSERT INTO logs (action, details, timestamp) VALUES (?, ?, ?)`, [action, details, timestamp]);
}

// REST API Endpoints

// 0. Status Endpoint
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        engine: "SQLite Database Engine"
    });
});

// 1. Dashboard Statistics
app.get('/api/dashboard', async (req, res) => {
    try {
        const employeesCount = await dbGet(`SELECT COUNT(*) as count FROM employees`);
        const inventorySum = await dbGet(`SELECT SUM(quantity) as sum FROM inventory`);
        const assignmentsCount = await dbGet(`SELECT COUNT(*) as count FROM assignments`);
        const lowStockCount = await dbGet(`SELECT COUNT(*) as count FROM inventory WHERE quantity <= threshold`);
        const valueSum = await dbGet(`SELECT SUM(quantity * purchase_price) as sum FROM inventory`);

        res.json({
            success: true,
            stats: {
                totalEmployees: employeesCount.count || 0,
                totalInventoryItems: inventorySum.sum || 0,
                activeAssignments: assignmentsCount.count || 0,
                lowStockItems: lowStockCount.count || 0,
                totalInventoryValue: valueSum.sum || 0
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 2. Employees Endpoints
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await dbAll('SELECT * FROM employees');
        const result = [];
        for (const emp of employees) {
            const assignedGear = await dbAll(`
                SELECT a.id as assignment_id, a.inventory_id as item_id, i.name as item_name, i.sku, a.assigned_date, a.notes
                FROM assignments a
                LEFT JOIN inventory i ON a.inventory_id = i.id
                WHERE a.employee_id = ?
            `, [emp.id]);
            result.push({ ...emp, assignedGear });
        }
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/employees', async (req, res) => {
    const { name, email, role, department, salary, contact_number, status } = req.body;
    if (!name || !email || !role || !department) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const existing = await dbGet(`SELECT id FROM employees WHERE LOWER(email) = LOWER(?)`, [email]);
        if (existing) {
            return res.status(400).json({ success: false, error: "Employee email already exists" });
        }
        
        const result = await dbRun(`
            INSERT INTO employees (name, email, role, department, salary, contact_number, status, joined_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name, 
            email, 
            role, 
            department, 
            salary !== undefined ? parseFloat(salary) : 0, 
            contact_number || '', 
            status || 'Active',
            new Date().toISOString().split('T')[0]
        ]);

        const newEmp = await dbGet(`SELECT * FROM employees WHERE id = ?`, [result.lastID]);
        await logAction("ADD_EMPLOYEE", `Added employee: ${name} (${role})`);
        res.json({ success: true, message: "Employee added successfully", data: newEmp });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const activeCount = await dbGet(`SELECT COUNT(*) as count FROM assignments WHERE employee_id = ?`, [id]);
        if (activeCount.count > 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Cannot delete employee. They currently have active inventory items assigned." 
            });
        }
        const emp = await dbGet(`SELECT name FROM employees WHERE id = ?`, [id]);
        if (!emp) {
            return res.status(404).json({ success: false, error: "Employee not found" });
        }
        await dbRun(`DELETE FROM employees WHERE id = ?`, [id]);
        await logAction("DELETE_EMPLOYEE", `Deleted employee: ${emp.name}`);
        res.json({ success: true, message: "Employee deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, role, department, salary, contact_number, status } = req.body;
    if (!name || !email || !role || !department) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const emp = await dbGet(`SELECT name FROM employees WHERE id = ?`, [id]);
        if (!emp) {
            return res.status(404).json({ success: false, error: "Employee not found" });
        }
        const existing = await dbGet(`SELECT id FROM employees WHERE LOWER(email) = LOWER(?) AND id != ?`, [email, id]);
        if (existing) {
            return res.status(400).json({ success: false, error: "Employee email already exists on another employee" });
        }

        await dbRun(`
            UPDATE employees
            SET name = ?, email = ?, role = ?, department = ?, salary = ?, contact_number = ?, status = ?
            WHERE id = ?
        `, [
            name, 
            email, 
            role, 
            department, 
            salary !== undefined ? parseFloat(salary) : 0, 
            contact_number !== undefined ? contact_number : '', 
            status || 'Active',
            id
        ]);

        const updatedEmp = await dbGet(`SELECT * FROM employees WHERE id = ?`, [id]);
        await logAction("EDIT_EMPLOYEE", `Edited employee: ${emp.name} (New Name: ${name}, Role: ${role})`);
        res.json({ success: true, message: "Employee updated successfully", data: updatedEmp });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Inventory Endpoints
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = await dbAll('SELECT * FROM inventory');
        const result = [];
        for (const item of inventory) {
            const activeAssignments = await dbAll(`
                SELECT a.id as assignment_id, a.employee_id, e.name as employee_name, a.assigned_date, a.notes
                FROM assignments a
                LEFT JOIN employees e ON a.employee_id = e.id
                WHERE a.inventory_id = ?
            `, [item.id]);
            result.push({ ...item, activeAssignments });
        }
        res.json({ success: true, data: result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/inventory', async (req, res) => {
    const { name, category, sku, quantity, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode } = req.body;
    if (!name || !category || !sku || quantity === undefined || threshold === undefined || !location) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const existing = await dbGet(`SELECT id FROM inventory WHERE LOWER(sku) = LOWER(?)`, [sku]);
        if (existing) {
            return res.status(400).json({ success: false, error: "SKU already exists" });
        }

        const quantityInt = parseInt(quantity, 10);
        const thresholdInt = parseInt(threshold, 10);
        if (isNaN(quantityInt) || isNaN(thresholdInt) || quantityInt < 0 || thresholdInt < 0) {
            return res.status(400).json({ success: false, error: "Quantity and threshold must be positive integers" });
        }

        const itemPrice = price !== undefined ? parseFloat(price) : 0;
        const itemSellingPrice = selling_price !== undefined ? parseFloat(selling_price) : itemPrice;
        const itemPurchasePrice = purchase_price !== undefined ? parseFloat(purchase_price) : (itemSellingPrice * 0.7);

        const company = await dbGet(`SELECT cash_available FROM company LIMIT 1`);
        const cost = quantityInt * itemPurchasePrice;
        if (cost > 0) {
            if (company.cash_available < cost) {
                return res.status(400).json({ 
                    success: false, 
                    error: `Insufficient company cash available to purchase initial stock (Required: ${cost}, Available: ${company.cash_available})` 
                });
            }
            await dbRun(`UPDATE company SET cash_available = cash_available - ?`, [cost]);
            await logAction("FINANCE_TRANSACTION", `Deducted ₹${cost} for initial stock purchase of ${name} (${quantityInt} units)`);
        }

        const result = await dbRun(`
            INSERT INTO inventory (name, category, sku, quantity, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            name, 
            category, 
            sku, 
            quantityInt, 
            thresholdInt, 
            location,
            itemPrice,
            itemPurchasePrice,
            itemSellingPrice,
            supplier_name || '',
            supplier_contact || '',
            barcode || ''
        ]);

        const newItem = await dbGet(`SELECT * FROM inventory WHERE id = ?`, [result.lastID]);
        await logAction("ADD_ITEM", `Added inventory item: ${name} (SKU: ${sku}) with Qty: ${quantityInt}`);
        res.json({ success: true, message: "Inventory item added successfully", data: newItem });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const activeCount = await dbGet(`SELECT COUNT(*) as count FROM assignments WHERE inventory_id = ?`, [id]);
        if (activeCount.count > 0) {
            return res.status(400).json({ 
                success: false, 
                error: "Cannot delete item. It is currently assigned to one or more employees." 
            });
        }
        const item = await dbGet(`SELECT name FROM inventory WHERE id = ?`, [id]);
        if (!item) {
            return res.status(404).json({ success: false, error: "Inventory item not found" });
        }
        await dbRun(`DELETE FROM inventory WHERE id = ?`, [id]);
        await logAction("DELETE_ITEM", `Deleted inventory item: ${item.name}`);
        res.json({ success: true, message: "Inventory item deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, sku, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode } = req.body;
    if (!name || !category || !sku || threshold === undefined || !location) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const item = await dbGet(`SELECT name FROM inventory WHERE id = ?`, [id]);
        if (!item) {
            return res.status(404).json({ success: false, error: "Inventory item not found" });
        }
        const existing = await dbGet(`SELECT id FROM inventory WHERE LOWER(sku) = LOWER(?) AND id != ?`, [sku, id]);
        if (existing) {
            return res.status(400).json({ success: false, error: "SKU already exists on another item" });
        }

        const thresholdInt = parseInt(threshold, 10);
        if (isNaN(thresholdInt) || thresholdInt < 0) {
            return res.status(400).json({ success: false, error: "Threshold must be a positive integer" });
        }

        await dbRun(`
            UPDATE inventory
            SET name = ?, category = ?, sku = ?, threshold = ?, location = ?, price = ?, purchase_price = ?, selling_price = ?, supplier_name = ?, supplier_contact = ?, barcode = ?
            WHERE id = ?
        `, [
            name, 
            category, 
            sku, 
            thresholdInt, 
            location,
            price !== undefined ? parseFloat(price) : 0,
            purchase_price !== undefined ? parseFloat(purchase_price) : 0,
            selling_price !== undefined ? parseFloat(selling_price) : 0,
            supplier_name !== undefined ? supplier_name : '',
            supplier_contact !== undefined ? supplier_contact : '',
            barcode !== undefined ? barcode : '',
            id
        ]);

        const updatedItem = await dbGet(`SELECT * FROM inventory WHERE id = ?`, [id]);
        await logAction("EDIT_ITEM", `Edited inventory item: ${item.name} (New Name: ${name}, SKU: ${sku})`);
        res.json({ success: true, message: "Inventory item edited successfully", data: updatedItem });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/inventory/:id/quantity', async (req, res) => {
    const { id } = req.params;
    const { change, value } = req.body;
    
    try {
        const item = await dbGet(`SELECT * FROM inventory WHERE id = ?`, [id]);
        if (!item) {
            return res.status(404).json({ success: false, error: "Inventory item not found" });
        }

        let newQty;
        let diff = 0;
        if (value !== undefined) {
            newQty = parseInt(value, 10);
            diff = newQty - item.quantity;
        } else if (change !== undefined) {
            diff = parseInt(change, 10);
            newQty = item.quantity + diff;
        } else {
            return res.status(400).json({ success: false, error: "Missing quantity change or value" });
        }

        if (isNaN(newQty) || newQty < 0) {
            return res.status(400).json({ success: false, error: "Quantity cannot fall below 0" });
        }

        const company = await dbGet(`SELECT cash_available FROM company LIMIT 1`);
        if (diff > 0) {
            const cost = diff * item.purchase_price;
            if (company.cash_available < cost) {
                return res.status(400).json({
                    success: false,
                    error: `Insufficient company cash available to purchase stock (Required: ${cost}, Available: ${company.cash_available})`
                });
            }
            await dbRun(`UPDATE company SET cash_available = cash_available - ?`, [cost]);
            await logAction("FINANCE_TRANSACTION", `Deducted ₹${cost} for restocking ${item.name} (+${diff} units)`);
        }

        await dbRun(`UPDATE inventory SET quantity = ? WHERE id = ?`, [newQty, id]);
        const updatedItem = await dbGet(`SELECT * FROM inventory WHERE id = ?`, [id]);

        if (value !== undefined) {
            await logAction("SET_QUANTITY", `Set quantity of ${item.name} (SKU: ${item.sku}) from ${item.quantity} to ${newQty}`);
        } else {
            const sign = diff >= 0 ? "+" : "";
            await logAction("UPDATE_QUANTITY", `Adjusted quantity of ${item.name} (SKU: ${item.sku}) by ${sign}${diff}. New quantity: ${newQty}`);
        }

        res.json({ success: true, message: "Quantity updated successfully", data: updatedItem });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3.5 Sales / Consumption Endpoints
app.post('/api/sales', async (req, res) => {
    const { employee_id, inventory_id, quantity } = req.body;
    if (employee_id === undefined || inventory_id === undefined || quantity === undefined) {
        return res.status(400).json({ success: false, error: "Missing employee ID, inventory ID or quantity" });
    }
    try {
        const employee = await dbGet(`SELECT name FROM employees WHERE id = ?`, [employee_id]);
        const item = await dbGet(`SELECT * FROM inventory WHERE id = ?`, [inventory_id]);

        if (!employee) {
            return res.status(404).json({ success: false, error: "Employee not found" });
        }
        if (!item) {
            return res.status(404).json({ success: false, error: "Inventory item not found" });
        }

        const quantityInt = parseInt(quantity, 10);
        if (isNaN(quantityInt) || quantityInt <= 0) {
            return res.status(400).json({ success: false, error: "Quantity must be a positive integer" });
        }

        if (item.quantity < quantityInt) {
            return res.status(400).json({ success: false, error: "Not enough stock available" });
        }

        // Decrement stock
        await dbRun(`UPDATE inventory SET quantity = quantity - ? WHERE id = ?`, [quantityInt, inventory_id]);

        // Adjust company cash
        const revenue = quantityInt * item.selling_price;
        await dbRun(`UPDATE company SET cash_available = cash_available + ?`, [revenue]);

        // Add logs
        const saleDetails = `${employee_id}|${employee.name}|${inventory_id}|${item.name}|${item.sku}|${quantityInt}`;
        await logAction("SALE", saleDetails);
        await logAction("FINANCE_TRANSACTION", `Received ₹${revenue} revenue from sale of ${item.name} (x${quantityInt})`);

        res.json({
            success: true,
            message: "Sale recorded successfully",
            data: {
                employee_id,
                inventory_id,
                quantity: quantityInt
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 4. Assignments (Check-out / Check-in)
app.post('/api/inventory/assign', async (req, res) => {
    const { employee_id, inventory_id, notes } = req.body;
    if (employee_id === undefined || inventory_id === undefined) {
        return res.status(400).json({ success: false, error: "Missing employee ID or inventory ID" });
    }
    try {
        const employee = await dbGet(`SELECT name FROM employees WHERE id = ?`, [employee_id]);
        const item = await dbGet(`SELECT * FROM inventory WHERE id = ?`, [inventory_id]);

        if (!employee) {
            return res.status(404).json({ success: false, error: "Employee not found" });
        }
        if (!item) {
            return res.status(404).json({ success: false, error: "Inventory item not found" });
        }
        if (item.quantity <= 0) {
            return res.status(400).json({ success: false, error: "Item is out of stock" });
        }

        // Decrement stock
        await dbRun(`UPDATE inventory SET quantity = quantity - 1 WHERE id = ?`, [inventory_id]);

        // Add assignment
        const result = await dbRun(`
            INSERT INTO assignments (employee_id, inventory_id, assigned_date, notes)
            VALUES (?, ?, ?, ?)
        `, [
            employee_id, 
            inventory_id, 
            new Date().toISOString().split('T')[0], 
            notes || ''
        ]);

        const newAssignment = await dbGet(`SELECT * FROM assignments WHERE id = ?`, [result.lastID]);
        await logAction("ASSIGN_ITEM", `Assigned ${item.name} to ${employee.name}. Remaining quantity: ${item.quantity - 1}`);

        res.json({ success: true, message: "Item assigned successfully", data: newAssignment });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/inventory/return', async (req, res) => {
    const { assignment_id } = req.body;
    if (assignment_id === undefined) {
        return res.status(400).json({ success: false, error: "Missing assignment ID" });
    }
    try {
        const assignment = await dbGet(`SELECT * FROM assignments WHERE id = ?`, [assignment_id]);
        if (!assignment) {
            return res.status(404).json({ success: false, error: "Active assignment not found" });
        }

        const employee = await dbGet(`SELECT name FROM employees WHERE id = ?`, [assignment.employee_id]);
        const item = await dbGet(`SELECT name FROM inventory WHERE id = ?`, [assignment.inventory_id]);

        // Re-increment stock
        if (item) {
            await dbRun(`UPDATE inventory SET quantity = quantity + 1 WHERE id = ?`, [assignment.inventory_id]);
        }

        // Delete assignment
        await dbRun(`DELETE FROM assignments WHERE id = ?`, [assignment_id]);

        await logAction("RETURN_ITEM", `Returned ${item ? item.name : 'item'} from ${employee ? employee.name : 'employee'}`);
        res.json({ success: true, message: "Item returned successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/assignments', async (req, res) => {
    try {
        const assignments = await dbAll(`
            SELECT a.id as assignment_id, a.employee_id, e.name as employee_name, a.inventory_id, i.name as item_name, i.sku, a.assigned_date, a.notes
            FROM assignments a
            LEFT JOIN employees e ON a.employee_id = e.id
            LEFT JOIN inventory i ON a.inventory_id = i.id
        `);
        res.json({ success: true, data: assignments });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 5. Audit Logs
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await dbAll(`SELECT * FROM logs ORDER BY id DESC`);
        res.json({ success: true, data: logs });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/demo', async (req, res) => {
    try {
        // Clear tables
        await dbRun(`DELETE FROM employees`);
        await dbRun(`DELETE FROM inventory`);
        await dbRun(`DELETE FROM assignments`);
        await dbRun(`DELETE FROM logs`);
        await dbRun(`DELETE FROM company`);
        await dbRun(`DELETE FROM partners`);

        // Insert company
        await dbRun(`INSERT INTO company (name, owner, cash_available, debts, other_assets_value)
            VALUES (?, ?, ?, ?, ?)`, ["StockFlow Solutions Ltd.", "Radhika Sen", 5000000.0, 1200000.0, 800000.0]);

        // Insert partners
        const partnersDemo = [
            ["Radhika Sen", 60.0],
            ["Amit Sharma", 25.0],
            ["Vikas Verma", 15.0]
        ];
        for (const p of partnersDemo) {
            await dbRun(`INSERT INTO partners (name, shares) VALUES (?, ?)`, p);
        }

        // Insert employees
        const employeesDemo = [
            [1, "Arvind Kumar", "arvind@company.com", "Senior SDE", "Engineering", "2025-01-10", 120000.0, "9876543210", "Active"],
            [2, "Sneha Patel", "sneha@company.com", "UX Designer", "Product", "2025-03-15", 85000.0, "9876543211", "Active"],
            [3, "Rohan Sharma", "rohan@company.com", "QA Lead", "Engineering", "2025-06-01", 95000.0, "9876543212", "Active"],
            [4, "Priya Nair", "priya@company.com", "HR Manager", "Operations", "2025-09-20", 75000.0, "9876543213", "Active"]
        ];
        for (const e of employeesDemo) {
            await dbRun(`INSERT INTO employees (id, name, email, role, department, joined_date, salary, contact_number, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, e);
        }

        // Insert inventory
        const inventoryDemo = [
            [1, "MacBook Pro M3", "Laptops", "LAP-MBP-M3-01", 7, 2, "Cabinet A", 199999.0, 139999.0, 199999.0, "Apple India", "1800-165-2273", "1901901901"],
            [2, "Dell UltraSharp 27\"", "Monitors", "MON-DEL-27-05", 4, 1, "Storage Room 2", 34999.0, 24499.0, 34999.0, "Dell Service", "1800-425-4026", "2902902902"],
            [3, "Keychron K2 Keyboard", "Accessories", "ACC-KEY-K2-12", 0, 3, "Cabinet B", 8499.0, 5949.0, 8499.0, "Keychron IN", "contact@keychron.in", "3903903903"],
            [4, "iPhone 15 Pro", "Mobile", "MOB-IPH-15-02", 3, 1, "Safe Vault", 134900.0, 94430.0, 134900.0, "Apple India", "1800-165-2273", "4904904904"]
        ];
        for (const i of inventoryDemo) {
            await dbRun(`INSERT INTO inventory (id, name, category, sku, quantity, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, i);
        }

        // Insert assignments
        const assignmentsDemo = [
            [1, 1, 1, "2025-01-12", "Serial: C02DF123XYZ"],
            [2, 2, 2, "2025-03-18", "Asset ID: MON-987"]
        ];
        for (const a of assignmentsDemo) {
            await dbRun(`INSERT INTO assignments (id, employee_id, inventory_id, assigned_date, notes) VALUES (?, ?, ?, ?, ?)`, a);
        }

        await logAction("LOAD_DEMO", "Initialized database with professional mock demo dataset");
        await logAction("ASSIGN_ITEM", "Assigned MacBook Pro M3 to Arvind Kumar");
        await logAction("ASSIGN_ITEM", "Assigned Dell UltraSharp 27\" to Sneha Patel");

        res.json({ success: true, message: "Demo data loaded successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/reset', async (req, res) => {
    try {
        await dbRun(`DELETE FROM employees`);
        await dbRun(`DELETE FROM inventory`);
        await dbRun(`DELETE FROM assignments`);
        await dbRun(`DELETE FROM logs`);
        await dbRun(`DELETE FROM company`);
        await dbRun(`DELETE FROM partners`);

        await dbRun(`INSERT INTO company (name, owner, cash_available, debts, other_assets_value)
            VALUES (?, ?, ?, ?, ?)`, ["StockFlow Solutions Ltd.", "Radhika Sen", 0, 0, 0]);

        await logAction("RESET_DATABASE", "Cleared all databases and logs");
        res.json({ success: true, message: "Database reset successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 6. Company Hub Endpoints
app.get('/api/company', async (req, res) => {
    try {
        const company = await dbGet(`SELECT * FROM company LIMIT 1`);
        const partners = await dbAll(`SELECT * FROM partners`);
        res.json({
            success: true,
            company: {
                ...company,
                partners
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/company', async (req, res) => {
    const { name, owner, other_assets_value } = req.body;
    if (!name || !owner || other_assets_value === undefined) {
        return res.status(400).json({ success: false, error: "Missing company profile attributes" });
    }
    try {
        await dbRun(`
            UPDATE company
            SET name = ?, owner = ?, other_assets_value = ?
        `, [name, owner, parseFloat(other_assets_value) || 0]);

        await logAction("EDIT_COMPANY", `Updated company profile: ${name} (Owner: ${owner})`);
        res.json({ success: true, message: "Company profile updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/company/finances', async (req, res) => {
    const { cash_change, debt_change, details } = req.body;
    if (cash_change === undefined || debt_change === undefined || !details) {
        return res.status(400).json({ success: false, error: "Missing finance adjustment attributes" });
    }
    try {
        await dbRun(`
            UPDATE company
            SET cash_available = cash_available + ?, debts = debts + ?
        `, [parseFloat(cash_change) || 0, parseFloat(debt_change) || 0]);

        await logAction("FINANCE_TRANSACTION", details);
        res.json({ success: true, message: "Finances adjusted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/company/partners', async (req, res) => {
    const { name, shares } = req.body;
    if (!name || shares === undefined) {
        return res.status(400).json({ success: false, error: "Missing partner attributes" });
    }
    try {
        const sharesNum = parseFloat(shares) || 0;
        const totalShares = await dbGet(`SELECT SUM(shares) as sum FROM partners`);
        const currentSum = totalShares.sum || 0;
        if (currentSum + sharesNum > 100.01) {
            return res.status(400).json({ success: false, error: "Total shares cannot exceed 100%" });
        }

        await dbRun(`INSERT INTO partners (name, shares) VALUES (?, ?)`, [name, sharesNum]);
        await logAction("ADD_PARTNER", `Added share partner: ${name} with ${sharesNum}% shares`);
        res.json({ success: true, message: "Partner added successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.put('/api/company/partners/:index', async (req, res) => {
    const { index } = req.params;
    const { name, shares } = req.body;
    if (!name || shares === undefined) {
        return res.status(400).json({ success: false, error: "Missing partner attributes" });
    }
    try {
        const indexNum = parseInt(index, 10);
        const sharesNum = parseFloat(shares) || 0;
        const partners = await dbAll(`SELECT * FROM partners`);
        if (isNaN(indexNum) || indexNum < 0 || indexNum >= partners.length) {
            return res.status(400).json({ success: false, error: "Invalid partner index" });
        }
        const targetPartner = partners[indexNum];

        const totalShares = await dbGet(`SELECT SUM(shares) as sum FROM partners WHERE id != ?`, [targetPartner.id]);
        const currentSum = totalShares.sum || 0;
        if (currentSum + sharesNum > 100.01) {
            return res.status(400).json({ success: false, error: "Total shares cannot exceed 100%" });
        }

        await dbRun(`UPDATE partners SET name = ?, shares = ? WHERE id = ?`, [name, sharesNum, targetPartner.id]);
        await logAction("EDIT_PARTNER", `Updated partner: ${targetPartner.name} -> ${name} (${sharesNum}%)`);
        res.json({ success: true, message: "Partner updated successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.delete('/api/company/partners/:index', async (req, res) => {
    const { index } = req.params;
    try {
        const indexNum = parseInt(index, 10);
        const partners = await dbAll(`SELECT * FROM partners`);
        if (isNaN(indexNum) || indexNum < 0 || indexNum >= partners.length) {
            return res.status(400).json({ success: false, error: "Invalid partner index" });
        }
        const targetPartner = partners[indexNum];

        await dbRun(`DELETE FROM partners WHERE id = ?`, [targetPartner.id]);
        await logAction("DELETE_PARTNER", `Removed partner: ${targetPartner.name}`);
        res.json({ success: true, message: "Partner deleted successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Payroll Endpoints
app.post('/api/employees/:id/pay', async (req, res) => {
    const { id } = req.params;
    const { months } = req.body;
    try {
        const emp = await dbGet(`SELECT * FROM employees WHERE id = ?`, [id]);
        if (!emp) {
            return res.status(404).json({ success: false, error: "Employee not found" });
        }
        if (emp.status !== "Active") {
            return res.status(400).json({ success: false, error: "Cannot pay salary to inactive employee" });
        }

        const monthsVal = months !== undefined ? parseInt(months, 10) : 1;
        const totalSalary = emp.salary * monthsVal;

        const company = await dbGet(`SELECT cash_available FROM company LIMIT 1`);
        if (company.cash_available < totalSalary) {
            return res.status(400).json({
                success: false,
                error: `Insufficient company cash (Required: ₹${totalSalary}, Available: ₹${company.cash_available})`
            });
        }

        await dbRun(`UPDATE company SET cash_available = cash_available - ?`, [totalSalary]);
        await logAction("PAYROLL", `Paid salary to ${emp.name} for ${monthsVal} month(s) (₹${totalSalary})`);

        res.json({ success: true, message: `Salary of ₹${totalSalary} paid successfully` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/company/payroll', async (req, res) => {
    const { months } = req.body;
    try {
        const activeEmployees = await dbAll(`SELECT * FROM employees WHERE status = 'Active'`);
        const company = await dbGet(`SELECT cash_available FROM company LIMIT 1`);
        const monthsNum = months !== undefined ? parseInt(months, 10) : 1;

        let totalPayroll = 0;
        for (const emp of activeEmployees) {
            totalPayroll += emp.salary * monthsNum;
        }

        if (totalPayroll === 0) {
            return res.json({ success: true, message: "No active employees to pay" });
        }

        if (company.cash_available < totalPayroll) {
            return res.status(400).json({
                success: false,
                error: `Insufficient company cash (Required: ₹${totalPayroll}, Available: ₹${company.cash_available})`
            });
        }

        await dbRun(`UPDATE company SET cash_available = cash_available - ?`, [totalPayroll]);
        await logAction("PAYROLL", `Processed payroll for ${activeEmployees.length} active employee(s) for ${monthsNum} month(s) (₹${totalPayroll})`);

        res.json({ success: true, message: `Payroll of ₹${totalPayroll} processed successfully for ${activeEmployees.length} employee(s)` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/backup', async (req, res) => {
    try {
        const company = await dbGet(`SELECT * FROM company LIMIT 1`);
        const partners = await dbAll(`SELECT * FROM partners`);
        const employees = await dbAll(`SELECT * FROM employees`);
        const inventory = await dbAll(`SELECT * FROM inventory`);
        const assignments = await dbAll(`SELECT * FROM assignments`);
        const logs = await dbAll(`SELECT * FROM logs`);

        const backupData = {
            company: {
                ...company,
                partners
            },
            employees,
            inventory,
            assignments,
            logs
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=flow_backup.json');
        res.send(JSON.stringify(backupData, null, 4));
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/restore', async (req, res) => {
    try {
        const data = req.body;
        if (!data || !data.company || !Array.isArray(data.employees) || !Array.isArray(data.inventory) || !Array.isArray(data.assignments) || !Array.isArray(data.logs)) {
            return res.status(400).json({ success: false, error: "Invalid backup data structure" });
        }

        // Clear tables
        await dbRun(`DELETE FROM employees`);
        await dbRun(`DELETE FROM inventory`);
        await dbRun(`DELETE FROM assignments`);
        await dbRun(`DELETE FROM logs`);
        await dbRun(`DELETE FROM company`);
        await dbRun(`DELETE FROM partners`);

        // Insert company
        await dbRun(`INSERT INTO company (name, owner, cash_available, debts, other_assets_value)
            VALUES (?, ?, ?, ?, ?)`, [
                data.company.name,
                data.company.owner,
                data.company.cash_available,
                data.company.debts,
                data.company.other_assets_value
            ]);

        // Insert partners
        if (Array.isArray(data.company.partners)) {
            for (const p of data.company.partners) {
                await dbRun(`INSERT INTO partners (name, shares) VALUES (?, ?)`, [p.name, p.shares]);
            }
        }

        // Insert employees
        for (const e of data.employees) {
            await dbRun(`INSERT INTO employees (id, name, email, role, department, joined_date, salary, contact_number, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    e.id, e.name, e.email, e.role, e.department, e.joined_date, e.salary, e.contact_number, e.status
                ]);
        }

        // Insert inventory
        for (const i of data.inventory) {
            await dbRun(`INSERT INTO inventory (id, name, category, sku, quantity, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                    i.id, i.name, i.category, i.sku, i.quantity, i.threshold, i.location, i.price, i.purchase_price, i.selling_price, i.supplier_name, i.supplier_contact, i.barcode
                ]);
        }

        // Insert assignments
        for (const a of data.assignments) {
            await dbRun(`INSERT INTO assignments (id, employee_id, inventory_id, assigned_date, notes)
                VALUES (?, ?, ?, ?, ?)`, [
                    a.id, a.employee_id, a.inventory_id, a.assigned_date, a.notes
                ]);
        }

        // Insert logs
        for (const l of data.logs) {
            await dbRun(`INSERT INTO logs (id, action, details, timestamp)
                VALUES (?, ?, ?, ?)`, [
                    l.id, l.action, l.details, l.timestamp
                ]);
        }

        res.json({ success: true, message: "Database restored successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Initialize database before starting server
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`==================================================`);
        console.log(` Flow server is running on http://localhost:${PORT}`);
        console.log(` Database: SQLite (flow.db)`);
        console.log(`==================================================`);
    });
});
