const { sendMultiChainTx } = require('../utils/tx');
const { localChainTag } = require('../config');
const { GAME_NFT_FACTORY_ABI } = require('../config');
const { logActivity } = require('../utils/activity');
const { decodeEventLog } = require('viem');
const GameBadgeCollection = require('../models/gameBadgeCollection');
const GameBadgeRule = require('../models/gameBadgeRule');
const GameBadge = require('../models/gameBadge');
const { gameNftConfig} = require('../config');

async function create({gameId, name, symbol}) {
  let result = {};

  console.log('create game badge collection', {gameId, name, symbol});

  let receipt = await sendMultiChainTx({
    chainTag: localChainTag,
    address: gameNftConfig[localChainTag].gameNftFactory,
    abi: GAME_NFT_FACTORY_ABI,
    functionName: 'createNft',
    args: [
      gameId,
      name,
      symbol,
      true
    ]
  });

  const hash = receipt.transactionHash;

  console.log('createGameBadge receipt:', receipt);
  if (receipt.status !== 'success') {
    await logActivity(gameId, gameId, 'gameBadge', 'create', { gameId, hash, success: receipt.status });
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
        await GameBadgeCollection.updateOne({ gameId, badgeCollection: nft }, { $set: { gameId, badgeCollection: nft, name, symbol } }, { upsert: true });
        result = { gameId, badgeCollection: nft, name, symbol, hash };
        await logActivity(gameId, gameId, 'gameBadge', 'create', { gameId, badgeCollection: nft, name, symbol, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}


async function mint({gameId, plyrIds, slugs, addresses, tokenUris, metaJsons}) {
  let result = [];

  let collection = await GameBadgeCollection.findOne({ gameId });
  if (!collection) {
    throw new Error('Game Badge Collection Not Found');
  }

  let badgeCollection = collection.badgeCollection;

  let receipt = await sendMultiChainTx({
    chainTag: localChainTag,
    address: gameNftConfig[localChainTag].gameNftFactory,
    abi: GAME_NFT_FACTORY_ABI,
    functionName: 'batchMint',
    args: [
      addresses.map(() => badgeCollection),
      addresses,
      tokenUris
    ]
  });

  const hash = receipt.transactionHash;
  console.log('mintGameBadge receipt:', receipt);

  for (let i=0; i<addresses.length; i++) {
    let address = addresses[i];
    let slug = slugs[i];
    let plyrId = plyrIds[i];
    await logActivity(plyrId, gameId, 'gameBadge', 'mint', { gameId, plyrId, address, slug, badgeCollection, chainTag: localChainTag, hash, success: receipt.status });
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
        await logActivity(gameId, gameId, 'gameBadge', 'mint', { gameId, from, to, tokenId: tokenId.toString(), chainTag: localChainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  for (let i = 0; i < result.length; i++) {
    let { gameId, to, tokenId } = result[i];
    let plyrId = plyrIds[i].toLowerCase();
    let slug = slugs[i].toLowerCase();
    let metaJson = metaJsons[i];
    await GameBadge.create({
      gameId,
      slug,
      tokenId,
      plyrId,
      owner: to,
      metaJson
    });
  }

  return {hash, result};
}

async function burn({gameId, plyrIds, slugs, tokenIds}) {
  let result = [];

  let collection = await GameBadgeCollection.findOne({ gameId });
  if (!collection) {
    throw new Error('Game Badge Collection Not Found');
  }

  let gameBadgeCollection = collection.badgeCollection;

  let receipt = await sendMultiChainTx({
    chainTag: localChainTag,
    address: gameNftConfig[localChainTag].gameNftFactory,
    abi: GAME_NFT_FACTORY_ABI,
    functionName: 'batchBurn',
    args: [
      tokenIds.map(()=>gameBadgeCollection),
      tokenIds
    ]
  });

  const hash = receipt.transactionHash;
  console.log('burnGameBadge receipt:', receipt);
  for (let i=0; i<tokenIds.length; i++) {
    let tokenId = tokenIds[i];
    let nft = gameBadgeCollection;
    let plyrId = plyrIds[i];
    let slug = slugs[i];
    await logActivity(plyrId, gameId, 'gameBadge', 'burn', { gameId, plyrId, slug, tokenId, nft, chainTag: localChainTag, hash, success: receipt.status });
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
        await logActivity(gameId, gameId, 'gameBadge', 'burn', { gameId, tokenId: tokenId.toString(), chainTag: localChainTag, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  for (let i = 0; i < result.length; i++) {
    let { gameId, tokenId } = result[i];
    let plyrId = plyrIds[i];
    let slug = slugs[i];
    await GameBadge.deleteOne({gameId, plyrId, slug, tokenId});
  }

  return {hash, result};
}


module.exports = { create, mint, burn };
