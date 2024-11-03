const { verifyMessage } = require("viem");
const { getRedisClient } = require("../../db/redis");
const UserApprove = require('../../models/userApprove');
const UserInfo = require("../../models/userInfo");
const { isJoined } = require("../../services/game");
const { checkTaskStatus } = require("../../services/task");
const { logActivity } = require('../../utils/activity');

const approve = async ({plyrId, gameId, token, amount, expiresIn}) => {
  await UserApprove.updateOne({plyrId, gameId, token: token.toLowerCase()}, {plyrId, gameId, token: token.toLowerCase(), amount, expiresIn, createdAt: Date.now()}, {upsert: true});
}

const getAllowance = async ({plyrId, gameId, token}) => {
  const userApprove = await UserApprove.findOne({plyrId, gameId, token: token.toLowerCase()});
  if (!userApprove || (userApprove.expiresIn * 1000) + new Date(userApprove.createdAt).getTime() < Date.now()) {
    return 0;
  }
  return userApprove.amount;
}

const getAllowances = async ({plyrId}) => {
  const userApproves = await UserApprove.find({plyrId});
  return userApproves;
}

const revoke = async ({plyrId, gameId, token}) => {
  const query = { plyrId };
  
  if (token.toLowerCase() !== 'all') {
    query.token = token.toLowerCase();
  }
  
  if (gameId.toLowerCase() !== 'all') {
    query.gameId = gameId.toLowerCase();
  }

  await UserApprove.deleteMany(query);
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

const postGameApprove = async (ctx) => {
  const { plyrId, gameId, token, amount, expiresIn } = ctx.request.body;
  console.log('postGameApprove', plyrId, gameId, token, amount, expiresIn);
  try {
    if (!plyrId || !gameId || !token || !amount) {
      ctx.status = 401;
      ctx.body = { error: "Input params was incorrect." };
      return;
    }

    if (isNaN(amount) || Number(amount) <= 0) {
      ctx.status = 401;
      ctx.body = { error: "Approve amount was incorrect." };
      return;
    }
    await approve({ plyrId, gameId, token: token.toLowerCase(), amount, expiresIn });
    ctx.status = 200;
    ctx.body = { message: 'Approved' };
    await logActivity(plyrId, gameId, 'game', 'approve', { gameId, token: token.toLowerCase(), amount });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getGameAllowance = async (ctx) => {
  const { plyrId, gameId, token } = ctx.params;
  try {
    const allowance = await getAllowance({ plyrId, gameId, token: token.toLowerCase() });
    ctx.status = 200;
    ctx.body = { allowance };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getGameAllowances = async (ctx) => {
  const { plyrId } = ctx.params;
  try {
    const allowances = await getAllowances({ plyrId });
    ctx.status = 200;
    ctx.body = { allowances };
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
    await logActivity(plyrId, gameId, 'game', 'revoke', { gameId, token: token.toLowerCase() });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameRevokeBySignature = async (ctx) => {
  const { plyrId, gameId, token, signature } = ctx.request.body;
  try {
    const signatureMessage = `Revoke ${plyrId.toUpperCase()}\'s ${token.toUpperCase()} allowance for ${gameId.toUpperCase()}`;

    const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
    if (!user) {
      ctx.status = 400;
      ctx.body = {
        error: 'User not found'
      };
      return;
    }
    const address = user.primaryAddress;

    const valid = await verifyMessage({
      address,
      message: signatureMessage,
      signature
    });
  
    if (!valid) {
      ctx.status = 400;
      ctx.body = {
        error: 'Invalid signature'
      };
      return;
    }

    await revoke({ plyrId, gameId, token });
    ctx.status = 200;
    ctx.body = { message: 'Revoked' };
    await logActivity(plyrId, gameId, 'game', 'revoke', { gameId, token: token.toLowerCase() });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  let { expiresIn, sync } = ctx.request.body;
  try {
    if (!expiresIn) {
      expiresIn = 30 * 24 * 60 * 60;
    }
    const taskId = await insertTask({ gameId, expiresIn }, 'createGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
        id: taskId,
        status: 'PENDING',
      } };
    }
    await logActivity(gameId, gameId, 'game', 'create', { gameId });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameJoin = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, sessionJwts, sync } = ctx.request.body;
  try {
    const plyrIds = Object.keys(sessionJwts);
    const taskId = await insertTask({ plyrIds, gameId, roomId }, 'joinGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    for (let plyrId of plyrIds) {
      await logActivity(plyrId, gameId, 'game', 'join', { gameId, roomId });
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameLeave = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwts, roomId, sync } = ctx.request.body;
  try {
    const plyrIds = Object.keys(sessionJwts);
    const taskId = await insertTask({ plyrIds, gameId, roomId }, 'leaveGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    for (let plyrId of plyrIds) {
      await logActivity(plyrId, gameId, 'game', 'leave', { gameId, roomId });
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGamePay = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { sessionJwts, roomId, token, amount, sync } = ctx.request.body;
  try {
    const plyrId = Object.keys(sessionJwts)[0];
    const _joined = await isJoined({plyrId, gameId, roomId});
    if (!_joined) {
      ctx.status = 400;
      ctx.body = { error: 'Player is not joined' };
      return;
    }
    const taskId = await insertTask({ plyrId, gameId, roomId, token, amount }, 'payGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
      status: 'PENDING',
      } };
    }
    await logActivity(plyrId, gameId, 'game', 'pay', { gameId, roomId, token: token.toLowerCase(), amount });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEarn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { plyrId, roomId, token, amount, sync } = ctx.request.body;
  try {
    const _joined = await isJoined({plyrId, gameId, roomId});
    if (!_joined) {
      ctx.status = 400;
      ctx.body = { error: 'Player is not joined' };
      return;
    }
    const taskId = await insertTask({ plyrId,gameId, roomId, token, amount }, 'earnGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    await logActivity(plyrId, gameId, 'game', 'earn', { gameId, roomId, token: token.toLowerCase(), amount });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEnd = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, sync } = ctx.request.body;  
  try {
    const taskId = await insertTask({ gameId, roomId }, 'endGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    await logActivity(gameId, gameId, 'game', 'end', { gameId, roomId });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameClose = async (ctx) => {
  const { gameId, roomId, sync } = ctx.request.body;
  try {
    const taskId = await insertTask({ gameId, roomId }, 'closeGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    await logActivity(gameId, gameId, 'game', 'close', { gameId, roomId });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameCreateJoinPay = async (ctx) => {
  try {
    const gameId = ctx.state.apiKey.plyrId;
    let { expiresIn, sessionJwts, tokens, amounts, sync } = ctx.request.body;
    if (!expiresIn) {
      expiresIn = 30 * 24 * 60 * 60;
    }
    const plyrIds = Object.keys(sessionJwts);
    if (plyrIds.length !== tokens.length || plyrIds.length !== amounts.length) {
      ctx.status = 400;
      ctx.body = { error: 'Input params was incorrect.' };
      return;
    }

    const taskId = await insertTask({ gameId, expiresIn, plyrIds, tokens, amounts }, 'createJoinPayGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    for (let plyrId of plyrIds) {
      await logActivity(plyrId, gameId, 'game', 'createJoinPay', { gameId, roomId });
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEarnLeaveEnd = async (ctx) => {
  try {
    const gameId = ctx.state.apiKey.plyrId;
    const { plyrIds, roomId, tokens, amounts, sync } = ctx.request.body;
    if (plyrIds.length !== tokens.length || plyrIds.length !== amounts.length) {
      ctx.status = 400;
      ctx.body = { error: 'Input params was incorrect.' };
      return;
    }
    const taskId = await insertTask({ gameId, roomId, plyrIds, tokens, amounts }, 'earnLeaveEndGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      ctx.body = taskId;
      if (taskId.status === 'TIMEOUT') {
        ctx.status = 504;
      }
    } else {
      ctx.body = { task: {
      id: taskId,
        status: 'PENDING',
      } };
    }
    for (let plyrId of plyrIds) {
      await logActivity(plyrId, gameId, 'game', 'earnLeaveEnd', { gameId, roomId });
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getIsJoined = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, plyrId } = ctx.request.query;

  if (!plyrId) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId is required' };
    return;
  }

  if (roomId === undefined) {
    ctx.status = 400;
    ctx.body = { error: 'roomId is required' };
    return;
  }
  
  const ret = await isJoined({plyrId, gameId, roomId});
  ctx.status = 200;
  ctx.body = { isJoined: ret };
}


// Input:
// const functionDatas = [
//   { function: 'join', params: { roomId: 'room1' } },
//   { function: 'pay', params: { roomId: 'room1', plyrId: 'player1', token: 'token1', amount: 50 } },
// ];
const postGameMulticall = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, functionDatas, sessionJwts } = ctx.request.body;
  try {
    if (!functionDatas || functionDatas.length === 0) {
      ctx.status = 400;
      ctx.body = { error: 'functionDatas is required' };
      return;
    }

    // check function in functionDatas, only support join, pay, earn, end
    const allowedFunctions = ['join', 'pay', 'earn', 'end'];
    for (let i=0; i<functionDatas.length; i++) {
      if (!allowedFunctions.includes(functionDatas[i].function)) {
        ctx.status = 400;
        ctx.body = { error: `function ${functionDatas[i].function} is not allowed` };
        return;
      }
    }

    const taskId = await insertTask({ gameId, roomId, functionDatas, sessionJwts }, 'multicallGameRoom');
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
  getGameAllowances,
  postGameRevoke,
  postGameRevokeBySignature,
  postGameCreate,
  postGameJoin,
  postGameLeave,
  postGamePay,
  postGameEarn,
  postGameEnd,
  postGameClose,
  postGameMulticall,
  postGameCreateJoinPay,
  postGameEarnLeaveEnd,
  getIsJoined,

  approve,
}