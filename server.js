const express = require('express');
const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper to execute the core engine (C++ binary or JS fallback)
function runEngine(args) {
    return new Promise((resolve, reject) => {
        const exePath = path.join(__dirname, 'engine.exe');
        let cmd = exePath;
        let execArgs = args;
        let isFallback = false;

        // Automatically switch to JavaScript fallback if C++ executable isn't compiled yet
        if (!fs.existsSync(exePath)) {
            cmd = 'node';
            execArgs = [path.join(__dirname, 'engine_fallback.js'), ...args];
            isFallback = true;
        }

        // Convert all arguments to strings
        const stringArgs = execArgs.map(arg => String(arg));

        execFile(cmd, stringArgs, { maxBuffer: 1024 * 1024 * 10 }, (error, stdout, stderr) => {
            if (isFallback) {
                console.log(`[Flow] Running JS Fallback Engine: ${stringArgs.join(' ')}`);
            } else {
                console.log(`[Flow] Running Native C++ Engine: ${stringArgs.join(' ')}`);
            }

            if (error) {
                console.error(`[Flow] Execution Error:`, error);
                return reject({ 
                    success: false, 
                    error: error.message, 
                    stderr: stderr.toString() 
                });
            }

            try {
                const parsed = JSON.parse(stdout.trim());
                resolve(parsed);
            } catch (e) {
                console.error("[Flow] Failed to parse JSON stdout:", stdout);
                reject({ 
                    success: false, 
                    error: "Failed to parse database engine response", 
                    details: e.message, 
                    stdout: stdout.toString() 
                });
            }
        });
    });
}

// REST API Endpoints

// 0. Status Endpoint
app.get('/api/status', (req, res) => {
    const exePath = path.join(__dirname, 'engine.exe');
    res.json({
        success: true,
        engine: fs.existsSync(exePath) ? "C++ Native Core" : "JS Fallback Engine"
    });
});

