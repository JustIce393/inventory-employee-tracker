#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <sstream>
#include <algorithm>
#include <ctime>
#include <iomanip>

const std::string DB_FILE = "data.json";

// Forward declaration
std::string escapeJsonString(const std::string& input);

// Model Declarations
struct Employee {
    int id;
    std::string name;
    std::string email;
    std::string role;
    std::string department;
    std::string joined_date;
    double salary;
    std::string contact_number;
    std::string status;

    std::string toJson() const {
        return "{\n"
               "            \"id\": " + std::to_string(id) + ",\n"
               "            \"name\": \"" + escapeJsonString(name) + "\",\n"
               "            \"email\": \"" + escapeJsonString(email) + "\",\n"
               "            \"role\": \"" + escapeJsonString(role) + "\",\n"
               "            \"department\": \"" + escapeJsonString(department) + "\",\n"
               "            \"joined_date\": \"" + joined_date + "\",\n"
               "            \"salary\": " + std::to_string(salary) + ",\n"
               "            \"contact_number\": \"" + escapeJsonString(contact_number) + "\",\n"
               "            \"status\": \"" + escapeJsonString(status) + "\"\n"
               "        }";
    }
};

struct InventoryItem {
    int id;
    std::string name;
    std::string category;
    std::string sku;
    int quantity;
    int threshold;
    std::string location;
    double price;
    double purchase_price;
    double selling_price;
    std::string supplier_name;
    std::string supplier_contact;
    std::string barcode;

    std::string toJson() const {
        return "{\n"
               "            \"id\": " + std::to_string(id) + ",\n"
               "            \"name\": \"" + escapeJsonString(name) + "\",\n"
               "            \"category\": \"" + escapeJsonString(category) + "\",\n"
               "            \"sku\": \"" + escapeJsonString(sku) + "\",\n"
               "            \"quantity\": " + std::to_string(quantity) + ",\n"
               "            \"threshold\": " + std::to_string(threshold) + ",\n"
               "            \"location\": \"" + escapeJsonString(location) + "\",\n"
               "            \"price\": " + std::to_string(price) + ",\n"
               "            \"purchase_price\": " + std::to_string(purchase_price) + ",\n"
               "            \"selling_price\": " + std::to_string(selling_price) + ",\n"
               "            \"supplier_name\": \"" + escapeJsonString(supplier_name) + "\",\n"
               "            \"supplier_contact\": \"" + escapeJsonString(supplier_contact) + "\",\n"
               "            \"barcode\": \"" + escapeJsonString(barcode) + "\"\n"
               "        }";
    }
};


struct Assignment {
    int id;
    int employee_id;
    int inventory_id;
    std::string assigned_date;
    std::string notes;

    std::string toJson() const {
        return "{\n"
               "            \"id\": " + std::to_string(id) + ",\n"
               "            \"employee_id\": " + std::to_string(employee_id) + ",\n"
               "            \"inventory_id\": " + std::to_string(inventory_id) + ",\n"
               "            \"assigned_date\": \"" + assigned_date + "\",\n"
               "            \"notes\": \"" + escapeJsonString(notes) + "\"\n"
               "        }";
    }
};

struct AuditLog {
    int id;
    std::string action;
    std::string details;
    std::string timestamp;

    std::string toJson() const {
        return "{\n"
               "            \"id\": " + std::to_string(id) + ",\n"
               "            \"action\": \"" + action + "\",\n"
               "            \"details\": \"" + escapeJsonString(details) + "\",\n"
               "            \"timestamp\": \"" + timestamp + "\"\n"
               "        }";
    }
};

struct Partner {
    std::string name;
    double shares;

    std::string toJson() const {
        return "{\n"
               "            \"name\": \"" + escapeJsonString(name) + "\",\n"
               "            \"shares\": " + std::to_string(shares) + "\n"
               "        }";
    }
};

struct CompanyData {
    std::string name;
    std::string owner;
    double cash_available;
    double debts;
    double other_assets_value;
    std::vector<Partner> partners;

    std::string toJson() const {
        std::string partnersJson = "[\n";
        for (size_t i = 0; i < partners.size(); ++i) {
            partnersJson += "            " + partners[i].toJson();
            if (i + 1 < partners.size()) partnersJson += ",";
            partnersJson += "\n";
        }
        partnersJson += "        ]";

        return "{\n"
               "        \"name\": \"" + escapeJsonString(name) + "\",\n"
               "        \"owner\": \"" + escapeJsonString(owner) + "\",\n"
               "        \"cash_available\": " + std::to_string(cash_available) + ",\n"
               "        \"debts\": " + std::to_string(debts) + ",\n"
               "        \"other_assets_value\": " + std::to_string(other_assets_value) + ",\n"
               "        \"partners\": " + partnersJson + "\n"
               "    }";
    }
};

// Global Company Data
inline CompanyData company;

// Custom Helper: Get Current ISO Timestamp
std::string getIsoTimestamp() {
    std::time_t t = std::time(nullptr);
    std::tm* tm_ptr = std::gmtime(&t);
    if (!tm_ptr) return "";
    std::ostringstream oss;
    oss << std::put_time(tm_ptr, "%Y-%m-%dT%H:%M:%SZ");
    return oss.str();
}

// Custom Helper: Get Current Date (YYYY-MM-DD)
std::string getCurrentDate() {
    std::time_t t = std::time(nullptr);
    std::tm* tm_ptr = std::gmtime(&t);
    if (!tm_ptr) return "";
    std::ostringstream oss;
    oss << std::put_time(tm_ptr, "%Y-%m-%d");
    return oss.str();
}

// Custom Helper: Escape strings for JSON output
std::string escapeJsonString(const std::string& input) {
    std::ostringstream ss;
    for (char c : input) {
        if (c == '\\') ss << "\\\\";
        else if (c == '"') ss << "\\\"";
        else if (c == '\n') ss << "\\n";
        else if (c == '\r') ss << "\\r";
        else if (c == '\t') ss << "\\t";
        else ss << c;
    }
    return ss.str();
}

// ==========================================
// CUSTOM JSON PARSER CODE
// ==========================================

