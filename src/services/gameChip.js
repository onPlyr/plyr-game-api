const { chain, plyrRouterSC, ROUTER_ABI, GAME_CHIP_FACTORY_ABI } = require('../config');
const { sendAndWaitTx } = require('../utils/tx');
const { logActivity } = require('../utils/activity');
const { getAddress, decodeEventLog, parseEther } = require('viem');
const Chip = require('../models/chip');

async function create({gameId, name, symbol, image}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'createGameChip',
    args: [
      gameId,
      name,
      symbol
    ]
  });

  const hash = receipt.transactionHash;

  console.log('createGameChip receipt:', receipt);
  if (receipt.status !== 'success') {
    await logActivity(gameId, gameId, 'gameChip', 'create', { gameId, hash, success: receipt.status });
    throw new Error('Transaction Receipt Failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: GAME_CHIP_FACTORY_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'ChipCreated') {
        const { chip, gameId } = decodedLog.args;
        await Chip.updateOne({ gameId, chip }, { $set: { gameId, chip, name, symbol, image } }, { upsert: true });
        result = { gameId, chip, name, symbol, image, hash };
        await logActivity(gameId, gameId, 'gameChip', 'create', { gameId, chip, name, symbol, image, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function mint({gameId, chips, plyrIds, amounts}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'mintGameChips',
    args: [
      chips,
      plyrIds.map(plyrId => plyrId.slice(-5) === '.plyr' ? plyrId : plyrId + '.plyr'),
      amounts.map(amount => parseEther(amount.toString()))
    ]
  });

  const hash = receipt.transactionHash;
  console.log('mintGameChips receipt:', receipt);
  for (let i=0; i<plyrIds.length; i++) {
    let plyrId = plyrIds[i];
    await logActivity(plyrId, gameId, 'gameChip', 'mint', { gameId, plyrId, hash, chip: chips[i], amount: amounts[i], success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction Receipt Failed');
  }
  return {hash, result};
}

async function burn({gameId,chips, plyrIds, amounts}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'burnGameChips',
    args: [
      chips,
      plyrIds.map(plyrId => plyrId.slice(-5) === '.plyr' ? plyrId : plyrId + '.plyr'),
      amounts.map(amount => parseEther(amount.toString()))
    ]
  });

  const hash = receipt.transactionHash;
  console.log('burnGameChips receipt:', receipt);
  for (let i=0; i<plyrIds.length; i++) {
    let plyrId = plyrIds[i];
    await logActivity(plyrId, gameId, 'gameChip', 'burn', { gameId, plyrId, hash, chip: chips[i], amount: amounts[i], success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction Receipt Failed');
  }
  return {hash, result};
}

async function transfer({gameId, chips, fromPlyrIds, toPlyrIds, amounts}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: plyrRouterSC,
    abi: ROUTER_ABI,
    functionName: 'gameTransferGameChips',
    args: [
      chips,
      fromPlyrIds.map(plyrId => plyrId.slice(-5) === '.plyr' ? plyrId : plyrId + '.plyr'),
      toPlyrIds.map(plyrId => plyrId.slice(-5) === '.plyr' ? plyrId : plyrId + '.plyr'),
      amounts.map(amount => parseEther(amount.toString()))
    ]
  });

  const hash = receipt.transactionHash;
  console.log('transferGameChips receipt:', receipt);
  for (let i=0; i<fromPlyrIds.length; i++) {
    let fromPlyrId = fromPlyrIds[i];
    let toPlyrId = toPlyrIds[i];
    await logActivity(fromPlyrId, gameId, 'gameChip', 'transfer', { gameId, fromPlyrId, toPlyrId, hash, chip: chips[i], amount: amounts[i], success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction Receipt Failed');
  }
  return {hash, result};
}

module.exports = { create, mint, burn, transfer };