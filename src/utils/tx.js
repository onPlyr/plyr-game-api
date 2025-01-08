const { chain } = require('../config');
const { encodeFunctionData, createPublicClient, http } = require('viem');

const backupRpc = 'https://subnets.avax.network/plyr/mainnet/rpc';

const publicClient = createPublicClient({
  chain: chain.chain,
  transport: http(backupRpc),
});

exports.sendAndWaitTx = async (contractObj) => {
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms));

  const executeTx = async () => {
    const data = encodeFunctionData({
      abi: contractObj.abi,
      functionName: contractObj.functionName,
      args: contractObj.args,
    });

    const getNonce = async (getTransactionCount) => {
      try {
        return await getTransactionCount({ address: chain.account.address });
      } catch (error) {
        console.error('Error getting nonce:', error);
        return null;
      }
    };

    const getNonceWithTimeout = async (getTransactionCount, timeout) => {
      return Promise.race([
        getNonce(getTransactionCount),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
      ]).catch(() => null);  // catch error and return null if timeout
    };

    let mainNonce, backupNonce;
    try {
      [mainNonce, backupNonce] = await Promise.all([
        getNonceWithTimeout(chain.getTransactionCount, 2000),
        getNonceWithTimeout(publicClient.getTransactionCount, 2000)
      ]);
    } catch (error) {
      console.error('Error getting nonces:', error);
    }

    if (mainNonce === null && backupNonce === null) {
      throw new Error('Failed to get nonce from both RPCs');
    }

    nonce = Math.max(mainNonce || 0, backupNonce || 0);
    console.log('Using nonce:', nonce);

    const txObj = {
      nonce,
      account: chain.account,
      to: contractObj.address,
      data,
      maxFeePerGas: 100e9,
      maxPriorityFeePerGas: 1e9,
      gas: 5_000_000,
      value: 0n,
    };

    const serializedTransaction = await chain.signTransaction(txObj);

    console.log('serializedTransaction', serializedTransaction);

    const sendTxWithBackupRpc = async () => {
      try {
        return await publicClient.sendRawTransaction({ serializedTransaction });
      } catch (error) {
        if (error.message.includes('already known') || error.message.includes('nonce too low')) {
          throw new Error('Transaction already known');
        }
        console.error('Error sending transaction with publicClient:', error);
        throw error;
      }
    };

    const sendTxWithMainRpc = async () => {
      try {
        return await chain.sendRawTransaction({serializedTransaction});
      } catch (error) {
        if (error.message.includes('already known') || error.message.includes('nonce too low')) {
          throw new Error('Transaction already known');
        }
        console.error('Error sending transaction with chain:', error);
        throw error;
      }
    };

    let hash;
    try {
      hash = await Promise.any([sendTxWithBackupRpc(), sendTxWithMainRpc()]);
    } catch (error) {
      throw new Error('Failed to send transaction through both methods');
    }

    console.log('broadcast tx hash:', hash);

    const waitForReceiptWithBackupRpc = async () => {
      try {
        return await publicClient.waitForTransactionReceipt({ hash, confirmations: 0 });
      } catch (error) {
        console.error('Error waiting for receipt with publicClient:', error);
        throw error;
      }
    };

    const waitForReceiptWithMainRpc = async () => {
      try {
        return await chain.waitForTransactionReceipt({ hash, confirmations: 0 });
      } catch (error) {
        console.error('Error waiting for receipt with chain:', error);
        throw error;
      }
    };

    let receipt;
    try {
      receipt = await Promise.any([waitForReceiptWithBackupRpc(), waitForReceiptWithMainRpc()]);
    } catch (error) {
      throw new Error('Failed to get transaction receipt through both methods');
    }

    return receipt;
  };

  try {
    return await Promise.race([
      executeTx(),
      timeout(40000) // 40 seconds timeout for the entire process
    ]);
  } catch (error) {
    if (error.message === 'Operation timed out') {
      throw new Error('Transaction process timed out after 80 seconds');
    }
    throw error;
  }
}
