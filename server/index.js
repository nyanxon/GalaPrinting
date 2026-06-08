// Entry point wrapper for Hostinger deployment.
// Hostinger resolves the entry file relative to the application root (server/).
// This file simply re-exports to the real entry point.
// "type": "module" in package.json makes this an ES module automatically.
import './src/server.js';
