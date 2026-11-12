import test from 'node:test';
import assert from 'node:assert/strict';
import { haversineKm, isValidCoord } from '../utils/geo.js';
import { deliveryFeeFor, estimateMinutes } from '../utils/pricing.js';
import { normalizePhone, isValidPhone } from '../utils/phone.js';

test('haversine: same point is 0 km, 1 degree of latitude is about 111 km', () => {
  assert.equal(haversineKm(8.5, 8.5, 8.5, 8.5), 0);
  const d = haversineKm(8, 8.5, 9, 8.5);
  assert.ok(d > 110.5 && d < 111.9, `got ${d}`);
});

test('isValidCoord rejects NaN and out-of-range values', () => {
  assert.equal(isValidCoord(8.49, 8.51), true);
  assert.equal(isValidCoord(NaN, 8), false);
  assert.equal(isValidCoord(91, 8), false);
  assert.equal(isValidCoord(8, 181), false);
});

test('deliveryFeeFor = base + per-km x distance, rounded up to N50', () => {
  const rule = { baseFee: 300, perKm: 100 };
  assert.equal(deliveryFeeFor(0, rule), 300);
  assert.equal(deliveryFeeFor(1, rule), 400);
  assert.equal(deliveryFeeFor(2.3, rule), 550); // 530 -> 550
  assert.equal(deliveryFeeFor(5, rule), 800);
});

test('estimateMinutes adds prep, riding time and a 5 minute buffer', () => {
  assert.equal(estimateMinutes(0, 15), 20);
  assert.equal(estimateMinutes(5, 20), 40); // 20 + 15 + 5
});

test('phone numbers normalise to 234XXXXXXXXXX', () => {
  assert.equal(normalizePhone('08114077101'), '2348114077101');
  assert.equal(normalizePhone('+234 811 407 7101'), '2348114077101');
  assert.equal(normalizePhone('8114077101'), '2348114077101');
  assert.equal(isValidPhone('2348114077101'), true);
  assert.equal(isValidPhone('0811'), false);
});