std::string getJsonValue(const std::string& obj, const std::string& key) {
    size_t keyPos = obj.find("\"" + key + "\"");
    if (keyPos == std::string::npos) return "";

    size_t colonPos = obj.find(":", keyPos);
    if (colonPos == std::string::npos) return "";

    // Skip whitespace
    size_t valStart = colonPos + 1;
    while (valStart < obj.length() && (obj[valStart] == ' ' || obj[valStart] == '\t' || obj[valStart] == '\n' || obj[valStart] == '\r')) {
        valStart++;
    }

    if (valStart >= obj.length()) return "";

    if (obj[valStart] == '"') {
        // String value (parse and handle escape characters properly)
        valStart++; // skip opening quote
        std::string result = "";
        size_t i = valStart;
        while (i < obj.length()) {
            if (obj[i] == '\\') {
                if (i + 1 < obj.length()) {
                    char escaped = obj[i+1];
                    if (escaped == '"') result += '"';
                    else if (escaped == '\\') result += '\\';
                    else if (escaped == 'n') result += '\n';
                    else if (escaped == 'r') result += '\r';
                    else if (escaped == 't') result += '\t';
                    else {
                        result += '\\';
                        result += escaped;
                    }
                    i += 2;
                } else {
                    result += '\\';
                    i++;
                }
            } else if (obj[i] == '"') {
                // Closing quote found
                return result;
            } else {
                result += obj[i];
                i++;
            }
        }
        return result;
    } else {
        // Number value
        size_t valEnd = valStart;
        while (valEnd < obj.length() && obj[valEnd] != ',' && obj[valEnd] != '}' && obj[valEnd] != ']') {
            valEnd++;
        }
        std::string val = obj.substr(valStart, valEnd - valStart);
        // Trim whitespace from end
        while (!val.empty() && (val.back() == ' ' || val.back() == '\t' || val.back() == '\n' || val.back() == '\r')) {
            val.pop_back();
        }
        return val;
    }
}

std::vector<std::string> getJsonArrayObjects(const std::string& dbContent, const std::string& arrayKey) {
    std::vector<std::string> objects;
    size_t arrayKeyPos = dbContent.find("\"" + arrayKey + "\"");
    if (arrayKeyPos == std::string::npos) return objects;

    size_t startBracket = dbContent.find("[", arrayKeyPos);
    if (startBracket == std::string::npos) return objects;

    size_t endBracket = startBracket;
    int bracketCount = 1;
    while (endBracket + 1 < dbContent.length() && bracketCount > 0) {
        endBracket++;
        if (dbContent[endBracket] == '[') bracketCount++;
        if (dbContent[endBracket] == ']') bracketCount--;
    }

    std::string arrayContent = dbContent.substr(startBracket, endBracket - startBracket + 1);

    size_t searchPos = 0;
    while (true) {
        size_t startBrace = arrayContent.find("{", searchPos);
        if (startBrace == std::string::npos) break;

        size_t endBrace = startBrace;
        int braceCount = 1;
        while (endBrace + 1 < arrayContent.length() && braceCount > 0) {
            endBrace++;
            if (arrayContent[endBrace] == '{') braceCount++;
            if (arrayContent[endBrace] == '}') braceCount--;
        }

        if (braceCount == 0) {
            objects.push_back(arrayContent.substr(startBrace, endBrace - startBrace + 1));
            searchPos = endBrace + 1;
        } else {
            break;
        }
    }
    return objects;
}

std::string getJsonObjectString(const std::string& dbContent, const std::string& key) {
    size_t keyPos = dbContent.find("\"" + key + "\"");
    if (keyPos == std::string::npos) return "";

    size_t startBrace = dbContent.find("{", keyPos);
    if (startBrace == std::string::npos) return "";

    size_t endBrace = startBrace;
    int braceCount = 1;
    while (endBrace + 1 < dbContent.length() && braceCount > 0) {
        endBrace++;
        if (dbContent[endBrace] == '{') braceCount++;
        if (dbContent[endBrace] == '}') braceCount--;
    }

    if (braceCount == 0) {
        return dbContent.substr(startBrace, endBrace - startBrace + 1);
    }
    return "";
}

// ==========================================
// DATABASE PERSISTENCE CODE
// ==========================================

void loadDatabase(std::vector<Employee>& employees,
                  std::vector<InventoryItem>& inventory,
                  std::vector<Assignment>& assignments,
                  std::vector<AuditLog>& logs) {
    std::ifstream file(DB_FILE);
    if (!file.is_open()) {
        // Database file doesn't exist, will be created on save
        return;
    }

    std::stringstream buffer;
    buffer << file.rdbuf();
    std::string content = buffer.str();
    file.close();

    // Parse Employees
    auto empObjects = getJsonArrayObjects(content, "employees");
    for (const auto& obj : empObjects) {
        Employee emp;
        emp.id = std::stoi(getJsonValue(obj, "id"));
        emp.name = getJsonValue(obj, "name");
        emp.email = getJsonValue(obj, "email");
        emp.role = getJsonValue(obj, "role");
        emp.department = getJsonValue(obj, "department");
        emp.joined_date = getJsonValue(obj, "joined_date");
        std::string salStr = getJsonValue(obj, "salary");
        emp.salary = salStr.empty() ? 0.0 : std::stod(salStr);
        emp.contact_number = getJsonValue(obj, "contact_number");
        emp.status = getJsonValue(obj, "status");
        if (emp.status.empty()) emp.status = "Active";
        employees.push_back(emp);
    }

    // Parse Inventory Items
    auto invObjects = getJsonArrayObjects(content, "inventory");
    for (const auto& obj : invObjects) {
        InventoryItem item;
        item.id = std::stoi(getJsonValue(obj, "id"));
        item.name = getJsonValue(obj, "name");
        item.category = getJsonValue(obj, "category");
        item.sku = getJsonValue(obj, "sku");
        item.quantity = std::stoi(getJsonValue(obj, "quantity"));
        item.threshold = std::stoi(getJsonValue(obj, "threshold"));
        item.location = getJsonValue(obj, "location");
        std::string priceStr = getJsonValue(obj, "price");
        item.price = priceStr.empty() ? 0.0 : std::stod(priceStr);
        
        std::string pPriceStr = getJsonValue(obj, "purchase_price");
        std::string sPriceStr = getJsonValue(obj, "selling_price");
        item.selling_price = sPriceStr.empty() ? item.price : std::stod(sPriceStr);
        item.purchase_price = pPriceStr.empty() ? item.selling_price * 0.7 : std::stod(pPriceStr);

        item.supplier_name = getJsonValue(obj, "supplier_name");
        item.supplier_contact = getJsonValue(obj, "supplier_contact");
        item.barcode = getJsonValue(obj, "barcode");
        inventory.push_back(item);
    }

    // Parse Assignments
    auto assignObjects = getJsonArrayObjects(content, "assignments");
    for (const auto& obj : assignObjects) {
        Assignment a;
        a.id = std::stoi(getJsonValue(obj, "id"));
        a.employee_id = std::stoi(getJsonValue(obj, "employee_id"));
        a.inventory_id = std::stoi(getJsonValue(obj, "inventory_id"));
        a.assigned_date = getJsonValue(obj, "assigned_date");
        a.notes = getJsonValue(obj, "notes");
        assignments.push_back(a);
    }

    // Parse Audit Logs
    auto logObjects = getJsonArrayObjects(content, "logs");
    for (const auto& obj : logObjects) {
        AuditLog l;
        l.id = std::stoi(getJsonValue(obj, "id"));
        l.action = getJsonValue(obj, "action");
        l.details = getJsonValue(obj, "details");
        l.timestamp = getJsonValue(obj, "timestamp");
        logs.push_back(l);
    }

    // Parse Company Profile
    std::string compStr = getJsonObjectString(content, "company");
    company.partners.clear();
    if (!compStr.empty()) {
        company.name = getJsonValue(compStr, "name");
        company.owner = getJsonValue(compStr, "owner");
        std::string cashStr = getJsonValue(compStr, "cash_available");
        company.cash_available = cashStr.empty() ? 0.0 : std::stod(cashStr);
        std::string debtStr = getJsonValue(compStr, "debts");
        company.debts = debtStr.empty() ? 0.0 : std::stod(debtStr);
        std::string otherStr = getJsonValue(compStr, "other_assets_value");
        company.other_assets_value = otherStr.empty() ? 0.0 : std::stod(otherStr);

        auto partnerObjs = getJsonArrayObjects(compStr, "partners");
        for (const auto& pObj : partnerObjs) {
            Partner p;
            p.name = getJsonValue(pObj, "name");
            std::string sharesStr = getJsonValue(pObj, "shares");
            p.shares = sharesStr.empty() ? 0.0 : std::stod(sharesStr);
            company.partners.push_back(p);
        }
    } else {
        // Fallback default values
        company.name = "StockFlow Solutions Ltd.";
        company.owner = "Radhika Sen";
        company.cash_available = 5000000.0;
        company.debts = 1200000.0;
        company.other_assets_value = 800000.0;
        company.partners.push_back({"Radhika Sen", 60.0});
        company.partners.push_back({"Amit Sharma", 25.0});
        company.partners.push_back({"Vikas Verma", 15.0});
    }
}

