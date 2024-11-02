const { chain, plyrRouterSC, ROUTER_ABI } = require('../config');
const { sendAndWaitTx } = require('../utils/tx');

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

  console.log('createUserWithMirror receipt:', receipt);
  return hash;
}

module.exports = { createUser, createUserWithMirror };