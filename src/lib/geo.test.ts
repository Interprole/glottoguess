import { describe, expect, it } from 'vitest';
import { bearingDeg, compass, haversineKm } from './geo';

describe('geo', () => {
  it('computes great-circle distances', () => {
    // Moscow – Saint Petersburg ≈ 634 km
    expect(haversineKm(55.7558, 37.6173, 59.9343, 30.3351)).toBeGreaterThan(620);
    expect(haversineKm(55.7558, 37.6173, 59.9343, 30.3351)).toBeLessThan(650);
    expect(haversineKm(10, 10, 10, 10)).toBe(0);
  });
  it('computes bearings and compass points', () => {
    expect(compass(bearingDeg(0, 0, 10, 0))).toBe('N');
    expect(compass(bearingDeg(0, 0, 0, 10))).toBe('E');
    expect(compass(bearingDeg(0, 0, -10, -10))).toBe('SW');
    expect(compass(359)).toBe('N');
  });
});
