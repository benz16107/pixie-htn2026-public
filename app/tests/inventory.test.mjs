import test from 'node:test';
import assert from 'node:assert/strict';
import { contentsFromInventory, inventoryTotal, parseInventory } from '../lib/inventory.ts';

const item = (value, id = 'item') => ({ id, name: 'Belonging', room: 'Bedroom', value });

test('totals currency in cents without floating-point drift', () => {
  assert.equal(inventoryTotal([item(0.1, 'a'), item(0.2, 'b')]), 0.3);
});

test('coverage starts at the minimum and rounds up without losing recorded value', () => {
  assert.equal(contentsFromInventory([]), null);
  assert.equal(contentsFromInventory([item(750)]), 10000);
  assert.equal(contentsFromInventory([item(10000.01)]), 15000);
  assert.equal(contentsFromInventory([item(100000)]), 100000);
  assert.equal(contentsFromInventory([item(100000, 'a'), item(0.01, 'b')]), null);
});

test('stored photos and room information round-trip', () => {
  const items = [{ ...item(1250), photo: 'file:///inventory/photo.jpg' }];
  assert.deepEqual(parseInventory(JSON.stringify(items)), items);
  assert.deepEqual(parseInventory(null), []);
});

test('corrupt or out-of-range storage does not silently become an empty inventory', () => {
  for (const raw of ['invalid', '{}', JSON.stringify([item(-1)]), JSON.stringify([item(100001)]), JSON.stringify([{...item(20), room:'Unknown'}])]) {
    assert.throws(() => parseInventory(raw));
  }
});
