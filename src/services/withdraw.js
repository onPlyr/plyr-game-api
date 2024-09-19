const { chain, plyrRouterSC, ROUTER_ABI } = require('../config');

async function createWithdrawTx({ from, to, amount, token, toChain }) {
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
  return hash;
}

module.exports = { createWithdrawTx };