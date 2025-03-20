
const Chip = require('../../models/chip');
const { getRedisClient } = require("../../db/redis");
const { checkTaskStatus } = require("../../services/task");
const { getAddress } = require('viem');


exports.postChipCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { name, symbol, image } = ctx.request.body;

  if (!name || !symbol || !image) {
    ctx.status = 400;
    ctx.body = { error: 'name, symbol, and image are required' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), name, symbol}, 'createGameChip', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

exports.postChipMint = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { chips, plyrIds, amounts } = ctx.request.body;

  if (!chips || !plyrIds || !amounts) {
    ctx.status = 400;
    ctx.body = { error: 'chip, plyrIds, and amounts are required' };
    return;
  }

  if (plyrIds.length !== amounts.length) {
    ctx.status = 400;
    ctx.body = { error: 'plyrIds and amounts must be the same length' };
    return;
  }

  const isBelong = await isChipsBelongToGame(gameId, chips);
  if (!isBelong) {
    ctx.status = 400;
    ctx.body = { error: 'chips do not belong to this game' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chips, plyrIds, amounts }, 'mintGameChip', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

exports.postChipBurn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { chips, plyrIds, amounts } = ctx.request.body;

  if (!chips || !plyrIds || !amounts) {
    ctx.status = 400;
    ctx.body = { error: 'chip, plyrIds, and amounts are required' };
    return;
  }

  if (plyrIds.length !== amounts.length) {
    ctx.status = 400;
    ctx.body = { error: 'plyrIds and amounts must be the same length' };
    return;
  }

  const isBelong = await isChipsBelongToGame(gameId, chips);
  if (!isBelong) {
    ctx.status = 400;
    ctx.body = { error: 'chips do not belong to this game' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chips, plyrIds, amounts }, 'burnGameChip', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

exports.postChipTransfer = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { chips, fromPlyrIds, toPlyrIds, amounts } = ctx.request.body;

  if (!chips || !fromPlyrIds || !toPlyrIds || !amounts) {
    ctx.status = 400;
    ctx.body = { error: 'chip, fromPlyrIds, toPlyrIds, and amounts are required' };
    return;
  }

  if (fromPlyrIds.length !== amounts.length || toPlyrIds.length !== amounts.length) {
    ctx.status = 400;
    ctx.body = { error: 'fromPlyrIds, toPlyrIds, and amounts must be the same length' };
    return;
  }

  const isBelong = await isChipsBelongToGame(gameId, chips);
  if (!isBelong) {
    ctx.status = 400;
    ctx.body = { error: 'chips do not belong to this game' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chips, fromPlyrIds, toPlyrIds, amounts }, 'transferGameChip', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

exports.getBalance = async (ctx) => {

}

exports.getInfo = async (ctx) => {
  
}

const insertTask = async (params, taskName, sync = false) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', taskName, JSON.stringify(params));
  if (sync) {
    let retry = 0;
    while (retry < 50) {
      let ret = await checkTaskStatus(taskId);
      if (ret.status === 'PENDING' || ret.status === 'NOT_FOUND') {
        retry++;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      return ret;
    }
    return {
      taskId,
      status: 'TIMEOUT',
      errorMessage: 'Task timeout, but still maybe success, you can check the task status by taskId later',
    };
  }
  return taskId;
}

const isChipsBelongToGame = async (gameId, chips) => {
  for (let i = 0; i < chips.length; i++) {
    const chip = chips[i];
    const gameChip = await Chip.findOne({ gameId: gameId.toLowerCase(), chip: getAddress(chip) });
    if (!gameChip) {
      return false;
    }
  }
  return true;
}