const { zeroAddress, erc20Abi, parseUnits } = require('viem');
const { chain, plyrRouterSC, ROUTER_ABI } = require('../config');
const { sendAndWaitTx } = require('../utils/tx');

async function createWithdrawTx({ from, to, amount, token, toChain }) {
  let hash;
  let receipt
  if (token === zeroAddress) {
    receipt = await sendAndWaitTx({
      address: plyrRouterSC,
      abi: ROUTER_ABI,
      functionName: 'mirrorNativeTransfer',
      args: [
        from,
        to,
        parseUnits(amount.toString(), 18),
      ]
    });
    hash = receipt.transactionHash;
  } else {
    let decimals = await chain.readContract({
      address: token,
      abi: erc20Abi,
      functionName: 'decimals',
      args:[]
    });
    console.log('mirrorTokenTransfer args:', { token, from, to, amount: parseUnits(amount.toString(), decimals) });

    receipt = await sendAndWaitTx({
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
    hash = receipt.transactionHash;
  }

  console.log('createWithdrawTx receipt:', receipt);
  return hash;
}

module.exports = { createWithdrawTx };