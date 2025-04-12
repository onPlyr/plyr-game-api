const { chain, account, CHAIN_CONFIG } = require('../config');
const { encodeFunctionData, createPublicClient, http, createWalletClient } = require('viem');

const backupRpc = 'https://subnets.avax.network/plyr/testnet/rpc';

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



exports.sendMultiChainTx = async ({chainTag, address, abi, functionName, args}) => {
  // Check if chainTag is supported
  if (!CHAIN_CONFIG[chainTag]) {
    throw new Error(`Chain Tag ${chainTag} is not supported`);
  }

  const chainConfig = CHAIN_CONFIG[chainTag];
  console.log(`Sending transaction on ${chainConfig.name} (Chain Tag: ${chainTag}, Chain ID: ${chainConfig.chainId}, RPC URLs: ${chainConfig.rpcUrls}), functionName: ${functionName}, args: ${args}`);

  // Create multiple public clients for the chain using all available RPCs
  const publicClients = chainConfig.rpcUrls.map(rpcUrl => {
    return createPublicClient({
      chain: chainConfig.chain,
      transport: http(rpcUrl),
    });
  });

  // Define timeout function
  const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('Operation timed out')), ms));

  // Main execution function
  const executeTx = async () => {
    // Encode function data
    const data = encodeFunctionData({
      abi,
      functionName,
      args,
    });

    // Get nonce with timeout
    const getNonceWithTimeout = async (client, timeout) => {
      try {
        return await Promise.race([
          client.getTransactionCount({ address: account.address }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeout))
        ]);
      } catch (error) {
        console.error('Error getting nonce:', error);
        return null;
      }
    };

    // Get nonces from all RPCs concurrently
    const nonces = await Promise.all(
      publicClients.map(client => getNonceWithTimeout(client, 20000))
    );

    // Filter out null nonces and get the maximum
    const validNonces = nonces.filter(nonce => nonce !== null);
    if (validNonces.length === 0) {
      throw new Error(`Failed to get nonce for chain ${chainTag}`);
    }
    
    const nonce = Math.max(...validNonces);
    console.log(`Using nonce: ${nonce}`);

    // Create wallet client for the chain
    const walletClient = createWalletClient({
      chain: chainConfig.chain,
      account,
      transport: http(chainConfig.rpcUrls[0]), // Use first RPC for initial connection
    });

    // Prepare transaction object
    const txObj = {
      account,
      to: address,
      data,
      nonce,
      maxFeePerGas: chainConfig.maxFeePerGas,
      maxPriorityFeePerGas: chainConfig.maxPriorityFeePerGas,
      gas: 2_000_000n, // Using BigInt for gas
      value: 0n,
    };

    // Sign transaction
    const serializedTransaction = await walletClient.signTransaction(txObj);
    console.log('Transaction signed');

    // Function to send transaction with a specific RPC
    const sendTxWithRpc = async (client, index) => {
      try {
        const hash = await client.sendRawTransaction({ serializedTransaction });
        console.log(`Transaction sent successfully with RPC ${index + 1}`);
        return hash;
      } catch (error) {
        if (error.message.includes('already known') || error.message.includes('nonce too low')) {
          throw new Error('Transaction already known');
        }
        console.error(`Error sending transaction with RPC ${index + 1}:`, error);
        throw error;
      }
    };

    // Send transaction with all RPCs concurrently
    let hash;
    try {
      hash = await Promise.any(
        publicClients.map((client, index) => sendTxWithRpc(client, index))
      );
    } catch (error) {
      throw new Error(`Failed to send transaction on chain ${chainTag} through any RPC`);
    }

    console.log(`Transaction broadcast with hash: ${hash}`);

    // Function to wait for receipt with a specific RPC
    const waitForReceiptWithRpc = async (client, index) => {
      try {
        const receipt = await client.waitForTransactionReceipt({ hash, confirmations: 0 });
        console.log(`Got receipt from RPC ${index + 1}`);
        return receipt;
      } catch (error) {
        console.error(`Error waiting for receipt with RPC ${index + 1}:`, error);
        throw error;
      }
    };

    // Wait for receipt with all RPCs concurrently
    let receipt;
    try {
      receipt = await Promise.any(
        publicClients.map((client, index) => waitForReceiptWithRpc(client, index))
      );
    } catch (error) {
      throw new Error(`Failed to get transaction receipt on chain ${chainTag} through any RPC`);
    }

    return receipt;
  };

  // Execute with timeout
  try {
    return await Promise.race([
      executeTx(),
      timeout(40000) // 40 seconds timeout for the entire process
    ]);
  } catch (error) {
    if (error.message === 'Operation timed out') {
      throw new Error(`Transaction process on chain ${chainTag} timed out after 40 seconds`);
    }
    throw error;
  }
}