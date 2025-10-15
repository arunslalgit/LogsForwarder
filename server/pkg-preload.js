// This file ensures certain modules are included in the pkg bundle
// It should be required at the top of index.js

// Pre-load modules for pkg
try {
  require('jsonpath-plus'); // Replaced jsonpath with jsonpath-plus for pkg compatibility
} catch (e) {
  // These will be bundled but might not load in dev
}

module.exports = {};
