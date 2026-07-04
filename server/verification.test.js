import test from 'node:test';
import assert from 'node:assert/strict';
import { updateVerification } from './verification.js';

test('updateVerification updates module verification fields', () => {
  const report = { modules: [{ id: 'orders', name: '订单', verificationStatus: 'ai_guess' }] };

  const updated = updateVerification(report, { kind: 'module', id: 'orders', verificationStatus: 'verified', verifiedBy: 'tester', verificationNote: '已看代码' });

  assert.equal(updated.modules[0].verificationStatus, 'verified');
  assert.equal(updated.modules[0].verifiedBy, 'tester');
  assert.equal(updated.modules[0].verificationNote, '已看代码');
  assert.ok(updated.modules[0].verifiedAt);
});

test('updateVerification updates nested data entity', () => {
  const report = { dataModel: { entities: [{ id: 'Order', name: 'Order', verificationStatus: 'pending' }] } };

  updateVerification(report, { kind: 'entity', id: 'Order', verificationStatus: 'rejected' });

  assert.equal(report.dataModel.entities[0].verificationStatus, 'rejected');
});

test('updateVerification rejects unsupported status', () => {
  assert.throws(() => updateVerification({ risks: [{ id: 'r1' }] }, { kind: 'risk', id: 'r1', verificationStatus: 'done' }), /Unsupported verification status/);
});
