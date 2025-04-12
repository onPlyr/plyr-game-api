const { GAME_NFT_FACTORY_ABI } = require('../config');
const { sendMultiChainTx } = require('../utils/tx');
const { logActivity } = require('../utils/activity');
const { decodeEventLog, erc721Abi } = require('viem');
const GameNft = require('../models/gameNft');
const { gameNftConfig} = require('../config');

async function create({gameId, name, symbol, image, chainTag}) {
  let result = {};
  const receipt = await sendMultiChainTx({
    chainTag,
    address: gameNftConfig[chainTag].gameNftFactory,
    abi: GAME_NFT_FACTORY_ABI,
    functionName: 'createNft',
    args: [
      gameId,
      name,
      symbol
    ]
  });

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
        await GameNft.updateOne({ gameId, nft, chainTag }, { $set: { gameId, nft, chainTag, name, symbol, image } }, { upsert: true });
        result = { gameId, nft, name, symbol, image, hash };
        await logActivity(gameId, gameId, 'gameNft', 'create', { gameId, nft, chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function mint({chainTag, gameId, nfts, addresses, tokenUris}) {
  let result = {};
  const receipt = await sendMultiChainTx({
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
        result = { gameId, from, to, tokenId: tokenId.toString(), hash };
        await logActivity(gameId, gameId, 'gameNft', 'mint', { gameId, from, to, tokenId: tokenId.toString(), chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function burn({chainTag, gameId, nfts, tokenIds}) {
  let result = {};
  const receipt = await sendMultiChainTx({
    chainTag,
    address: gameNftConfig[chainTag].gameNftFactory,
    abi: GAME_NFT_FACTORY_ABI,
    functionName: 'batchBurn',
    args: [
      nfts,
      tokenIds
    ]
  });

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
        result = { gameId, from, to, tokenId: tokenId.toString(), hash };
        await logActivity(gameId, gameId, 'gameNft', 'burn', { gameId, from, to, tokenId: tokenId.toString(), chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }
  return {hash, result};
}

async function transfer({chainTag, gameId, nfts, fromAddresses, toAddresses, tokenIds}) {
  let result = {};
  const receipt = await sendMultiChainTx({
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
        result = { gameId, from, to, tokenId: tokenId.toString(), hash };
        await logActivity(gameId, gameId, 'gameNft', 'transfer', { gameId, from, to, tokenId: tokenId.toString(), chainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }
  return {hash, result};
}

module.exports = { create, mint, burn, transfer };