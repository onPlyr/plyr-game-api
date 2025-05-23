const { GAME_NFT_FACTORY_ABI, TELEPORTER_MESSENGER_ABI, CHAIN_CONFIG } = require('../config');
const { sendMultiChainTx } = require('../utils/tx');
const { logActivity } = require('../utils/activity');
const { decodeEventLog, erc721Abi, createPublicClient, http } = require('viem');
const GameNft = require('../models/gameNft');
const { gameNftConfig} = require('../config');
const axios = require('axios');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function getIcmMessageFromAPI(messageId) {
  console.log('ICM HEADER:', process.env.ICM_HEADER);

  let ret = await axios.get('https://glacier-api.avax.network/v1/icm/messages/'+messageId, {
    headers: {
      'x-glacier-api-key': process.env.ICM_HEADER
    }
  });

  ret = ret.data;
  return ret;
}

async function getIcmReceipt(receipt, chainTag) {
  let _messageId;

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: TELEPORTER_MESSENGER_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'SendCrossChainMessage') {
        const { messageID } = decodedLog.args;
        _messageId = messageID;
        break;
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  if (!_messageId) {
    throw new Error("Can not found messageID");
  }

  const chainConfig = CHAIN_CONFIG[chainTag];
  const client = await createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrls[0]),
  });
  

  let times = 0;
  while(times++ < 30) {
    await sleep(2000);
    let ret = await getIcmMessageFromAPI(_messageId);
    console.log('get icm message', ret);
    if (ret.destinationTransaction && ret.destinationTransaction.txHash && ret.messageExecuted) {
      receipt = await client.getTransactionReceipt({
        hash: ret.destinationTransaction.txHash,
      });
      return receipt;
    }
  }

  throw new Error('ICM message is failed');
}

