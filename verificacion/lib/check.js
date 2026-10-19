'use strict';
/* Mini runner sin dependencias: agrupa pruebas, informa pass/fail y
 * devuelve un código de salida distinto de cero si algo falla. */
let total = 0;
let passed = 0;
const failures = [];

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assert falló');
}

function eq(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const b = JSON.stringify(expected);
  if (a !== b) throw new Error((msg || 'valores distintos') + `\n    esperado: ${b}\n    recibido: ${a}`);
}

function includes(haystack, needle, msg) {
  if (!String(haystack).includes(needle)) {
    throw new Error((msg || 'no contiene') + `\n    buscado: ${needle}\n    en: ${String(haystack).slice(0, 240)}`);
  }
}

function notIncludes(haystack, needle, msg) {
  if (String(haystack).includes(needle)) {
    throw new Error((msg || 'no debería contener') + `\n    encontrado: ${needle}`);
  }
}

function match(value, regex, msg) {
  if (!regex.test(String(value))) {
    throw new Error((msg || 'no cumple el patrón') + `\n    patrón: ${regex}\n    valor: ${String(value).slice(0, 240)}`);
  }
}

async function test(name, fn) {
  total++;
  try {
    await fn();
    passed++;
    console.log('  \x1b[32m✓\x1b[0m ' + name);
  } catch (e) {
    failures.push({ name, error: e });
    console.log('  \x1b[31m✗\x1b[0m ' + name);
    console.log('      ' + String(e.message || e).replace(/\n/g, '\n      '));
  }
}

function section(title) {
  console.log('\n\x1b[1m' + title + '\x1b[0m');
}

function summary() {
  console.log('\n' + '─'.repeat(64));
  console.log(`Resultado: ${passed}/${total} pruebas OK, ${failures.length} fallo(s).`);
  if (failures.length) {
    console.log('\nFallos:');
    failures.forEach(f => console.log('  · ' + f.name + ' — ' + String(f.error.message || f.error).split('\n')[0]));
  }
  return failures.length === 0;
}

module.exports = { assert, eq, includes, notIncludes, match, test, section, summary, failures };
