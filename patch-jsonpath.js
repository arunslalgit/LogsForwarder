#!/usr/bin/env node

/**
 * Patch jsonpath's aesprim.js to work with pkg
 * DISABLED - node18.2 target fixes the jsonpath issue
 */

const fs = require('fs');
const path = require('path');

// This patching is disabled - node18.2 fixes the issue
console.log('✓ Patching skipped (using node18.2 target - no patch needed)');
process.exit(0);