async function create({gameId, name, symbol, isSbt, isBadge, description, image, chainTag}) {
  let result = {};
  let isRemote = ["fuji", "avalanche"].includes(chainTag);

  console.log('create game nft', {gameId, name, symbol, isSbt, isBadge, description, image, chainTag});

  let receipt;
  if (isRemote) {
    const _chainTag = chainTag === 'fuji' ? 'plyrTestnet' : 'avalanche';

    receipt = await sendMultiChainTx({
      chainTag: _chainTag,
      address: gameNftConfig[_chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'createNftRemote',
      args: [
        gameId,
        name,
        symbol,
        isSbt === true || isSbt === 'true' || isBadge === true || isBadge === 'true'
      ]
    });

    receipt = await getIcmReceipt(receipt, chainTag);
  } else {
    receipt = await sendMultiChainTx({
      chainTag,
      address: gameNftConfig[chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'createNft',
      args: [
        gameId,
        name,
        symbol,
        isSbt === true || isSbt === 'true' || isBadge === true || isBadge === 'true'
      ]
    });
  }


  const hash = receipt.transactionHash;

  console.log('createGameNft receipt:', receipt);
  if (receipt.status !== 'success') {
    await logActivity(gameId, gameId, 'gameNft', 'create', { gameId, hash, success: receipt.status });
    throw new Error('Transaction Receipt Failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: GAME_NFT_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'NftCreated') {
        const { nft, gameId } = decodedLog.args;
        await GameNft.updateOne({ gameId, nft, chainTag }, { $set: { gameId, nft, chainTag, name, symbol, image, isSbt, isBadge, description } }, { upsert: true });
        result = { gameId, nft: isBadge ? undefined : nft, badge: isBadge ? nft : undefined, name, symbol, image, hash };
        await logActivity(gameId, gameId, 'gameNft', 'create', { gameId, nft: isBadge ? undefined : nft, badge: isBadge ? nft : undefined, chainTag, name, symbol, image, isSbt, isBadge, description, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function mint({chainTag, gameId, nfts, addresses, tokenUris}) {
  let result = [];
  let isRemote = ["fuji", "avalanche"].includes(chainTag);

  let receipt;
  if (isRemote) {
    const _chainTag = chainTag === 'fuji' ? 'plyrTestnet' : 'avalanche';

    receipt = await sendMultiChainTx({
      chainTag: _chainTag,
      address: gameNftConfig[_chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'batchMintRemote',
      args: [
        nfts,
        addresses,
        tokenUris
      ]
    });

    receipt = await getIcmReceipt(receipt, chainTag);
  } else {
    receipt = await sendMultiChainTx({
      chainTag,
      address: gameNftConfig[chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'batchMint',
      args: [
        nfts,
        addresses,
        tokenUris
      ]
    });
  }

  const hash = receipt.transactionHash;
  console.log('mintGameNft receipt:', receipt);

  for (let i=0; i<addresses.length; i++) {
    let address = addresses[i];
    let nft = nfts[i];
    await logActivity(address, gameId, 'gameNft', 'mint', { gameId, address, nft, chainTag, hash, success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction Receipt Failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: erc721Abi,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'Transfer') {
        const { from, to, tokenId } = decodedLog.args;
        result.push({ gameId, from, to, tokenId: tokenId.toString(), hash });
        await logActivity(gameId, gameId, 'gameNft', 'mint', { gameId, from, to, tokenId: tokenId.toString(), chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function burn({chainTag, gameId, nfts, tokenIds}) {
  let result = [];
  let receipt;
  let isRemote = ["fuji", "avalanche"].includes(chainTag);

  if (isRemote) {
    const _chainTag = chainTag === 'fuji' ? 'plyrTestnet' : 'avalanche';
    receipt = await sendMultiChainTx({
      chainTag: _chainTag,
      address: gameNftConfig[_chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'batchBurnRemote',
      args: [
        nfts,
        tokenIds
      ]
    });

    receipt = await getIcmReceipt(receipt, chainTag);
  } else {
    receipt = await sendMultiChainTx({
      chainTag,
      address: gameNftConfig[chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'batchBurn',
      args: [
        nfts,
        tokenIds
      ]
    });
  }

  const hash = receipt.transactionHash;
  console.log('burnGameNft receipt:', receipt);
  for (let i=0; i<tokenIds.length; i++) {
    let tokenId = tokenIds[i];
    let nft = nfts[i];
    await logActivity(tokenId, gameId, 'gameNft', 'burn', { gameId, tokenId, nft, chainTag, hash, success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction Receipt Failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: erc721Abi,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'Transfer') {
        const { from, to, tokenId } = decodedLog.args;
        result.push({ gameId, from, to, tokenId: tokenId.toString(), hash });
        await logActivity(gameId, gameId, 'gameNft', 'burn', { gameId, from, to, tokenId: tokenId.toString(), chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }
  return {hash, result};
}

async function transfer({chainTag, gameId, nfts, fromAddresses, toAddresses, tokenIds}) {
  let result = [];

  let isRemote = ["fuji", "avalanche"].includes(chainTag);

  let receipt;
  if (isRemote) {
    const _chainTag = chainTag === 'fuji' ? 'plyrTestnet' : 'avalanche';
    receipt = await sendMultiChainTx({
      chainTag: _chainTag,
      address: gameNftConfig[_chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'batchGameTransferRemote',
      args: [
        nfts,
        fromAddresses,
        toAddresses,
        tokenIds
      ]
    });

    receipt = await getIcmReceipt(receipt, chainTag);
  } else {
    receipt = await sendMultiChainTx({
      chainTag,
      address: gameNftConfig[chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'batchGameTransfer',
      args: [
        nfts,
        fromAddresses,
        toAddresses,
        tokenIds
      ]
    });
  }

  const hash = receipt.transactionHash;
  console.log('transferGameNft receipt:', receipt);
  for (let i=0; i<fromAddresses.length; i++) {
    let fromAddress = fromAddresses[i];
    let toAddress = toAddresses[i];
    let nft = nfts[i];
    await logActivity(fromAddress, gameId, 'gameNft', 'transfer', { gameId, fromAddress, toAddress, nft, chainTag, hash, success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction Receipt Failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: erc721Abi,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'Transfer') {
        const { from, to, tokenId } = decodedLog.args;
        result.push({ gameId, from, to, tokenId: tokenId.toString(), hash });
        await logActivity(gameId, gameId, 'gameNft', 'transfer', { gameId, from, to, tokenId: tokenId.toString(), chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }
  return {hash, result};
}

module.exports = { create, mint, burn, transfer };