// 1. Dashboard Statistics
app.get('/api/dashboard', async (req, res) => {
    try {
        const stats = await runEngine(['get-dashboard-stats']);
        res.json(stats);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 2. Employees Endpoints
app.get('/api/employees', async (req, res) => {
    try {
        const employees = await runEngine(['list-employees']);
        res.json(employees);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/employees', async (req, res) => {
    const { name, email, role, department, salary, contact_number, status } = req.body;
    if (!name || !email || !role || !department) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const result = await runEngine([
            'add-employee', 
            name, 
            email, 
            role, 
            department, 
            salary !== undefined ? salary : 0, 
            contact_number || '', 
            status || 'Active'
        ]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.delete('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await runEngine(['delete-employee', id]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.put('/api/employees/:id', async (req, res) => {
    const { id } = req.params;
    const { name, email, role, department, salary, contact_number, status } = req.body;
    if (!name || !email || !role || !department) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const result = await runEngine([
            'edit-employee', 
            id, 
            name, 
            email, 
            role, 
            department, 
            salary !== undefined ? salary : '', 
            contact_number !== undefined ? contact_number : '', 
            status || ''
        ]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 3. Inventory Endpoints
app.get('/api/inventory', async (req, res) => {
    try {
        const inventory = await runEngine(['list-inventory']);
        res.json(inventory);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/inventory', async (req, res) => {
    const { name, category, sku, quantity, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode } = req.body;
    if (!name || !category || !sku || quantity === undefined || threshold === undefined || !location) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const result = await runEngine([
            'add-item', 
            name, 
            category, 
            sku, 
            quantity, 
            threshold, 
            location,
            price !== undefined ? price : 0,
            purchase_price !== undefined ? purchase_price : '',
            selling_price !== undefined ? selling_price : '',
            supplier_name || '',
            supplier_contact || '',
            barcode || ''
        ]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.delete('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const result = await runEngine(['delete-item', id]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.put('/api/inventory/:id', async (req, res) => {
    const { id } = req.params;
    const { name, category, sku, threshold, location, price, purchase_price, selling_price, supplier_name, supplier_contact, barcode } = req.body;
    if (!name || !category || !sku || threshold === undefined || !location) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    try {
        const result = await runEngine([
            'edit-item', 
            id, 
            name, 
            category, 
            sku, 
            threshold, 
            location,
            price !== undefined ? price : '',
            purchase_price !== undefined ? purchase_price : '',
            selling_price !== undefined ? selling_price : '',
            supplier_name !== undefined ? supplier_name : '',
            supplier_contact !== undefined ? supplier_contact : '',
            barcode !== undefined ? barcode : ''
        ]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/inventory/:id/quantity', async (req, res) => {
    const { id } = req.params;
    const { change, value } = req.body;
    
    try {
        if (value !== undefined) {
            // Direct set quantity
            const result = await runEngine(['set-quantity', id, value]);
            res.json(result);
        } else if (change !== undefined) {
            // Incremental change
            const result = await runEngine(['update-quantity', id, change]);
            res.json(result);
        } else {
            res.status(400).json({ success: false, error: "Missing quantity change or value" });
        }
    } catch (err) {
        res.status(500).json(err);
    }
});

// 3.5 Sales / Consumption Endpoints
app.post('/api/sales', async (req, res) => {
    const { employee_id, inventory_id, quantity } = req.body;
    if (employee_id === undefined || inventory_id === undefined || quantity === undefined) {
        return res.status(400).json({ success: false, error: "Missing employee ID, inventory ID or quantity" });
    }
    try {
        const result = await runEngine(['record-sale', employee_id, inventory_id, quantity]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 4. Assignments (Check-out / Check-in)
app.post('/api/inventory/assign', async (req, res) => {
    const { employee_id, inventory_id, notes } = req.body;
    if (employee_id === undefined || inventory_id === undefined) {
        return res.status(400).json({ success: false, error: "Missing employee ID or inventory ID" });
    }
    try {
        const result = await runEngine(['assign-item', employee_id, inventory_id, notes || '']);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/inventory/return', async (req, res) => {
    const { assignment_id } = req.body;
    if (assignment_id === undefined) {
        return res.status(400).json({ success: false, error: "Missing assignment ID" });
    }
    try {
        const result = await runEngine(['return-item', assignment_id]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.get('/api/assignments', async (req, res) => {
    try {
        const result = await runEngine(['list-assignments']);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 5. Audit Logs
app.get('/api/logs', async (req, res) => {
    try {
        const logs = await runEngine(['list-logs']);
        res.json(logs);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/demo', async (req, res) => {
    try {
        const result = await runEngine(['load-demo']);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/reset', async (req, res) => {
    try {
        const result = await runEngine(['reset-db']);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// 6. Company Hub Endpoints
app.get('/api/company', async (req, res) => {
    try {
        const result = await runEngine(['get-company-data']);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.put('/api/company', async (req, res) => {
    const { name, owner, other_assets_value } = req.body;
    if (!name || !owner || other_assets_value === undefined) {
        return res.status(400).json({ success: false, error: "Missing company profile attributes" });
    }
    try {
        const result = await runEngine(['update-company-profile', name, owner, other_assets_value]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/company/finances', async (req, res) => {
    const { cash_change, debt_change, details } = req.body;
    if (cash_change === undefined || debt_change === undefined || !details) {
        return res.status(400).json({ success: false, error: "Missing finance adjustment attributes" });
    }
    try {
        const result = await runEngine(['adjust-finances', cash_change, debt_change, details]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/company/partners', async (req, res) => {
    const { name, shares } = req.body;
    if (!name || shares === undefined) {
        return res.status(400).json({ success: false, error: "Missing partner attributes" });
    }
    try {
        const result = await runEngine(['add-partner', name, shares]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.put('/api/company/partners/:index', async (req, res) => {
    const { index } = req.params;
    const { name, shares } = req.body;
    if (!name || shares === undefined) {
        return res.status(400).json({ success: false, error: "Missing partner attributes" });
    }
    try {
        const result = await runEngine(['edit-partner', index, name, shares]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.delete('/api/company/partners/:index', async (req, res) => {
    const { index } = req.params;
    try {
        const result = await runEngine(['delete-partner', index]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

// Payroll Endpoints
app.post('/api/employees/:id/pay', async (req, res) => {
    const { id } = req.params;
    const { months } = req.body;
    try {
        const result = await runEngine(['pay-salary', id, months !== undefined ? months : 1]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.post('/api/company/payroll', async (req, res) => {
    const { months } = req.body;
    try {
        const result = await runEngine(['run-payroll', months !== undefined ? months : 1]);
        res.json(result);
    } catch (err) {
        res.status(500).json(err);
    }
});

app.get('/api/backup', (req, res) => {
    const dbPath = path.join(__dirname, 'data.json');
    if (!fs.existsSync(dbPath)) {
        return res.status(404).json({ success: false, error: "Database file not found" });
    }
    res.download(dbPath, 'flow_backup.json');
});

app.post('/api/restore', (req, res) => {
    try {
        const data = req.body;
        if (!data || !Array.isArray(data.employees) || !Array.isArray(data.inventory) || !Array.isArray(data.assignments) || !Array.isArray(data.logs)) {
            return res.status(400).json({ success: false, error: "Invalid backup data structure" });
        }
        const dbPath = path.join(__dirname, 'data.json');
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 4), 'utf8');
        res.json({ success: true, message: "Database restored successfully" });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`==================================================`);
    console.log(` Flow server is running on http://localhost:${PORT}`);
    console.log(` C++ backend will be used automatically if compiled`);
    console.log(` Falling back to Javascript engine otherwise`);
    console.log(`==================================================`);
});