void saveDatabase(const std::vector<Employee>& employees,
                  const std::vector<InventoryItem>& inventory,
                  const std::vector<Assignment>& assignments,
                  const std::vector<AuditLog>& logs) {
    std::ofstream file(DB_FILE);
    if (!file.is_open()) return;

    file << "{\n";
    file << "    \"company\": " << company.toJson() << ",\n";
    
    file << "    \"employees\": [\n";
    for (size_t i = 0; i < employees.size(); ++i) {
        file << "        " << employees[i].toJson();
        if (i + 1 < employees.size()) file << ",";
        file << "\n";
    }
    file << "    ],\n";

    file << "    \"inventory\": [\n";
    for (size_t i = 0; i < inventory.size(); ++i) {
        file << "        " << inventory[i].toJson();
        if (i + 1 < inventory.size()) file << ",";
        file << "\n";
    }
    file << "    ],\n";

    file << "    \"assignments\": [\n";
    for (size_t i = 0; i < assignments.size(); ++i) {
        file << "        " << assignments[i].toJson();
        if (i + 1 < assignments.size()) file << ",";
        file << "\n";
    }
    file << "    ],\n";

    file << "    \"logs\": [\n";
    for (size_t i = 0; i < logs.size(); ++i) {
        file << "        " << logs[i].toJson();
        if (i + 1 < logs.size()) file << ",";
        file << "\n";
    }
    file << "    ]\n";

    file << "}\n";
    file.close();
}

void addLog(std::vector<AuditLog>& logs, const std::string& action, const std::string& details) {
    AuditLog log;
    log.id = 1;
    for (const auto& l : logs) {
        if (l.id >= log.id) log.id = l.id + 1;
    }
    log.action = action;
    log.details = details;
    log.timestamp = getIsoTimestamp();
    logs.push_back(log);
}

// ==========================================
// MAIN CONTROLLER
// ==========================================

