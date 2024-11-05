const { chain, plyrRouterSC, ROUTER_ABI } = require('../config');
const { sendAndWaitTx } = require('../utils/tx');
const { logActivity } = require('../utils/activity');
const { getAddress } = require('viem');

async function createUser({ primaryAddress, plyrId, chainId = 62831}) {
  const receipt = await sendAndWaitTx({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'createUser',
    args: [
      primaryAddress,
      plyrId,
      chainId
    ]
  });

  const hash = receipt.transactionHash;

  await logActivity(plyrId, null, 'user', 'register', { ippClaimed: false, primaryAddress: getAddress(primaryAddress), hash, success: receipt.status });

  console.log('createUser receipt:', receipt);
  return hash;
}

async function createUserWithMirror({ primaryAddress, mirror, plyrId, chainId = 62831}) {
  const receipt = await sendAndWaitTx({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'createUserWithMirror',
    args: [
      primaryAddress,
      mirror,
      plyrId,
      chainId
    ]
  });

  const hash = receipt.transactionHash;

  await logActivity(plyrId, null, 'user', 'register', { ippClaimed: true, mirrorAddress: mirror, primaryAddress: getAddress(primaryAddress), hash, success: receipt.status });

  console.log('createUserWithMirror receipt:', receipt);
  return hash;
}

module.exports = { createUser, createUserWithMirror };