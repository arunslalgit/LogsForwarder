#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const TARGETS = {
  mac: 'node18-macos-arm64',  // Use arm64 for Apple Silicon (M1/M2/M3)
  linux: 'node18-linux-x64',
  windows: 'node18-win-x64'
};

const DIST_DIR = path.join(__dirname, 'dist');
const OUTPUT_NAMES = {
  mac: 'o11y-control-center-macos',
  linux: 'o11y-control-center-linux',
  windows: 'o11y-control-center-win.exe'
};

function log(message) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${message}`);
  console.log(`${'='.repeat(60)}\n`);
}

function exec(command, description) {
  console.log(`➜ ${description}...`);
  try {
    execSync(command, { stdio: 'inherit' });
    console.log(`✓ ${description} completed\n`);
  } catch (error) {
    console.error(`✗ ${description} failed`);
    throw error;
  }
}

function ensureDistDir() {
  if (!fs.existsSync(DIST_DIR)) {
    fs.mkdirSync(DIST_DIR, { recursive: true });
    console.log('✓ Created dist directory\n');
  }
}

function checkFrontendBuild() {
  const clientDistPath = path.join(__dirname, 'client', 'dist');
  if (!fs.existsSync(clientDistPath)) {
    throw new Error('Frontend build not found. Please run: cd client && npm run build');
  }
  console.log('✓ Frontend build verified\n');
}

function buildForPlatform(platform) {
  log(`Building for ${platform.toUpperCase()}`);

  const target = TARGETS[platform];
  const output = path.join(DIST_DIR, OUTPUT_NAMES[platform]);

  // Warning for cross-platform builds with native modules
  const currentPlatform = process.platform;
  if (platform === 'windows' && currentPlatform !== 'win32') {
    console.log('⚠️  WARNING: Building Windows executable on non-Windows system');
    console.log('   The better-sqlite3 native module may not work correctly.');
    console.log('   For production, build on Windows or use a Windows CI/CD pipeline.\n');
  } else if (platform === 'linux' && currentPlatform !== 'linux') {
    console.log('⚠️  WARNING: Building Linux executable on non-Linux system');
    console.log('   The better-sqlite3 native module may not work correctly.');
    console.log('   For production, build on Linux or use a Linux CI/CD pipeline.\n');
  } else if (platform === 'mac' && currentPlatform !== 'darwin') {
    console.log('⚠️  WARNING: Building macOS executable on non-macOS system');
    console.log('   The better-sqlite3 native module may not work correctly.');
    console.log('   For production, build on macOS or use a macOS CI/CD pipeline.\n');
  }

  // Build command with pkg (using npx to use local pkg)
  const pkgCmd = `npx pkg . --targets ${target} --output "${output}" --compress GZip`;

  exec(pkgCmd, `Building ${platform} executable`);

  return output;
}

function createReadme() {
  const readmePath = path.join(DIST_DIR, 'README.txt');
  const content = `O11y Control Center - Multi-Source Log Forwarder to InfluxDB
${'='.repeat(60)}

INSTALLATION & USAGE:
--------------------

1. Extract the executable to your desired location

2. On first run, the application will:
   - Create a 'data.db' SQLite database next to the executable
   - Create a 'logs' folder for application logs

3. Run the executable:

   macOS/Linux:
   $ ./o11y-control-center-macos
   or
   $ ./o11y-control-center-linux

   Windows:
   > o11y-control-center-win.exe

4. The application will start on port 3003 by default
   Access the web UI at: http://localhost:3003

5. To change the port, set the PORT environment variable:

   macOS/Linux:
   $ PORT=3004 ./o11y-control-center-macos

   Windows:
   > set PORT=3004 && o11y-control-center-win.exe

IMPORTANT NOTES:
---------------

- The database file (data.db) is created on first run
- Your data persists across updates - just replace the executable
- Do NOT delete data.db unless you want to reset all configurations
- Logs are stored in the 'logs' folder next to the executable

SYSTEM REQUIREMENTS:
-------------------

- No Node.js installation required (fully self-contained)
- Supported OS:
  * macOS 10.13 or later (x64)
  * Linux kernel 3.10+ (x64)
  * Windows 10 or later (x64)

VERSION: 3.0.0
BUILD DATE: ${new Date().toISOString().split('T')[0]}

For support or issues, contact your administrator.
`;

  fs.writeFileSync(readmePath, content);
  console.log('✓ Created README.txt in dist folder\n');
}

function verifyBuild(outputPath) {
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`✓ Build successful: ${path.basename(outputPath)} (${sizeMB} MB)\n`);
    return true;
  } else {
    console.error(`✗ Build failed: ${outputPath} not found\n`);
    return false;
  }
}

function patchDependencies() {
  console.log('➜ Patching dependencies for pkg compatibility...');
  try {
    execSync('node patch-jsonpath.js', { stdio: 'inherit' });
  } catch (error) {
    // Patch may already be applied, continue
  }
  console.log('');
}

// Main build process
async function main() {
  const args = process.argv.slice(2);
  const platforms = args.length > 0 ? args : ['mac']; // Default to mac only

  log('O11y Control Center - Build Script');

  console.log('Target platforms:', platforms.join(', '));
  console.log('');

  try {
    // Pre-build tasks
    patchDependencies();
    checkFrontendBuild();
    ensureDistDir();

    // Build for each platform
    const results = [];
    for (const platform of platforms) {
      if (!TARGETS[platform]) {
        console.error(`✗ Invalid platform: ${platform}`);
        console.error(`  Valid options: ${Object.keys(TARGETS).join(', ')}\n`);
        process.exit(1);
      }

      const outputPath = buildForPlatform(platform);
      const success = verifyBuild(outputPath);
      results.push({ platform, success, path: outputPath });
    }

    // Create README
    createReadme();

    // Summary
    log('BUILD SUMMARY');
    results.forEach(({ platform, success, path: outputPath }) => {
      const status = success ? '✓' : '✗';
      console.log(`${status} ${platform.padEnd(10)} - ${outputPath}`);
    });
    console.log('');

    const allSuccess = results.every(r => r.success);
    if (allSuccess) {
      log('ALL BUILDS COMPLETED SUCCESSFULLY');
      console.log('Next steps:');
      console.log('1. Test the executable: cd dist && ./o11y-control-center-macos');
      console.log('2. Check database creation on first run');
      console.log('3. Verify web UI loads correctly\n');
    } else {
      console.error('Some builds failed. Check the errors above.\n');
      process.exit(1);
    }

  } catch (error) {
    console.error('\n✗ Build failed:', error.message);
    process.exit(1);
  }
}

// Handle CLI
if (require.main === module) {
  main();
}

module.exports = { buildForPlatform, TARGETS, OUTPUT_NAMES };
