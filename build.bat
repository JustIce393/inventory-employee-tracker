@echo off
echo ==========================================
echo  StockFlow: Compiling C++ Database Engine
echo ==========================================
echo Checking for g++ compiler...
where g++ >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] g++ was not found in your PATH.
    echo Please install MinGW/GCC and add it to your system PATH variables.
    echo Read the README.md in this project directory for instructions.
    pause
    exit /b 1
)

echo Compiling engine.cpp to engine.exe...
g++ -std=c++17 -O3 engine.cpp -o engine.exe
if %errorlevel% neq 0 (
    echo [ERROR] Compilation failed.
    pause
    exit /b 1
)

echo [SUCCESS] engine.exe has been compiled successfully!
echo The Node.js server will now automatically run the compiled C++ engine.
pause
