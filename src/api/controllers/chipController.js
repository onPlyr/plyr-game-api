const Chip = require('../../models/chip');
const { getRedisClient } = require("../../db/redis");
const { checkTaskStatus } = require("../../services/task");
const { getAddress, erc20Abi, formatEther } = require('viem');
const { chain } = require('../../config');
const UserInfo = require('../../models/userInfo');


const postChipCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { name, symbol, image } = ctx.request.body;

  if (!name || !symbol || !image) {
    ctx.status = 400;
    ctx.body = { error: 'name, symbol, and image are required' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), name, symbol}, 'createGameChip', true);
  if (ret.status === 'SUCCESS') {
    const { chip } = ret.taskData;
    await Chip.updateOne({ gameId, chip }, { $set: { image } });
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postChipMint = async (ctx) => {
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

const postChipBurn = async (ctx) => {
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

const postChipTransfer = async (ctx) => {
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

const getBalance = async (ctx) => {
  const { plyrId, gameId, chip } = ctx.query;

  if(!plyrId) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId is required' };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }
  
  // Build query object with only defined filters
  const query = {};
  
  // Only add gameId to query if it's defined
  if (gameId !== undefined) {
    query.gameId = gameId.toLowerCase();
  }
  
  // Only add chip to query if it's defined
  if (chip !== undefined) {
    query.chip = getAddress(chip);
  }
  
  // Execute the query with only the defined filters
  const chips = await Chip.find(query);
  if (!chips || chips.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'chip not found' };
    return;
  }

  let balances = await Promise.all(chips.map(async (chip)=>{
    const balance = await chain.readContract({
      chip: chip.chip,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [user.mirror]
    });
    return {
      gameId: chip.gameId,
      name: chip.name,
      symbol: chip.symbol,
      chip: chip.chip,
      balance: formatEther(balance)
    };
  }));

  let ret = {};
  balances.map((item)=>{
    if (!ret[item.gameId]) {
      ret[item.gameId] = {};
    }

    ret[item.gameId][item.chip] = {
      name: item.name,
      symbol: item.symbol,
      balance: item.balance,
    };
  })
  
  ctx.status = 200;
  ctx.body = ret;
}

const getInfo = async (ctx) => {
  const { gameId, chip } = ctx.query;

  if(!gameId || !chip) {
    ctx.status = 400;
    ctx.body = { error: 'gameId or chip are required' };
    return;
  }

  let query = {};
  if (gameId) {
    query.gameId = gameId.toLowerCase();
  }
  if (chip) {
    query.chip = getAddress(chip);
  }
  const chips = await Chip.find(query);
  if (!chips || chips.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'chip not found' };
    return;
  }

  for(let i=0; i<chips.length; i++) {
    delete chips[i]._id;
    delete chips[i].__v;
  }

  ctx.status = 200;
  ctx.body = chips;
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


module.exports = {
  postChipCreate,
  postChipMint,
  postChipBurn,
  postChipTransfer,
  getBalance,
  getInfo,
  isChipsBelongToGame
}