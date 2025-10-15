// Patched version of jsonpath's aesprim.js for pkg compatibility
// This file works around the require.resolve() issue with pkg

var fs = require('fs');
var Module = require('module');
var path = require('path');

// Handle pkg bundled environment
var IS_PKG = typeof process.pkg !== 'undefined';
var file;

if (IS_PKG) {
  // When bundled, look for esprima in the snapshot
  try {
    file = path.join(__dirname, '../node_modules/esprima/esprima.js');
  } catch (e) {
    // Fallback to regular require.resolve
    file = require.resolve('esprima');
  }
} else {
  file = require.resolve('esprima');
}

var source = fs.readFileSync(file, 'utf-8');

// inject '@' as a valid identifier!
source = source.replace(/(function isIdentifierStart\(ch\) {\s+return)/m, '$1 (ch == 0x40) || ');

//If run as script just output patched file
if (require.main === module)
  console.log(source);
else {
  var _module = new Module('aesprim');
  _module._compile(source, __filename);

  module.exports = _module.exports;
}
