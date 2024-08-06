const { calcMirrorAddress } = require('../../src/utils/calcMirror');

describe('calcMirrorAddress', () => {
  test('calcMirrorAddress', () => {
    const primary = '0xb0425C2D2C31A0cf492D92aFB64577671D50E3b5';
    const addr = calcMirrorAddress(primary);
    expect(addr).toBe('0x778712caD13057F5b5e13beC8a058428a05eed6B');
  });
});
