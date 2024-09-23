const { zeroAddress, erc20Abi, parseUnits } = require('viem');
const { chain, plyrRouterSC, ROUTER_ABI } = require('../config');

async function createWithdrawTx({ from, to, amount, token, toChain }) {
  let hash;
  if (token === zeroAddress) {
    hash = await chain.writeContract({
      address: plyrRouterSC,
      abi: ROUTER_ABI,
      functionName: 'mirrorNativeTransfer',
      args: [
        from,
        to,
        parseUnits(amount.toString(), 18),
      ]
    });
  } else {
    let decimals = await chain.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'decimals',
      args:[]
    });
    console.log('mirrorTokenTransfer args:', { token, from, to, amount: parseUnits(amount.toString(), decimals) });

    hash = await chain.writeContract({
      address: plyrRouterSC,
      abi: ROUTER_ABI,
      functionName: 'mirrorTokenTransfer',
      args: [
        token,
        from,
        to,
        parseUnits(amount.toString(), decimals),
      ]
    });
  }

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('createWithdrawTx receipt:', receipt);
  return hash;
}

module.exports = { createWithdrawTx };