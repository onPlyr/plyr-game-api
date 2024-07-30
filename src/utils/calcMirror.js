const { getContractAddress, encodePacked, keccak256 } = require('viem');
const { MIRROR_BYTECODE, plyrRegisterSC } = require('../config');

function calcMirrorAddress(primaryAddress) {
  const salt = keccak256(encodePacked(['address'], [primaryAddress]));
  const addr = getContractAddress({
    bytecode: MIRROR_BYTECODE,
    from: plyrRegisterSC,
    opcode: 'CREATE2',
    salt: salt,
  });
  return addr;
}

module.exports = { calcMirrorAddress };