int main(int argc, char* argv[]) {
    if (argc < 2) {
        std::cout << "{\"success\": false, \"error\": \"No command specified\"}\n";
        return 1;
    }

    std::vector<Employee> employees;
    std::vector<InventoryItem> inventory;
    std::vector<Assignment> assignments;
    std::vector<AuditLog> logs;

    loadDatabase(employees, inventory, assignments, logs);

    std::string cmd = argv[1];

    if (cmd == "get-dashboard-stats") {
        int totalEmployees = employees.size();
        int totalInventoryItems = 0;
        for (const auto& item : inventory) {
            totalInventoryItems += item.quantity;
        }
        int activeAssignments = assignments.size();
        int lowStockItems = 0;
        for (const auto& item : inventory) {
            if (item.quantity <= item.threshold) {
                lowStockItems++;
            }
        }
        double totalInventoryValue = 0.0;
        for (const auto& item : inventory) {
            totalInventoryValue += item.quantity * item.purchase_price;
        }

        std::cout << std::fixed << std::setprecision(2);
        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"stats\": {\n"
                  << "    \"totalEmployees\": " << totalEmployees << ",\n"
                  << "    \"totalInventoryItems\": " << totalInventoryItems << ",\n"
                  << "    \"activeAssignments\": " << activeAssignments << ",\n"
                  << "    \"lowStockItems\": " << lowStockItems << ",\n"
                  << "    \"totalInventoryValue\": " << totalInventoryValue << "\n"
                  << "  }\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "list-employees") {
        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"data\": [\n";

        for (size_t i = 0; i < employees.size(); ++i) {
            const auto& emp = employees[i];
            std::cout << "    {\n"
                      << "      \"id\": " << emp.id << ",\n"
                      << "      \"name\": \"" << escapeJsonString(emp.name) << "\",\n"
                      << "      \"email\": \"" << escapeJsonString(emp.email) << "\",\n"
                      << "      \"role\": \"" << escapeJsonString(emp.role) << "\",\n"
                      << "      \"department\": \"" << escapeJsonString(emp.department) << "\",\n"
                      << "      \"joined_date\": \"" << emp.joined_date << "\",\n"
                      << "      \"salary\": " << emp.salary << ",\n"
                      << "      \"contact_number\": \"" << escapeJsonString(emp.contact_number) << "\",\n"
                      << "      \"status\": \"" << escapeJsonString(emp.status) << "\",\n"
                      << "      \"assignedGear\": [\n";

            std::vector<std::string> gearJsons;
            for (const auto& a : assignments) {
                if (a.employee_id == emp.id) {
                    std::string item_name = "Unknown Item";
                    std::string sku = "";
                    for (const auto& item : inventory) {
                        if (item.id == a.inventory_id) {
                            item_name = item.name;
                            sku = item.sku;
                            break;
                        }
                    }
                    std::string gear = "        {\n"
                                       "          \"assignment_id\": " + std::to_string(a.id) + ",\n"
                                       "          \"item_id\": " + std::to_string(a.inventory_id) + ",\n"
                                       "          \"item_name\": \"" + escapeJsonString(item_name) + "\",\n"
                                       "          \"sku\": \"" + escapeJsonString(sku) + "\",\n"
                                       "          \"assigned_date\": \"" + a.assigned_date + "\",\n"
                                       "          \"notes\": \"" + escapeJsonString(a.notes) + "\"\n"
                                       "        }";
                    gearJsons.push_back(gear);
                }
            }

            for (size_t k = 0; k < gearJsons.size(); ++k) {
                std::cout << gearJsons[k];
                if (k + 1 < gearJsons.size()) std::cout << ",";
                std::cout << "\n";
            }

            std::cout << "      ]\n"
                      << "    }";
            if (i + 1 < employees.size()) std::cout << ",";
            std::cout << "\n";
        }

        std::cout << "  ]\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "add-employee") {
        if (argc < 6) {
            std::cout << "{\"success\": false, \"error\": \"Missing arguments for add-employee\"}\n";
            return 1;
        }
        std::string name = argv[2];
        std::string email = argv[3];
        std::string role = argv[4];
        std::string department = argv[5];
        double salary = (argc >= 7 && std::string(argv[6]) != "") ? std::stod(argv[6]) : 0.0;
        std::string contact_number = (argc >= 8) ? argv[7] : "";
        std::string status = (argc >= 9 && std::string(argv[8]) != "") ? argv[8] : "Active";

        // Validate uniqueness of email (case insensitive)
        std::string checkEmail = email;
        std::transform(checkEmail.begin(), checkEmail.end(), checkEmail.begin(), ::tolower);
        for (const auto& e : employees) {
            std::string existingEmail = e.email;
            std::transform(existingEmail.begin(), existingEmail.end(), existingEmail.begin(), ::tolower);
            if (existingEmail == checkEmail) {
                std::cout << "{\"success\": false, \"error\": \"Employee email already exists\"}\n";
                return 0;
            }
        }

        Employee emp;
        emp.id = 1;
        for (const auto& e : employees) {
            if (e.id >= emp.id) emp.id = e.id + 1;
        }
        emp.name = name;
        emp.email = email;
        emp.role = role;
        emp.department = department;
        emp.joined_date = getCurrentDate();
        emp.salary = salary;
        emp.contact_number = contact_number;
        emp.status = status;

        employees.push_back(emp);
        addLog(logs, "ADD_EMPLOYEE", "Added employee: " + name + " (" + role + ")");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Employee added successfully\",\n"
                  << "  \"data\": " << emp.toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "delete-employee") {
        if (argc < 3) {
            std::cout << "{\"success\": false, \"error\": \"Missing employee ID\"}\n";
            return 1;
        }
        int empId = std::stoi(argv[2]);
        auto it = std::find_if(employees.begin(), employees.end(), [empId](const Employee& e) {
            return e.id == empId;
        });

        if (it == employees.end()) {
            std::cout << "{\"success\": false, \"error\": \"Employee not found\"}\n";
            return 0;
        }

        // Verify no assignments
        int count = 0;
        for (const auto& a : assignments) {
            if (a.employee_id == empId) count++;
        }
        if (count > 0) {
            std::cout << "{\"success\": false, \"error\": \"Cannot delete employee. They currently have active inventory items assigned.\"}\n";
            return 0;
        }

        std::string empName = it->name;
        employees.erase(it);
        addLog(logs, "DELETE_EMPLOYEE", "Deleted employee: " + empName);
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Employee deleted successfully\"}\n";
        return 0;
    }
    else if (cmd == "list-inventory") {
        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"data\": [\n";

        for (size_t i = 0; i < inventory.size(); ++i) {
            const auto& item = inventory[i];
            std::cout << "    {\n"
                      << "      \"id\": " << item.id << ",\n"
                      << "      \"name\": \"" << escapeJsonString(item.name) << "\",\n"
                      << "      \"category\": \"" << escapeJsonString(item.category) << "\",\n"
                      << "      \"sku\": \"" << escapeJsonString(item.sku) << "\",\n"
                      << "      \"quantity\": " << item.quantity << ",\n"
                      << "      \"threshold\": " << item.threshold << ",\n"
                      << "      \"location\": \"" << escapeJsonString(item.location) << "\",\n"
                      << "      \"price\": " << item.price << ",\n"
                      << "      \"purchase_price\": " << item.purchase_price << ",\n"
                      << "      \"selling_price\": " << item.selling_price << ",\n"
                      << "      \"supplier_name\": \"" << escapeJsonString(item.supplier_name) << "\",\n"
                      << "      \"supplier_contact\": \"" << escapeJsonString(item.supplier_contact) << "\",\n"
                      << "      \"barcode\": \"" << escapeJsonString(item.barcode) << "\",\n"
                      << "      \"activeAssignments\": [\n";

            std::vector<std::string> assignJsons;
            for (const auto& a : assignments) {
                if (a.inventory_id == item.id) {
                    std::string empName = "Unknown Employee";
                    for (const auto& emp : employees) {
                        if (emp.id == a.employee_id) {
                            empName = emp.name;
                            break;
                        }
                    }
                    std::string aJson = "        {\n"
                                       "          \"assignment_id\": " + std::to_string(a.id) + ",\n"
                                       "          \"employee_id\": " + std::to_string(a.employee_id) + ",\n"
                                       "          \"employee_name\": \"" + escapeJsonString(empName) + "\",\n"
                                       "          \"assigned_date\": \"" + a.assigned_date + "\",\n"
                                       "          \"notes\": \"" + escapeJsonString(a.notes) + "\"\n"
                                       "        }";
                    assignJsons.push_back(aJson);
                }
            }

            for (size_t k = 0; k < assignJsons.size(); ++k) {
                std::cout << assignJsons[k];
                if (k + 1 < assignJsons.size()) std::cout << ",";
                std::cout << "\n";
            }

            std::cout << "      ]\n"
                      << "    }";
            if (i + 1 < inventory.size()) std::cout << ",";
            std::cout << "\n";
        }

        std::cout << "  ]\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "add-item") {
        if (argc < 8) {
            std::cout << "{\"success\": false, \"error\": \"Missing arguments for add-item\"}\n";
            return 1;
        }
        std::string name = argv[2];
        std::string category = argv[3];
        std::string sku = argv[4];
        int quantity = std::stoi(argv[5]);
        int threshold = std::stoi(argv[6]);
        std::string location = argv[7];
        double price = (argc >= 9 && std::string(argv[8]) != "") ? std::stod(argv[8]) : 0.0;
        double purchase_price = (argc >= 10 && std::string(argv[9]) != "") ? std::stod(argv[9]) : price * 0.7;
        double selling_price = (argc >= 11 && std::string(argv[10]) != "") ? std::stod(argv[10]) : price;
        std::string supplier_name = (argc >= 12) ? argv[11] : "";
        std::string supplier_contact = (argc >= 13) ? argv[12] : "";
        std::string barcode = (argc >= 14) ? argv[13] : "";

        if (quantity < 0 || threshold < 0) {
            std::cout << "{\"success\": false, \"error\": \"Quantity and threshold must be positive\"}\n";
            return 0;
        }

        // Validate unique SKU (case insensitive)
        std::string checkSku = sku;
        std::transform(checkSku.begin(), checkSku.end(), checkSku.begin(), ::tolower);
        for (const auto& i : inventory) {
            std::string existingSku = i.sku;
            std::transform(existingSku.begin(), existingSku.end(), existingSku.begin(), ::tolower);
            if (existingSku == checkSku) {
                std::cout << "{\"success\": false, \"error\": \"SKU already exists\"}\n";
                return 0;
            }
        }

        // Auto cash adjustment for initial stock purchase
        double cost = quantity * purchase_price;
        if (cost > 0.0) {
            if (company.cash_available < cost) {
                std::cout << "{\"success\": false, \"error\": \"Insufficient company cash available to purchase initial stock (Required: " << cost << ", Available: " << company.cash_available << ")\"}\n";
                return 0;
            }
            company.cash_available -= cost;
            addLog(logs, "FINANCE_TRANSACTION", "Deducted ₹" + std::to_string(cost) + " for initial stock purchase of " + name + " (" + std::to_string(quantity) + " units)");
        }

        InventoryItem item;
        item.id = 1;
        for (const auto& i : inventory) {
            if (i.id >= item.id) item.id = i.id + 1;
        }
        item.name = name;
        item.category = category;
        item.sku = sku;
        item.quantity = quantity;
        item.threshold = threshold;
        item.location = location;
        item.price = price;
        item.purchase_price = purchase_price;
        item.selling_price = selling_price;
        item.supplier_name = supplier_name;
        item.supplier_contact = supplier_contact;
        item.barcode = barcode;

        inventory.push_back(item);
        addLog(logs, "ADD_ITEM", "Added inventory item: " + name + " (SKU: " + sku + ") with Qty: " + std::to_string(quantity));
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Inventory item added successfully\",\n"
                  << "  \"data\": " << item.toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "delete-item") {
        if (argc < 3) {
            std::cout << "{\"success\": false, \"error\": \"Missing item ID\"}\n";
            return 1;
        }
        int itemId = std::stoi(argv[2]);
        auto it = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) {
            return i.id == itemId;
        });

        if (it == inventory.end()) {
            std::cout << "{\"success\": false, \"error\": \"Inventory item not found\"}\n";
            return 0;
        }

        // Verify no assignments
        int count = 0;
        for (const auto& a : assignments) {
            if (a.inventory_id == itemId) count++;
        }
        if (count > 0) {
            std::cout << "{\"success\": false, \"error\": \"Cannot delete item. It is currently assigned to one or more employees.\"}\n";
            return 0;
        }

        std::string itemName = it->name;
        inventory.erase(it);
        addLog(logs, "DELETE_ITEM", "Deleted inventory item: " + itemName);
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Inventory item deleted successfully\"}\n";
        return 0;
    }
    else if (cmd == "update-quantity") {
        if (argc < 4) {
            std::cout << "{\"success\": false, \"error\": \"Missing item ID or quantity change\"}\n";
            return 1;
        }
        int itemId = std::stoi(argv[2]);
        int change = std::stoi(argv[3]);

        auto it = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) {
            return i.id == itemId;
        });

        if (it == inventory.end()) {
            std::cout << "{\"success\": false, \"error\": \"Inventory item not found\"}\n";
            return 0;
        }

        int originalQty = it->quantity;
        int newQty = originalQty + change;
        if (newQty < 0) {
            std::cout << "{\"success\": false, \"error\": \"Quantity cannot fall below 0\"}\n";
            return 0;
        }

        // Auto cash adjustment for restock (purchase)
        if (change > 0) {
            double cost = change * it->purchase_price;
            if (company.cash_available < cost) {
                std::cout << "{\"success\": false, \"error\": \"Insufficient company cash available to purchase stock (Required: " << cost << ", Available: " << company.cash_available << ")\"}\n";
                return 0;
            }
            company.cash_available -= cost;
            addLog(logs, "FINANCE_TRANSACTION", "Deducted ₹" + std::to_string(cost) + " for restocking " + it->name + " (+" + std::to_string(change) + " units)");
        }

        it->quantity = newQty;
        std::string sign = (change >= 0) ? "+" : "";
        addLog(logs, "UPDATE_QUANTITY", "Adjusted quantity of " + it->name + " (SKU: " + it->sku + ") by " + sign + std::to_string(change) + ". New quantity: " + std::to_string(newQty));
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Quantity updated successfully\",\n"
                  << "  \"data\": " << it->toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "set-quantity") {
        if (argc < 4) {
            std::cout << "{\"success\": false, \"error\": \"Missing item ID or target quantity\"}\n";
            return 1;
        }
        int itemId = std::stoi(argv[2]);
        int targetQty = std::stoi(argv[3]);

        if (targetQty < 0) {
            std::cout << "{\"success\": false, \"error\": \"Quantity cannot be negative\"}\n";
            return 0;
        }

        auto it = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) {
            return i.id == itemId;
        });

        if (it == inventory.end()) {
            std::cout << "{\"success\": false, \"error\": \"Inventory item not found\"}\n";
            return 0;
        }

        int originalQty = it->quantity;

        // Auto cash adjustment for restock (purchase)
        if (targetQty > originalQty) {
            int diff = targetQty - originalQty;
            double cost = diff * it->purchase_price;
            if (company.cash_available < cost) {
                std::cout << "{\"success\": false, \"error\": \"Insufficient company cash available to purchase stock (Required: " << cost << ", Available: " << company.cash_available << ")\"}\n";
                return 0;
            }
            company.cash_available -= cost;
            addLog(logs, "FINANCE_TRANSACTION", "Deducted ₹" + std::to_string(cost) + " for restocking " + it->name + " (set qty from " + std::to_string(originalQty) + " to " + std::to_string(targetQty) + ")");
        }

        it->quantity = targetQty;
        addLog(logs, "SET_QUANTITY", "Set quantity of " + it->name + " (SKU: " + it->sku + ") from " + std::to_string(originalQty) + " to " + std::to_string(targetQty));
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Quantity set successfully\",\n"
                  << "  \"data\": " << it->toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "edit-item") {
        if (argc < 8) {
            std::cout << "{\"success\": false, \"error\": \"Missing arguments for edit-item\"}\n";
            return 1;
        }
        int itemId = std::stoi(argv[2]);
        std::string name = argv[3];
        std::string category = argv[4];
        std::string sku = argv[5];
        int threshold = std::stoi(argv[6]);
        std::string location = argv[7];

        auto it = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) {
            return i.id == itemId;
        });

        if (it == inventory.end()) {
            std::cout << "{\"success\": false, \"error\": \"Inventory item not found\"}\n";
            return 0;
        }

        double price = (argc >= 9 && std::string(argv[8]) != "") ? std::stod(argv[8]) : it->price;
        double purchase_price = (argc >= 10 && std::string(argv[9]) != "") ? std::stod(argv[9]) : it->purchase_price;
        double selling_price = (argc >= 11 && std::string(argv[10]) != "") ? std::stod(argv[10]) : it->selling_price;
        std::string supplier_name = (argc >= 12) ? argv[11] : it->supplier_name;
        std::string supplier_contact = (argc >= 13) ? argv[12] : it->supplier_contact;
        std::string barcode = (argc >= 14) ? argv[13] : it->barcode;

        if (threshold < 0) {
            std::cout << "{\"success\": false, \"error\": \"Threshold must be positive\"}\n";
            return 0;
        }

        // Validate unique SKU (excluding current item itself)
        std::string checkSku = sku;
        std::transform(checkSku.begin(), checkSku.end(), checkSku.begin(), ::tolower);
        for (const auto& i : inventory) {
            if (i.id != itemId) {
                std::string existingSku = i.sku;
                std::transform(existingSku.begin(), existingSku.end(), existingSku.begin(), ::tolower);
                if (existingSku == checkSku) {
                    std::cout << "{\"success\": false, \"error\": \"SKU already exists on another item\"}\n";
                    return 0;
                }
            }
        }

        std::string oldName = it->name;
        it->name = name;
        it->category = category;
        it->sku = sku;
        it->threshold = threshold;
        it->location = location;
        it->price = price;
        it->purchase_price = purchase_price;
        it->selling_price = selling_price;
        it->supplier_name = supplier_name;
        it->supplier_contact = supplier_contact;
        it->barcode = barcode;

        addLog(logs, "EDIT_ITEM", "Edited inventory item: " + oldName + " (New Name: " + name + ", SKU: " + sku + ")");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Inventory item edited successfully\",\n"
                  << "  \"data\": " << it->toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "assign-item") {
        if (argc < 4) {
            std::cout << "{\"success\": false, \"error\": \"Missing assignment parameters\"}\n";
            return 1;
        }
        int empId = std::stoi(argv[2]);
        int itemId = std::stoi(argv[3]);
        std::string notes = (argc >= 5) ? argv[4] : "";

        auto empIt = std::find_if(employees.begin(), employees.end(), [empId](const Employee& e) { return e.id == empId; });
        auto itemIt = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) { return i.id == itemId; });

        if (empIt == employees.end()) {
            std::cout << "{\"success\": false, \"error\": \"Employee not found\"}\n";
            return 0;
        }
        if (itemIt == inventory.end()) {
            std::cout << "{\"success\": false, \"error\": \"Inventory item not found\"}\n";
            return 0;
        }

        if (itemIt->quantity <= 0) {
            std::cout << "{\"success\": false, \"error\": \"Item is out of stock\"}\n";
            return 0;
        }

        // Decrement item stock
        itemIt->quantity -= 1;

        Assignment a;
        a.id = 1;
        for (const auto& ass : assignments) {
            if (ass.id >= a.id) a.id = ass.id + 1;
        }
        a.employee_id = empId;
        a.inventory_id = itemId;
        a.assigned_date = getCurrentDate();
        a.notes = notes;

        assignments.push_back(a);
        addLog(logs, "ASSIGN_ITEM", "Assigned " + itemIt->name + " to " + empIt->name + ". Remaining quantity: " + std::to_string(itemIt->quantity));
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Item assigned successfully\",\n"
                  << "  \"data\": " << a.toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "return-item") {
        if (argc < 3) {
            std::cout << "{\"success\": false, \"error\": \"Missing assignment ID\"}\n";
            return 1;
        }
        int assignId = std::stoi(argv[2]);
        auto it = std::find_if(assignments.begin(), assignments.end(), [assignId](const Assignment& a) {
            return a.id == assignId;
        });

        if (it == assignments.end()) {
            std::cout << "{\"success\": false, \"error\": \"Active assignment not found\"}\n";
            return 0;
        }

        int itemId = it->inventory_id;
        int empId = it->employee_id;

        auto itemIt = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) { return i.id == itemId; });
        auto empIt = std::find_if(employees.begin(), employees.end(), [empId](const Employee& e) { return e.id == empId; });

        std::string itemName = "item";
        if (itemIt != inventory.end()) {
            itemIt->quantity += 1;
            itemName = itemIt->name;
        }
        std::string empName = "employee";
        if (empIt != employees.end()) {
            empName = empIt->name;
        }

        assignments.erase(it);
        addLog(logs, "RETURN_ITEM", "Returned " + itemName + " from " + empName);
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Item returned successfully\"}\n";
        return 0;
    }
    else if (cmd == "list-logs") {
        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"data\": [\n";

        // Sort in reverse order (newest first)
        std::vector<AuditLog> sortedLogs = logs;
        std::sort(sortedLogs.begin(), sortedLogs.end(), [](const AuditLog& a, const AuditLog& b) {
            return b.id < a.id;
        });

        for (size_t i = 0; i < sortedLogs.size(); ++i) {
            std::cout << "    " << sortedLogs[i].toJson();
            if (i + 1 < sortedLogs.size()) std::cout << ",";
            std::cout << "\n";
        }

        std::cout << "  ]\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "load-demo") {
        employees.clear();
        inventory.clear();
        assignments.clear();
        logs.clear();

        // Add mock employees
        employees.push_back({1, "Arvind Kumar", "arvind@company.com", "Senior SDE", "Engineering", "2025-01-10", 120000.0, "9876543210", "Active"});
        employees.push_back({2, "Sneha Patel", "sneha@company.com", "UX Designer", "Product", "2025-03-15", 85000.0, "9876543211", "Active"});
        employees.push_back({3, "Rohan Sharma", "rohan@company.com", "QA Lead", "Engineering", "2025-06-01", 95000.0, "9876543212", "Active"});
        employees.push_back({4, "Priya Nair", "priya@company.com", "HR Manager", "Operations", "2025-09-20", 75000.0, "9876543213", "Active"});

        // Add mock inventory
        inventory.push_back({1, "MacBook Pro M3", "Laptops", "LAP-MBP-M3-01", 8, 2, "Cabinet A", 199999.0, 139999.0, 199999.0, "Apple India", "1800-165-2273", "1901901901"});
        inventory.push_back({2, "Dell UltraSharp 27\"", "Monitors", "MON-DEL-27-05", 5, 1, "Storage Room 2", 34999.0, 24499.0, 34999.0, "Dell Service", "1800-425-4026", "2902902902"});
        inventory.push_back({3, "Keychron K2 Keyboard", "Accessories", "ACC-KEY-K2-12", 0, 3, "Cabinet B", 8499.0, 5949.0, 8499.0, "Keychron IN", "contact@keychron.in", "3903903903"});
        inventory.push_back({4, "iPhone 15 Pro", "Mobile", "MOB-IPH-15-02", 3, 1, "Safe Vault", 134900.0, 94430.0, 134900.0, "Apple India", "1800-165-2273", "4904904904"});

        // Add mock assignments
        assignments.push_back({1, 1, 1, "2025-01-12", "Serial: C02DF123XYZ"});
        assignments.push_back({2, 2, 2, "2025-03-18", "Asset ID: MON-987"});

        // Decrement item quantities based on assignments
        inventory[0].quantity -= 1; // MacBook Pro
        inventory[1].quantity -= 1; // Dell Monitor

        // Reset Company Data to defaults
        company.name = "StockFlow Solutions Ltd.";
        company.owner = "Radhika Sen";
        company.cash_available = 5000000.0;
        company.debts = 1200000.0;
        company.other_assets_value = 800000.0;
        company.partners.clear();
        company.partners.push_back({"Radhika Sen", 60.0});
        company.partners.push_back({"Amit Sharma", 25.0});
        company.partners.push_back({"Vikas Verma", 15.0});

        // Add mock logs
        addLog(logs, "LOAD_DEMO", "Initialized database with professional mock demo dataset");
        addLog(logs, "ASSIGN_ITEM", "Assigned MacBook Pro M3 to Arvind Kumar");
        addLog(logs, "ASSIGN_ITEM", "Assigned Dell UltraSharp 27\" to Sneha Patel");

        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Demo data loaded successfully\"}\n";
        return 0;
    }
    else if (cmd == "edit-employee") {
        if (argc < 7) {
            std::cout << "{\"success\": false, \"error\": \"Missing arguments for edit-employee\"}\n";
            return 1;
        }
        int empId = std::stoi(argv[2]);
        std::string name = argv[3];
        std::string email = argv[4];
        std::string role = argv[5];
        std::string department = argv[6];

        auto it = std::find_if(employees.begin(), employees.end(), [empId](const Employee& e) {
            return e.id == empId;
        });

        if (it == employees.end()) {
            std::cout << "{\"success\": false, \"error\": \"Employee not found\"}\n";
            return 0;
        }

        double salary = (argc >= 8 && std::string(argv[7]) != "") ? std::stod(argv[7]) : it->salary;
        std::string contact_number = (argc >= 9) ? argv[8] : it->contact_number;
        std::string status = (argc >= 10 && std::string(argv[9]) != "") ? argv[9] : it->status;

        // Validate uniqueness of email (excluding current employee, case insensitive)
        std::string checkEmail = email;
        std::transform(checkEmail.begin(), checkEmail.end(), checkEmail.begin(), ::tolower);
        for (const auto& e : employees) {
            if (e.id != empId) {
                std::string existingEmail = e.email;
                std::transform(existingEmail.begin(), existingEmail.end(), existingEmail.begin(), ::tolower);
                if (existingEmail == checkEmail) {
                    std::cout << "{\"success\": false, \"error\": \"Employee email already exists on another employee\"}\n";
                    return 0;
                }
            }
        }

        std::string oldName = it->name;
        it->name = name;
        it->email = email;
        it->role = role;
        it->department = department;
        it->salary = salary;
        it->contact_number = contact_number;
        it->status = status;

        addLog(logs, "EDIT_EMPLOYEE", "Edited employee: " + oldName + " (New Name: " + name + ", Role: " + role + ")");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Employee updated successfully\",\n"
                  << "  \"data\": " << it->toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "list-assignments") {
        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"data\": [\n";

        for (size_t i = 0; i < assignments.size(); ++i) {
            const auto& a = assignments[i];
            std::string empName = "Unknown Employee";
            for (const auto& emp : employees) {
                if (emp.id == a.employee_id) {
                    empName = emp.name;
                    break;
                }
            }
            std::string itemName = "Unknown Item";
            std::string sku = "";
            for (const auto& item : inventory) {
                if (item.id == a.inventory_id) {
                    itemName = item.name;
                    sku = item.sku;
                    break;
                }
            }

            std::cout << "    {\n"
                      << "      \"assignment_id\": " << a.id << ",\n"
                      << "      \"employee_id\": " << a.employee_id << ",\n"
                      << "      \"employee_name\": \"" << escapeJsonString(empName) << "\",\n"
                      << "      \"inventory_id\": " << a.inventory_id << ",\n"
                      << "      \"item_name\": \"" << escapeJsonString(itemName) << "\",\n"
                      << "      \"sku\": \"" << escapeJsonString(sku) << "\",\n"
                      << "      \"assigned_date\": \"" << a.assigned_date << "\",\n"
                      << "      \"notes\": \"" << escapeJsonString(a.notes) << "\"\n"
                      << "    }";
            if (i + 1 < assignments.size()) std::cout << ",";
            std::cout << "\n";
        }

        std::cout << "  ]\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "record-sale") {
        if (argc < 5) {
            std::cout << "{\"success\": false, \"error\": \"Missing sale parameters\"}\n";
            return 1;
        }
        int empId = std::stoi(argv[2]);
        int itemId = std::stoi(argv[3]);
        int qty = std::stoi(argv[4]);

        auto empIt = std::find_if(employees.begin(), employees.end(), [empId](const Employee& e) { return e.id == empId; });
        auto itemIt = std::find_if(inventory.begin(), inventory.end(), [itemId](const InventoryItem& i) { return i.id == itemId; });

        if (empIt == employees.end()) {
            std::cout << "{\"success\": false, \"error\": \"Employee not found\"}\n";
            return 0;
        }
        if (itemIt == inventory.end()) {
            std::cout << "{\"success\": false, \"error\": \"Inventory item not found\"}\n";
            return 0;
        }

        if (itemIt->quantity < qty) {
            std::cout << "{\"success\": false, \"error\": \"Not enough stock available\"}\n";
            return 0;
        }

        // Decrement item stock
        itemIt->quantity -= qty;

        // Auto cash adjustment for sale (revenue)
        double revenue = qty * itemIt->selling_price;
        company.cash_available += revenue;

        // Add logs
        std::string saleDetails = std::to_string(empId) + "|" + empIt->name + "|" + std::to_string(itemId) + "|" + itemIt->name + "|" + itemIt->sku + "|" + std::to_string(qty);
        addLog(logs, "SALE", saleDetails);
        addLog(logs, "FINANCE_TRANSACTION", "Received ₹" + std::to_string(revenue) + " revenue from sale of " + itemIt->name + " (x" + std::to_string(qty) + ")");

        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Sale recorded successfully\",\n"
                  << "  \"data\": {\n"
                  << "    \"employee_id\": " << empId << ",\n"
                  << "    \"inventory_id\": " << itemId << ",\n"
                  << "    \"quantity\": " << qty << "\n"
                  << "  }\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "reset-db") {
        employees.clear();
        inventory.clear();
        assignments.clear();
        logs.clear();
        
        company.name = "StockFlow Solutions Ltd.";
        company.owner = "Radhika Sen";
        company.cash_available = 0.0;
        company.debts = 0.0;
        company.other_assets_value = 0.0;
        company.partners.clear();

        addLog(logs, "RESET_DATABASE", "Cleared all databases and logs");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Database reset successfully\"}\n";
        return 0;
    }
    else if (cmd == "get-company-data") {
        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"company\": " << company.toJson() << "\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "update-company-profile") {
        if (argc < 5) {
            std::cout << "{\"success\": false, \"error\": \"Missing profile arguments\"}\n";
            return 1;
        }
        company.name = argv[2];
        company.owner = argv[3];
        company.other_assets_value = std::stod(argv[4]);

        addLog(logs, "EDIT_COMPANY", "Updated company profile: " + company.name + " (Owner: " + company.owner + ")");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Company profile updated successfully\"}\n";
        return 0;
    }
    else if (cmd == "adjust-finances") {
        if (argc < 5) {
            std::cout << "{\"success\": false, \"error\": \"Missing finance arguments\"}\n";
            return 1;
        }
        double cashChange = std::stod(argv[2]);
        double debtChange = std::stod(argv[3]);
        std::string details = argv[4];

        company.cash_available += cashChange;
        company.debts += debtChange;

        addLog(logs, "FINANCE_TRANSACTION", details);
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Finances adjusted successfully\"}\n";
        return 0;
    }
    else if (cmd == "add-partner") {
        if (argc < 4) {
            std::cout << "{\"success\": false, \"error\": \"Missing partner arguments\"}\n";
            return 1;
        }
        std::string name = argv[2];
        double shares = std::stod(argv[3]);

        // Validate total shares
        double totalShares = 0;
        for (const auto& p : company.partners) {
            totalShares += p.shares;
        }
        if (totalShares + shares > 100.01) {
            std::cout << "{\"success\": false, \"error\": \"Total shares cannot exceed 100%\"}\n";
            return 0;
        }

        company.partners.push_back({name, shares});
        addLog(logs, "ADD_PARTNER", "Added share partner: " + name + " with " + std::to_string(shares) + "% shares");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Partner added successfully\"}\n";
        return 0;
    }
    else if (cmd == "edit-partner") {
        if (argc < 5) {
            std::cout << "{\"success\": false, \"error\": \"Missing edit partner arguments\"}\n";
            return 1;
        }
        int index = std::stoi(argv[2]);
        std::string name = argv[3];
        double shares = std::stod(argv[4]);

        if (index < 0 || index >= static_cast<int>(company.partners.size())) {
            std::cout << "{\"success\": false, \"error\": \"Invalid partner index\"}\n";
            return 0;
        }

        // Validate total shares excluding current partner
        double totalShares = 0;
        for (int i = 0; i < static_cast<int>(company.partners.size()); ++i) {
            if (i != index) {
                totalShares += company.partners[i].shares;
            }
        }
        if (totalShares + shares > 100.01) {
            std::cout << "{\"success\": false, \"error\": \"Total shares cannot exceed 100%\"}\n";
            return 0;
        }

        std::string oldName = company.partners[index].name;
        company.partners[index].name = name;
        company.partners[index].shares = shares;

        addLog(logs, "EDIT_PARTNER", "Updated partner: " + oldName + " -> " + name + " (" + std::to_string(shares) + "%)");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Partner updated successfully\"}\n";
        return 0;
    }
    else if (cmd == "delete-partner") {
        if (argc < 3) {
            std::cout << "{\"success\": false, \"error\": \"Missing partner index\"}\n";
            return 1;
        }
        int index = std::stoi(argv[2]);

        if (index < 0 || index >= static_cast<int>(company.partners.size())) {
            std::cout << "{\"success\": false, \"error\": \"Invalid partner index\"}\n";
            return 0;
        }

        std::string name = company.partners[index].name;
        company.partners.erase(company.partners.begin() + index);

        addLog(logs, "DELETE_PARTNER", "Removed share partner: " + name);
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\"success\": true, \"message\": \"Partner removed successfully\"}\n";
        return 0;
    }
    else if (cmd == "pay-salary") {
        if (argc < 3) {
            std::cout << "{\"success\": false, \"error\": \"Missing employee ID for pay-salary\"}\n";
            return 1;
        }
        int empId = std::stoi(argv[2]);
        int months = (argc >= 4) ? std::stoi(argv[3]) : 1;

        if (months <= 0) {
            std::cout << "{\"success\": false, \"error\": \"Months must be greater than 0\"}\n";
            return 0;
        }

        auto it = std::find_if(employees.begin(), employees.end(), [empId](const Employee& e) { return e.id == empId; });
        if (it == employees.end()) {
            std::cout << "{\"success\": false, \"error\": \"Employee not found\"}\n";
            return 0;
        }

        double amount = it->salary * months;
        if (company.cash_available < amount) {
            std::cout << "{\"success\": false, \"error\": \"Insufficient company cash available to pay salary (Required: " << amount << ", Available: " << company.cash_available << ")\"}\n";
            return 0;
        }

        company.cash_available -= amount;
        addLog(logs, "FINANCE_TRANSACTION", "Paid salary of ₹" + std::to_string(amount) + " to " + it->name + " for " + std::to_string(months) + " month(s)");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Salary paid successfully\",\n"
                  << "  \"data\": {\n"
                  << "    \"employee_id\": " << empId << ",\n"
                  << "    \"amount_paid\": " << amount << ",\n"
                  << "    \"months\": " << months << "\n"
                  << "  }\n"
                  << "}\n";
        return 0;
    }
    else if (cmd == "run-payroll") {
        int months = (argc >= 3) ? std::stoi(argv[2]) : 1;

        if (months <= 0) {
            std::cout << "{\"success\": false, \"error\": \"Months must be greater than 0\"}\n";
            return 0;
        }

        double totalPayroll = 0.0;
        int activeCount = 0;
        for (const auto& e : employees) {
            if (e.status == "Active") {
                totalPayroll += e.salary * months;
                activeCount++;
            }
        }

        if (activeCount == 0) {
            std::cout << "{\"success\": true, \"message\": \"No active employees found to process payroll\", \"data\": {\"amount_paid\": 0.0, \"active_count\": 0}}\n";
            return 0;
        }

        if (company.cash_available < totalPayroll) {
            std::cout << "{\"success\": false, \"error\": \"Insufficient company cash available to process payroll (Required: " << totalPayroll << ", Available: " << company.cash_available << ")\"}\n";
            return 0;
        }

        company.cash_available -= totalPayroll;
        addLog(logs, "FINANCE_TRANSACTION", "Processed payroll of ₹" + std::to_string(totalPayroll) + " for " + std::to_string(activeCount) + " active employee(s) for " + std::to_string(months) + " month(s)");
        saveDatabase(employees, inventory, assignments, logs);

        std::cout << "{\n"
                  << "  \"success\": true,\n"
                  << "  \"message\": \"Payroll processed successfully\",\n"
                  << "  \"data\": {\n"
                  << "    \"amount_paid\": " << totalPayroll << ",\n"
                  << "    \"active_count\": " << activeCount << ",\n"
                  << "    \"months\": " << months << "\n"
                  << "  }\n"
                  << "}\n";
        return 0;
    }
    else {
        std::cout << "{\"success\": false, \"error\": \"Unknown command: " << escapeJsonString(cmd) << "\"}\n";
        return 1;
    }
}
