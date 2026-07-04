import test from 'node:test';
import assert from 'node:assert/strict';
import { extractSymbols } from './symbol-indexer.js';

function names(symbols) {
  return symbols.map((symbol) => `${symbol.kind}:${symbol.name}`);
}

test('extractSymbols recognizes default arrow exports and TypeScript enums', () => {
  const symbols = extractSymbols({
    path: 'src/model.ts',
    language: 'typescript',
    content: "export default () => true;\nexport enum OrderStatus {\n  Open = 'open'\n}\n"
  });

  assert.ok(names(symbols).includes('function:default'));
  assert.ok(names(symbols).includes('enum:OrderStatus'));
});

test('extractSymbols recognizes class field and object literal methods', () => {
  const symbols = extractSymbols({
    path: 'src/service.ts',
    language: 'typescript',
    content: "class Service {\n  handle = () => true;\n}\nexport const handlers = {\n  save: () => true,\n  load: function () { return true; }\n};\n"
  });

  assert.ok(names(symbols).includes('method:handle'));
  assert.ok(names(symbols).includes('method:save'));
  assert.ok(names(symbols).includes('method:load'));
});
