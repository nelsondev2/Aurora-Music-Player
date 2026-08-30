#!/usr/bin/env node
/* Falla (exit 1) si alguna clave de I18N no tiene los 8 idiomas. */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const LANGS = ['es', 'en', 'pt', 'zh', 'ja', 'fr', 'it', 'ru'];
const src = fs.readFileSync(path.join(__dirname, 'data.js'), 'utf8');
const sandbox = { window: {}, console };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const I18N = sandbox.window.I18N;
if (!I18N || typeof I18N !== 'object') {
  console.error('I18N no exportado por data.js');
  process.exit(1);
}

const keys = Object.keys(I18N);
const bad = [];
keys.forEach((k) => {
  const o = I18N[k];
  if (!o || typeof o !== 'object') {
    bad.push(k + ' (no es objeto)');
    return;
  }
  LANGS.forEach((l) => {
    if (typeof o[l] !== 'string' || !String(o[l]).length) bad.push(k + '.' + l);
  });
});

if (bad.length) {
  console.error('i18n incompleto (' + bad.length + '):');
  bad.slice(0, 40).forEach((l) => console.error('  - ' + l));
  if (bad.length > 40) console.error('  …');
  process.exit(1);
}
console.log('i18n ok · ' + keys.length + ' claves · 8 idiomas');
process.exit(0);
