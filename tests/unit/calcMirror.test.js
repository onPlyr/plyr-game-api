const { calcMirrorAddress } = require('../../src/utils/calcMirror');

describe('calcMirrorAddress', () => {
  test('calcMirrorAddress', () => {
    const primary = '0xb0425C2D2C31A0cf492D92aFB64577671D50E3b5';
    const addr = calcMirrorAddress(primary);
    expect(addr).toBe('0x110a22Abe314536B272b77a5483D9515D8E6Cdd8');
  });
});
