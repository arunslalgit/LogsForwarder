# Build Guide for O11y Control Center

## Overview

This application can be built as a single, self-contained executable for macOS, Linux, and Windows. The executable includes:
- Frontend (React application)
- Backend (Express server)
- SQLite database engine
- All dependencies

## Important: Native Module Considerations

**⚠️ CRITICAL:** This application uses `better-sqlite3`, which includes native binary modules that are **platform-specific**.

### Build Rules:
- **Mac binary** → Must be built on macOS (Intel or Apple Silicon)
- **Linux binary** → Must be built on Linux
- **Windows .exe** → Must be built on Windows

**Cross-platform builds will compile successfully but WILL FAIL at runtime** due to incorrect native module binaries.

## Building on macOS (Current System)

### 1. Build Mac Binary (Apple Silicon)
```bash
npm run build:mac
# or
npm run build
```

This creates: `dist/o11y-control-center-macos` (~55 MB)

### 2. Build All Platforms (NOT RECOMMENDED from Mac)
```bash
npm run build:all
```

**Note:** This will create executables for all platforms, but **Linux and Windows binaries will not work** because they'll contain the macOS version of `better-sqlite3.node`.

## Building on Windows

### Prerequisites
1. Install Node.js 18+ for Windows
2. Install Visual Studio Build Tools (for native module compilation)
3. Clone the repository
4. Run: `npm install` (this installs Windows-specific native modules)

### Build Commands
```bash
# Build Windows .exe only
npm run build:windows

# Build all platforms (only Windows will work correctly)
npm run build:all
```

Output: `dist/o11y-control-center-win.exe`

## Building on Linux

### Prerequisites
1. Install Node.js 18+
2. Install build essentials: `sudo apt-get install build-essential python3`
3. Clone the repository
4. Run: `npm install`

### Build Commands
```bash
# Build Linux binary only
npm run build:linux

# Build all platforms (only Linux will work correctly)
npm run build:all
```

Output: `dist/o11y-control-center-linux`

## Production Build Strategy

### Option 1: CI/CD Pipeline (Recommended)
Use GitHub Actions, GitLab CI, or similar to build on each platform:

```yaml
# Example GitHub Actions workflow
jobs:
  build-mac:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build:mac

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build:windows

  build-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm install
      - run: npm run build:linux
```

### Option 2: Build on Target Machines
1. Set up a Mac, Windows PC, and Linux machine
2. Clone the repo on each
3. Run `npm install` on each (installs correct native modules)
4. Run `npm run build:mac` / `build:windows` / `build:linux` respectively

### Option 3: Virtual Machines
Use VMs to build for platforms you don't have:
- Parallels/VMware for Windows on Mac
- Docker for Linux builds
- Cloud VMs (AWS, Azure, GCP)

## Build Output

After building, the `dist/` folder contains:
```
dist/
├── o11y-control-center-macos       # macOS executable (arm64)
├── o11y-control-center-linux       # Linux executable (x64)
├── o11y-control-center-win.exe     # Windows executable (x64)
└── README.txt                      # User instructions
```

## Testing the Build

### On macOS:
```bash
cd dist
chmod +x o11y-control-center-macos
PORT=3004 ./o11y-control-center-macos
```

### On Windows:
```cmd
cd dist
set PORT=3004
o11y-control-center-win.exe
```

### On Linux:
```bash
cd dist
chmod +x o11y-control-center-linux
PORT=3004 ./o11y-control-center-linux
```

Open browser: `http://localhost:3004`

## Subpath Deployment

The application supports running under a URL subpath:

```bash
# Run under /forwarder
BASE_PATH=/forwarder PORT=3004 ./o11y-control-center-macos

# Access at: http://localhost:3004/forwarder
```

The same build works with any BASE_PATH - no rebuild needed!

## Runtime Behavior

When the executable runs for the first time:
1. Creates `data.db` SQLite database next to the executable
2. Creates `logs/` folder for application logs
3. Starts web server on specified port (default: 3003)

**Database persists across updates** - just replace the executable.

## Troubleshooting

### Error: "Cannot find module 'better_sqlite3.node'"
**Cause:** You're trying to run an executable built on a different platform.
**Solution:** Build on the target platform or use CI/CD.

### Build succeeds but crashes on startup
**Cause:** Native module mismatch
**Solution:** Ensure you built on the correct platform.

### Executable is huge (>100MB)
**Normal:** The executable contains Node.js runtime, all dependencies, and frontend assets. Expected size: 50-60 MB.

## Architecture Notes

- **Target:** Node.js 18
- **Package Tool:** pkg 5.8.1
- **Compression:** GZip
- **macOS:** arm64 (Apple Silicon) - change to x64 for Intel Macs
- **Linux:** x64
- **Windows:** x64

To build for Intel Mac instead of Apple Silicon, edit `build.js`:
```javascript
const TARGETS = {
  mac: 'node18-macos-x64',  // Change from arm64 to x64
  // ...
};
```

## Support

For issues or questions about building, check:
1. Build warnings/errors in console
2. Native module compatibility
3. Platform-specific build requirements
