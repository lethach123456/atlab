import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CHANGE_HISTORY_PAIRED_CHUNK,
  chunkForPairedHistoryWrites,
} from './historyBatch.ts';

test('CHANGE_HISTORY_PAIRED_CHUNK keeps entity+history under Firestore 500 write limit', () => {
  assert.equal(CHANGE_HISTORY_PAIRED_CHUNK, 200);
  assert.ok(CHANGE_HISTORY_PAIRED_CHUNK * 2 <= 500);
});

test('chunkForPairedHistoryWrites does not overlap and respects paired size', () => {
  const items = Array.from({ length: 450 }, (_, i) => i);
  const chunks = chunkForPairedHistoryWrites(items);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0].length, 200);
  assert.equal(chunks[1].length, 200);
  assert.equal(chunks[2].length, 50);
  assert.deepEqual(chunks.flat(), items);
  for (const chunk of chunks) {
    assert.ok(chunk.length * 2 <= 500);
  }
});

test('regression: helper must not overlap the way offset+200/slice+400 did', () => {
  const items = Array.from({ length: 350 }, (_, i) => `id_${i}`);
  const chunks = chunkForPairedHistoryWrites(items);
  const seen = new Set<string>();
  for (const chunk of chunks) {
    for (const id of chunk) {
      assert.equal(seen.has(id), false, `duplicate ${id}`);
      seen.add(id);
    }
  }
  assert.equal(seen.size, 350);
});

test('paired chunk stays under Firestore transaction get (500) and write (500) budgets', () => {
  const entityOps = CHANGE_HISTORY_PAIRED_CHUNK;
  const historyOps = CHANGE_HISTORY_PAIRED_CHUNK;
  const preReads = CHANGE_HISTORY_PAIRED_CHUNK; // one getDoc/transaction.get per entity
  assert.ok(preReads <= 500);
  assert.ok(entityOps + historyOps <= 500);
  assert.ok(preReads + entityOps + historyOps <= 500 + 500); // reads and writes are separate budgets
});
