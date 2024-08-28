const { getRedisClient } = require("../../db/redis");
const ApiKey = require('../../models/apiKey');
const UserInfo = require('../../models/userInfo');
const UserApprove = require('../../models/userApprove');

const approve = async ({plyrId, gameId, token, amount, expiresIn}) => {
  await UserApprove.updateOne({plyrId, gameId, token}, {plyrId, gameId, token, amount, expiresIn}, {upsert: true});
}

const getAllowance = async ({plyrId, gameId, token}) => {
  const userApprove = await UserApprove.findOne({plyrId, gameId, token});
  if ((userApprove.expiresIn * 1000) + new Date(userApprove.createdAt).getTime() < Date.now()) {
    return 0;
  }
  return userApprove.amount;
}

const revoke = async ({plyrId, gameId, token}) => {
  if (token === 'all') {
    await UserApprove.deleteMany({plyrId, gameId});
  } else {
    await UserApprove.deleteOne({plyrId, gameId, token});
  }
}

const create = async ({gameId, expiresIn}) => {
  if (!expiresIn) {
    expiresIn = 30 * 24 * 60 * 60;
  }
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'createGameRoom', JSON.stringify({
    gameId,
    expiresIn,
  }));
  return taskId;
}

const join = async ({plyrIds, gameId, roomId}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'joinGameRoom', JSON.stringify({
    plyrIds,
    gameId,
    roomId,
  }));
  return taskId;
}

const leave = async ({plyrIds, gameId, roomId}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'leaveGameRoom', JSON.stringify({
    plyrIds,
    gameId,
    roomId,
  }));
  return taskId;
}

const pay = async ({plyrId, gameId, roomId, token, amount}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'payGameRoom', JSON.stringify({
    plyrId,
    gameId,
    roomId,
    token,
    amount,
  }));
  return taskId;
}

const earn = async ({plyrId, gameId, roomId, token, amount}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'earnGameRoom', JSON.stringify({
    plyrId,
    gameId,
    roomId,
    token,
    amount,
  }));
  return taskId;
}

const end = async ({gameId, roomId}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'endGameRoom', JSON.stringify({
    gameId,
    roomId,
  }));
  return taskId;
}

const close = async ({gameId, roomId}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'closeGameRoom', JSON.stringify({
    gameId,
    roomId,
  }));
  return taskId;
}

const multicall = async ({gameId, roomId, functionDatas, sessionJwts}) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', 'multicallGameRoom', JSON.stringify({
    gameId,
    roomId,
    functionDatas,
    sessionJwts,
  }));
  return taskId;
}

const postGameApprove = async (ctx) => {
  const { plyrId, gameId, token, amount, expiresIn } = ctx.request.body;
  try {
    await approve({ plyrId, gameId, token, amount, expiresIn });
    ctx.status = 200;
    ctx.body = { message: 'Approved' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getGameAllowance = async (ctx) => {
  const { plyrId, gameId, token } = ctx.request.body;
  try {
    const allowance = await getAllowance({ plyrId, gameId, token });
    ctx.status = 200;
    ctx.body = { allowance };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameRevoke = async (ctx) => {
  const { plyrId, gameId, token } = ctx.request.body;
  try {
    await revoke({ plyrId, gameId, token });
    ctx.status = 200;
    ctx.body = { message: 'Revoked' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { expiresIn } = ctx.request.body;
  try {
    const taskId = await create({ gameId, expiresIn });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameJoin = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, sessionJwts } = ctx.request.body;
  try {
    const plyrIds = Object.keys(sessionJwts);
    const taskId = await join({ plyrIds, gameId, roomId });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameLeave = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwts, roomId } = ctx.request.body;
  try {
    const plyrIds = Object.keys(sessionJwts);
    const taskId = await leave({ gameId, plyrIds, roomId });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGamePay = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwts, roomId, token, amount } = ctx.request.body;
  try {
    const plyrId = Object.keys(sessionJwts)[0];
    const taskId = await pay({ gameId, plyrId, roomId, token, amount });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEarn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwts, roomId, token, amount } = ctx.request.body;
  try {
    const plyrId = Object.keys(sessionJwts)[0];
    const taskId = await earn({ gameId, plyrId, roomId, token, amount });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEnd = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId } = ctx.request.body;  
  try {
    const taskId = await end({ gameId, roomId });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameClose = async (ctx) => {
  const { gameId, roomId } = ctx.request.body;
  try {
    const taskId = await close({ gameId, roomId });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameMulticall = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, functionDatas, sessionJwts } = ctx.request.body;
  try {
    const taskId = await multicall({ gameId, roomId, functionDatas, sessionJwts });
    ctx.status = 200;
    ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
    } };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

module.exports = {
  postGameApprove,
  getGameAllowance,
  postGameRevoke,
  postGameCreate,
  postGameJoin,
  postGameLeave,
  postGamePay,
  postGameEarn,
  postGameEnd,
  postGameClose,
  postGameMulticall,
}