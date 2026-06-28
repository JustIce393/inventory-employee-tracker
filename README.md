# Flow — Inventory & Employee Tracker

> A high-performance, full-stack asset & payroll management dashboard built with a **Hybrid C++ + Node.js Architecture**.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![C++](https://img.shields.io/badge/engine-C++17-orange)
![Node.js](https://img.shields.io/badge/server-Node.js%20%2B%20Express-brightgreen)
![Status](https://img.shields.io/badge/status-Active-success)

---

## 📌 What Is Flow?

**Flow** is a full-stack web application for managing a company's employees, inventory assets, payroll, and financial data — all from a single beautiful dashboard.

It is designed as a **CV-ready college project** that demonstrates real-world SDE (Software Development Engineer) concepts including:

- Native C++ backend engine with custom JSON parser
- Inter-Process Communication (IPC) between C++ and Node.js
- RESTful API design with Express.js
- Single-page application (SPA) with vanilla HTML/CSS/JS
- Flat-file relational database with referential integrity
- Automated payroll scheduling and dual-price inventory tracking

---

## 🏗️ System Architecture

Flow uses a **Decoupled Hybrid Architecture** — the web server and the business logic engine are completely separated:

```
┌─────────────────────────────────┐
│        Web Browser (SPA)        │
│   HTML5 + CSS3 + Vanilla JS     │
└────────────┬────────────────────┘
             │  HTTP / JSON
             ▼
┌─────────────────────────────────┐
│    Express Server (Node.js)     │
│   REST API Gateway + Routing    │
└────────┬────────────────────────┘
         │  Child Process (stdout/stdin)
         ▼
┌────────────────────┐    ┌────────────────────┐
│  C++ Engine        │ OR │  JS Fallback Engine │
│  (engine.exe)      │    │  (engine_fallback)  │
│  [If compiled]     │    │  [Auto-fallback]    │
└────────┬───────────┘    └─────────┬──────────┘
         │                          │
         └──────────┬───────────────┘
                    ▼
         ┌──────────────────┐
         │   data.json      │
         │  (Flat-file DB)  │
         └──────────────────┘
```

### Key Design Decision — Why Two Engines?

| | C++ Engine | JS Fallback Engine |
|---|---|---|
| **File** | `engine.cpp` → `engine.exe` | `engine_fallback.js` |
| **Performance** | Native binary, fastest | Interpreted, slower |
| **Portability** | Needs `g++` compiler | Runs anywhere with Node |
| **Use Case** | Production / Demos | First-run / Portability |
| **Auto-detected** | Yes — server checks for `.exe` | Yes — used if `.exe` missing |

The server **automatically detects** which engine to use. The UI sidebar badge dynamically shows `C++ Native Core` or `JS Fallback Engine`.

---

## ✨ Features

### 👥 Employee Management
- Add, edit, delete employee profiles (name, email, role, department, salary, status)
- Filter by department, assignment status, or search by name/role/email
- Employee status tracking: Active / Inactive
- Units sold and sales breakdown per employee

### 📦 Inventory Management
- Full product catalog with dual pricing: **Purchase Price** (cost basis) and **Selling Price** (retail)
- Low stock alerts with configurable thresholds
- Assign gear to employees (decrements stock automatically)
- Return gear from employees (restores stock)
- Barcode and supplier tracking
- Category analytics with progress bars

### 💸 Payroll & Finance
- Pay individual employee salaries (deducts from company cash)
- Bulk payroll for all active employees
- Fast-forward payroll simulation (N months)
- Auto-payroll scheduler (runs every 15s / 30s / 60s)
- Cash auto-adjusts on every restock purchase and sale

### 🏢 Company Hub
- Balance sheet: Cash Available, Inventory Asset Value, Other Assets, Total Assets, Debts, Net Worth
- Share partner management (add, edit, remove with % validation)
- Company profile editor (name, owner, other assets)
- Manual cash/debt adjustment with audit trail entry

### 📊 Dashboard
- Real-time stats: Total Employees, Stock Units, Active Assignments, Low Stock Alerts
- Low stock widget with quick restock (+5 units) buttons
- Recent activity feed from audit logs
- Category breakdown bar charts
- Most stocked products leaderboard
- Top sales analytics widget

### 🔍 Audit Logs
- Full transaction history (every add, edit, delete, sale, payroll event)
- Action type filter + keyword search
- Relative timestamps ("just now", "2h ago", etc.)
- CSV export support

### 🎨 UI & Experience
- 4 themes: **Midnight Nebula** (dark), **Emerald Aurora** (green), **Cyberpunk Amber** (orange), **Solar Slate** (light)
- Glassmorphic card designs with smooth animations
- Animated breadcrumb navigation bar
- Responsive layout
- Toast notifications for all actions
- Database backup (JSON download) and restore (JSON upload)
- Admin password protection with session management

---

## 💾 Database Schema

`data.json` acts as a flat-file relational database with 5 tables:

### `employees`
| Field | Type | Description |
|---|---|---|
| `id` | int (PK) | Unique auto-increment ID |
| `name` | string | Full name |
| `email` | string (unique) | Corporate email |
| `role` | string | Job title / designation |
| `department` | string | Team or department |
| `joined_date` | string | ISO date (YYYY-MM-DD) |
| `salary` | double | Monthly salary (in rupees) |
| `contact_number` | string | Phone number |
| `status` | string | Active or Inactive |

### `inventory`
| Field | Type | Description |
|---|---|---|
| `id` | int (PK) | Unique auto-increment ID |
| `name` | string | Product name |
| `category` | string | e.g. Laptops, Mobiles |
| `sku` | string (unique) | Stock Keeping Unit |
| `quantity` | int | Current units in stock |
| `threshold` | int | Low stock alert level |
| `location` | string | Physical location / cabinet |
| `purchase_price` | double | Cost paid to supplier |
| `selling_price` | double | Retail price to customer |
| `supplier_name` | string | Vendor name |
| `supplier_contact` | string | Vendor contact |
| `barcode` | string | Barcode identifier |

### `assignments`
| Field | Type | Description |
|---|---|---|
| `id` | int (PK) | Unique ID |
| `employee_id` | int (FK) | References employees.id |
| `inventory_id` | int (FK) | References inventory.id |
| `assigned_date` | string | Checkout date |
| `notes` | string | Serial number / condition |

### `logs`
| Field | Type | Description |
|---|---|---|
| `id` | int (PK) | Auto-increment log ID |
| `action` | string | Event type (ADD_EMPLOYEE, SALE, etc.) |
| `details` | string | Human-readable description |
| `timestamp` | string | ISO-8601 UTC time |

### `company`
| Field | Type | Description |
|---|---|---|
| `name` | string | Company name |
| `owner` | string | Owner / founder name |
| `cash_available` | double | Current liquid cash |
| `debts` | double | Outstanding liabilities |
| `other_assets_value` | double | Property, equipment, etc. |
| `partners` | array | List of { name, shares% } |

---

## 🚀 Getting Started

### Option 1 — Run Immediately (No Compilation Needed)

The JavaScript fallback engine works out of the box:

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

Open **http://localhost:3000** in your browser.
- Default password: `admin123`
- The sidebar badge will show **JS Fallback Engine**

---

### Option 2 — Run with Native C++ Engine (Recommended)

**Prerequisite**: Install `g++` (GCC compiler)
- **Windows**: Install via MSYS2 — `winget install MSYS2.MSYS2`
- **Linux/Mac**: Usually pre-installed (`sudo apt install g++`)

**Compile the engine:**
```bash
g++ -std=c++17 -O3 engine.cpp -o engine.exe
```

Or on Windows, simply **double-click `build.bat`**.

**Then start the server:**
```bash
npm start
```

The sidebar badge will switch to **C++ Native Core** automatically.

---

### Quick Commands Reference

| Command | Description |
|---|---|
| `npm install` | Install Node.js dependencies |
| `npm start` | Start the Flow server on port 3000 |
| `g++ -std=c++17 -O3 engine.cpp -o engine.exe` | Compile C++ engine |

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Frontend** | HTML5 + CSS3 | Structure and layout |
| **Frontend JS** | Vanilla JavaScript (ES6+) | DOM, fetch API, timers |
| **Backend** | Node.js + Express.js | HTTP server and REST API |
| **Core Engine** | C++17 | Business logic and data persistence |
| **Fallback Engine** | JavaScript (Node.js) | Portable fallback when C++ isn't compiled |
| **Database** | JSON flat-file (data.json) | Persistent storage |
| **Fonts** | Google Fonts (Outfit) | Typography |

---

## 📁 Project Structure

```
flow/
├── engine.cpp            <- C++ core engine (all business logic)
├── engine.exe            <- Compiled binary (generated by build.bat)
├── engine_fallback.js    <- JavaScript clone of the C++ engine
├── server.js             <- Express.js API server + IPC bridge
├── data.json             <- Flat-file JSON database
├── package.json          <- Node.js project config
├── build.bat             <- Windows one-click compiler script
├── run.bat               <- Windows one-click run script
└── public/
    ├── index.html        <- Single-page application shell
    ├── styles.css        <- All CSS styles and themes
    └── app.js            <- Frontend JavaScript logic
```

---

## 💡 SDE Interview Q&A

If you list this project on your CV, here are the questions recruiters ask — and how to answer them:

---

### Q1: Why did you use C++ alongside Node.js instead of a pure JS stack?

> I wanted to demonstrate a **separation of concerns** between the web layer and the business logic layer. Node.js excels at handling concurrent HTTP requests and I/O asynchronously. C++ excels at deterministic, fast, memory-efficient computation. By decoupling them, I got the scalability of Node's event loop combined with the raw performance of native C++ for the database engine — similar to how databases like Redis or SQLite are written in C/C++ and called from higher-level language servers.

---

### Q2: How do Node.js and C++ communicate?

> Via **subprocess execution and stdout redirection** — the same IPC model used by tools like Git or FFmpeg. When an API endpoint is hit, the Express server spawns the compiled engine.exe as a child process using Node's `child_process.execFile`, passing the command and parameters as argv arguments (e.g. `engine.exe assign-item 1 4`). The C++ engine processes the operation and prints serialized JSON to stdout. Node reads that stream, parses the JSON, and sends it as the HTTP response to the browser.

---

### Q3: How did you write a JSON parser in C++ without any libraries?

> I implemented a custom tokenizer using basic string operations. The parser scans raw file content to locate keys by searching for `"key"`, then advances past the `:` separator to extract the value — either a quoted string (parsed character-by-character with escape handling) or a numeric token (reading until a structural delimiter like `,`, `}`, or `]`). For arrays, I track brace depth to extract nested objects. This avoids all third-party dependencies and keeps the binary tiny.

---

### Q4: How does your database enforce referential integrity?

> Manually in the C++ engine using vector scans. Before deleting an employee, the engine checks the assignments vector for any record where `employee_id` matches. If one is found, the delete is blocked with a validation error. The same applies to inventory items. Before recording a sale, the engine verifies the employee exists, the inventory item exists, and that sufficient stock is available — all with explicit checks before mutating state.

---

### Q5: How does the automatic payroll scheduler work?

> The frontend uses `setInterval()` to call the `/api/company/payroll` REST endpoint at a configured interval (15s, 30s, or 60s). The Express server forwards this to the C++ engine's `run-payroll` command, which sums salaries of all Active employees, checks if `cash_available >= total_payroll`, deducts the amount, adds an audit log entry, and saves the updated `data.json`. If cash runs too low, the API returns an error and the frontend automatically disables the scheduler toggle.

---

### Q6: How would you scale this to handle thousands of users?

> The current flat-file database has a write bottleneck — `data.json` is fully rewritten on every mutation. To scale:
> 1. **Add a mutex (read/write lock)** in the C++ engine to prevent file corruption under concurrent writes
> 2. **Introduce Write-Ahead Logging (WAL)** — write changes to a lightweight log first, merge asynchronously
> 3. **Replace the flat-file with SQLite** using the C sqlite3 API — it supports concurrent reads, atomic transactions, and indexed queries that reduce lookup from O(N) to O(log N)
> 4. **Add a caching layer** (e.g. an in-memory hash map) for frequently read entities like employees and inventory lists

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

*Built as a full-stack systems programming project demonstrating hybrid C++ + Node.js architecture, RESTful API design, and modern SPA development.*
