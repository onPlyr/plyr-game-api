const { chain, plyrRouterSC, ROUTER_ABI } = require('../config');

async function createUser({ primaryAddress, plyrId, chainId = 62831}) {
  const hash = await chain.writeContract({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'createUser',
    args: [
      primaryAddress,
      plyrId,
      chainId
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('createUser receipt:', receipt);
}

module.exports = { createUser };