# StockFlow: Hybrid C++ & Node.js Inventory & Employee Tracker

StockFlow is a lightweight, high-performance IT assets and employee tracker built using a modern **hybrid architecture**. The core business logic, object models, and data serialization are written in **native C++**, while a **Node.js/Express** server coordinates HTTP routing, serving static files, and executing the C++ engine as an optimized subprocess. 

It is designed to demonstrate key Software Development Engineering (SDE) concepts: Object-Oriented Programming (OOP) in C++, Inter-Process Communication (IPC), Custom Parsers, Data Persistence, and Resilient Software Design.

---

## 🏗️ System Architecture

StockFlow employs a **Decoupled Hybrid Architecture**:
* **Frontend**: A single-page dashboard designed using clean HTML5, modern CSS3 variables (featuring a dark, glassmorphic UI), and vanilla JavaScript.
* **Server**: Node.js/Express API gateway that routes requests, manages Web traffic, and runs the backend engine.
* **Database Engine (C++)**: An optimized, native executable (`engine.exe`) written in standard C++17 that loads, validates, processes, and serializes database entities.
* **Data Layer**: A JSON file (`data.json`) that acts as a flat-file relational database.
* **Fail-Safe Mechanism**: The Node.js server detects whether the C++ binary is compiled. If it's missing, it automatically routes queries through a JavaScript clone of the C++ engine (`engine_fallback.js`). This ensures the app is portable and runs immediately on any system out-of-the-box.

```
[Web Dashboard] <---(HTTP / JSON)---> [Express Server (Node.js)]
                                             |
                          +------------------+------------------+
                          | (Binary Exists)                     | (Fallback)
                          v                                     v
                  [C++ Engine (.exe)]                   [JS Engine (.js)]
                          |                                     |
                          +------------------+------------------+
                                             |
                                             v
                                      [Database File]
```

---

## 💾 Relational Database Schema

The database file `data.json` houses four core relational tables:

1. **`employees` Table**
   * `id` (int): Unique primary key.
   * `name` (string): Full name of the employee.
   * `email` (string, unique): Unique corporate email address.
   * `role` (string): Current designation.
   * `department` (string): Department name.
   * `joined_date` (string): YYYY-MM-DD timestamp.

2. **`inventory` Table**
   * `id` (int): Unique primary key.
   * `name` (string): Item name (e.g. "MacBook Pro M3").
   * `category` (string): Category (e.g. "Laptops").
   * `sku` (string, unique): Stock Keeping Unit.
   * `quantity` (int): Active count of items currently available in storage.
   * `threshold` (int): Alert threshold. If `quantity <= threshold`, a Low Stock warning is triggered.
   * `location` (int): Physical storage cabinet or room.

3. **`assignments` Table**
   * `id` (int): Unique primary key.
   * `employee_id` (int): Foreign key referencing `employees.id`.
   * `inventory_id` (int): Foreign key referencing `inventory.id`.
   * `assigned_date` (string): Checkout timestamp.
   * `notes` (string): Serial numbers or condition reports.

4. **`logs` Table**
   * `id` (int): Auto-incrementing transaction log ID.
   * `action` (string): Type of action (`ADD_EMPLOYEE`, `ASSIGN_ITEM`, etc.).
   * `details` (string): Text describing the event.
   * `timestamp` (string): ISO-8601 UTC time.

---

## 🚀 Getting Started

### 1. Run immediately (JavaScript Fallback Mode)
Since compilation is not required for the fallback mode, you can run the server immediately:
```bash
# Install dependencies (Express)
npm install

# Start the Web server
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser. The sidebar badge will display **JS Fallback Engine**.

### 2. Compile and Enable C++ Core Engine
To run the project with the native C++ engine, you must compile `engine.cpp` into `engine.exe`.
* **Prerequisite**: Install `g++` (GCC compiler). You can install it on Windows using MSYS2 or by running `winget install MSYS2.MSYS2`.
* **Compile**: Double-click `build.bat` in your project folder, or run the following command in terminal:
  ```bash
  g++ -std=c++17 -O3 engine.cpp -o engine.exe
  ```
Once `engine.exe` is generated in the project root, restart the Node server (`npm start`). The sidebar badge will dynamically switch to **C++ Native Core**.

---

## 💡 SDE Interview Questions & Answers

If you put this project on your CV, recruiters will ask about the design. Here are key questions and how to answer them:

### Q1: Why did you design a hybrid Node.js & C++ application instead of a pure JS app?
> **Answer:** "I wanted to demonstrate a clear separation of concerns. Node.js is excellent for handling web requests, concurrent I/O connections, and serving static files asynchronously. C++ is ideal for writing high-performance, deterministic business logic, managing raw data memory layouts, and handling computational algorithms. By decoupling them, I gained the scalability of Node.js and the low-level efficiency of C++."

### Q2: How do Node.js and C++ communicate?
> **Answer:** "They communicate via subprocess execution (using Node's `child_process.execFile`) and standard output redirection. When an API endpoint is hit, Node spawns the compiled C++ executable, passing subcommands and parameters (like `assign-item 1 4`) as command-line arguments. The C++ executable performs the operations and outputs serialized JSON to its standard output (`std::cout`). Node reads the stdout stream, parses the JSON, and sends the response back to the client."

### Q3: How did you implement JSON parsing in C++ without third-party libraries?
> **Answer:** "To demonstrate database engine design, I wrote a custom JSON parser in C++ using basic string operations and tokenizers. I scanned the raw file content to identify objects bounded by `{}` and arrays bounded by `[]`. I extracted key-value pairs by looking up key coordinates (e.g., `\"name\"`) and scanning forward to parse the string value between quotes or numbers before structural boundaries. This avoids heavy external library dependencies and compiles instantly."

### Q4: How does your database maintain referential integrity (Foreign Keys)?
> **Answer:** "In my C++ engine, I implemented manual constraints. For instance, before deleting an employee, the engine scans the `assignments` vector to see if any inventory items are active under their ID. If an assignment is found, the engine blocks the deletion and throws a validation error. Similarly, assigning gear checks that both `employee_id` and `inventory_id` exist, and that the stock quantity is greater than zero."

### Q5: How would you scale this database to handle thousands of concurrent requests?
> **Answer:** "My current flat-file database has a writing bottleneck since it rewrites `data.json` on changes. To scale, I would:
> 1. Implement a **read/write lock (mutex)** in C++ to prevent file corruption during concurrent operations.
> 2. Introduce **Write-Ahead Logging (WAL)** so changes are written to a lightweight log first before merging into the main file.
> 3. Eventually, replace the flat-file backend with a lightweight embedded relational database like **SQLite** (using the `sqlite3` C API) and introduce indexing on high-query fields like `sku` or `employee_id` to reduce lookup time from \(O(N)\) to \(O(\log N)\)."
