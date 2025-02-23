const { verifyMessage } = require("viem");
const { getRedisClient } = require("../../db/redis");
const UserApprove = require('../../models/userApprove');
const UserInfo = require("../../models/userInfo");
const Auth = require('../../models/auth');
const { isJoined } = require("../../services/game");
const { checkTaskStatus } = require("../../services/task");
const { logActivity } = require('../../utils/activity');

const approve = async ({plyrId, gameId, token, tokens, amount, expiresIn}) => {
  await UserApprove.updateOne({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), token: token.toLowerCase()}, {plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), token: token.toLowerCase(), amount, expiresIn, createdAt: Date.now()}, {upsert: true});
}

const getAllowance = async ({plyrId, gameId, token}) => {
  const userApprove = await UserApprove.findOne({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), token: token.toLowerCase()});
  if (!userApprove || (userApprove.expiresIn * 1000) + new Date(userApprove.createdAt).getTime() < Date.now()) {
    return 0;
  }
  return userApprove.amount;
}

const getAllowances = async ({plyrId}) => {
  const userApproves = await UserApprove.find({plyrId: plyrId.toLowerCase()});
  return userApproves;
}

const revoke = async ({plyrId, gameId, token}) => {
  const query = { plyrId: plyrId.toLowerCase() };
  
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
  const { plyrId, gameId, token, tokens, amount, amounts, expiresIn, uid } = ctx.request.body;
  console.log('postGameApprove', plyrId, gameId, token, tokens, amount, expiresIn);
  try {
    if (!plyrId || !gameId) {
      ctx.status = 401;
      ctx.body = { error: "Input params was incorrect." };
      return;
    }
    
    if (token) {
      if (isNaN(amount) || Number(amount) <= 0) {
        ctx.status = 401;
        ctx.body = { error: "Approve amount was incorrect." };
        return;
      }
      await approve({ plyrId, gameId, token: token.toLowerCase(), amount, expiresIn });
      await logActivity(plyrId, gameId, 'game', 'approve', { gameId, token: token.toLowerCase(), amount });
    }
    if (tokens && tokens.length > 0) {  
      for (let i = 0; i < tokens.length; i++) {
        if (isNaN(amounts[i]) || Number(amounts[i]) <= 0) {
          ctx.status = 401;
          ctx.body = { error: "Approve amount was incorrect." };
          return;
        }
        await approve({ plyrId, gameId, token: tokens[i].toLowerCase(), amount: amounts[i], expiresIn });
        await logActivity(plyrId, gameId, 'game', 'approve', { gameId, token: tokens[i].toLowerCase(), amount: amounts[i] });
      }
    }

    ctx.status = 200;
    ctx.body = { message: 'Approved', success: true };
    if (uid) {
      await Auth.create({ uid, data: ctx.body });
    }
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getGameAllowance = async (ctx) => {
  const { plyrId, gameId, token } = ctx.params;
  try {
    const allowance = await getAllowance({ plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), token: token.toLowerCase() });
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
    const allowances = await getAllowances({ plyrId: plyrId.toLowerCase() });
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
    await revoke({ plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), token: token.toLowerCase() });
    ctx.status = 200;
    ctx.body = { message: 'Revoked' };
    await logActivity(plyrId.toLowerCase(), gameId, 'game', 'revoke', { gameId: gameId.toLowerCase(), token: token.toLowerCase() });
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

    await revoke({ plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), token: token.toLowerCase() });
    ctx.status = 200;
    ctx.body = { message: 'Revoked' };
    await logActivity(plyrId.toLowerCase(), gameId.toLowerCase(), 'game', 'revoke', { gameId: gameId.toLowerCase(), token: token.toLowerCase() });
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  let { expiresIn, sync } = ctx.request.body;
  console.log('postGameCreate', {gameId, expiresIn, sync});
  try {
    if (!expiresIn) {
      expiresIn = 30 * 24 * 60 * 60;
    }
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), expiresIn }, 'createGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameJoin = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { roomId, sync } = ctx.request.body;
  try {
    const plyrIds = ctx.state.plyrIds;
    console.log('postGameJoin', {gameId, plyrIds, roomId, sync});

    // check all plyrId isJoined, and return unjoined plyrIds
    const unjoinedPlyrIds = [];
    for (const plyrId of plyrIds) {
      const _joined = await isJoined({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId});
      if (!_joined) {
        unjoinedPlyrIds.push(plyrId.toLowerCase());
      }
    }

    if (unjoinedPlyrIds.length === 0) {
      ctx.status = 200;
      ctx.body = { message: 'All players are already joined' };
      return;
    }

    const taskId = await insertTask({ plyrIds: unjoinedPlyrIds, gameId: gameId.toLowerCase(), roomId }, 'joinGameRoom', sync);
    ctx.status = 200;
    if (sync) {
      let times = 50;
      while (times > 0) {
        let allJoined = true;
        for (const plyrId of plyrIds) {
          const _joined = await isJoined({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId});
          if (!_joined) {
            allJoined = false;
            break;
          }
        }
        if (allJoined) {
          _joined = true;
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        times--;
      }
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameLeave = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
  const { roomId, sync } = ctx.request.body;
  try {
    const plyrIds = ctx.state.plyrIds;
    console.log('postGameLeave', {gameId, plyrIds, roomId, sync});
    const taskId = await insertTask({ plyrIds: plyrIds.map(plyrId => plyrId.toLowerCase()), gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase() }, 'leaveGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGamePay = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
  const { plyrId } = ctx.state.payload;
  const { roomId, token, amount, sync } = ctx.request.body;
  console.log('postGamePay', {gameId, plyrId, roomId, token, amount, sync});
  try {
    const _joined = await isJoined({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId});
    if (!_joined) {
      ctx.status = 400;
      ctx.body = { error: 'Player is not joined' };
      return;
    }
    const taskId = await insertTask({ plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase(), token: token.toLowerCase(), amount }, 'payGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameBatchPay = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
  const plyrIds = ctx.state.plyrIds.map(plyrId => plyrId.toLowerCase());
  const { roomId, tokens, amounts, sync } = ctx.request.body;
  console.log('postGameBatchPay', {gameId, plyrIds, roomId, tokens, amounts, sync});
  if (tokens.length !== amounts.length || tokens.length !== plyrIds.length) {
    ctx.status = 400;
    ctx.body = { error: 'Tokens and amounts must be the same length' };
    return;
  }

  try {
    const taskId = await insertTask({ plyrIds, gameId, roomId: roomId.toLowerCase(), tokens: tokens.map(token => token.toLowerCase()), amounts }, 'batchPayGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEarn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
  const { plyrId, roomId, token, amount, sync } = ctx.request.body;
  try {
    const _joined = await isJoined({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase()});
    if (!_joined) {
      ctx.status = 400;
      ctx.body = { error: 'Player is not joined' };
      return;
    }
    const taskId = await insertTask({ plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase(), token: token.toLowerCase(), amount }, 'earnGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameBatchEarn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
  const { plyrIds, roomId, tokens, amounts, sync } = ctx.request.body;
  console.log('postGameBatchEarn', {gameId, plyrIds, roomId, tokens, amounts, sync});
  if (tokens.length !== amounts.length || tokens.length !== plyrIds.length) {
    ctx.status = 400;
    ctx.body = { error: 'Tokens and amounts must be the same length' };
    return;
  }
  try {
    const taskId = await insertTask({ plyrIds: plyrIds.map(plyrId => plyrId.toLowerCase()), gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase(), tokens: tokens.map(token => token.toLowerCase()), amounts }, 'batchEarnGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEnd = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
  const { roomId, sync } = ctx.request.body;  
  console.log('postGameEnd', {gameId, roomId, sync});
  try {
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase() }, 'endGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameClose = async (ctx) => {
  const { gameId, roomId, sync } = ctx.request.body;
  try {
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase() }, 'closeGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameCreateJoinPay = async (ctx) => {
  try {
    const gameId = ctx.state.apiKey.plyrId.toLowerCase();
    const plyrIds = ctx.state.plyrIds;
    let { expiresIn, tokens, amounts, sync } = ctx.request.body;
    if (!expiresIn) {
      expiresIn = 30 * 24 * 60 * 60;
    }

    if (plyrIds.length !== tokens.length || plyrIds.length !== amounts.length) {
      ctx.status = 400;
      ctx.body = { error: 'Input params was incorrect.' };
      return;
    }
    console.log('postGameCreateJoinPay', {gameId, expiresIn, plyrIds, tokens, amounts, sync});
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), expiresIn, plyrIds: plyrIds.map(plyrId => plyrId.toLowerCase()), tokens: tokens.map(token => token.toLowerCase()), amounts }, 'createJoinPayGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameJoinPay = async (ctx) => {
  try {
    const gameId = ctx.state.apiKey.plyrId.toLowerCase();
    const plyrIds = ctx.state.plyrIds;
    let { roomId, tokens, amounts, sync } = ctx.request.body;

    if (plyrIds.length !== tokens.length || plyrIds.length !== amounts.length) {
      ctx.status = 400;
      ctx.body = { error: 'Input params was incorrect.' };
      return;
    }
    console.log('postGameJoinPay', {gameId, roomId, plyrIds, tokens, amounts, sync});
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase(), plyrIds: plyrIds.map(plyrId => plyrId.toLowerCase()), tokens: tokens.map(token => token.toLowerCase()), amounts }, 'joinPayGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEarnLeaveEnd = async (ctx) => {
  try {
    const gameId = ctx.state.apiKey.plyrId.toLowerCase();
    const { plyrIds, roomId, tokens, amounts, sync } = ctx.request.body;
    if (plyrIds.length !== tokens.length || plyrIds.length !== amounts.length) {
      ctx.status = 400;
      ctx.body = { error: 'Input params was incorrect.' };
      return;
    }
    console.log('postGameEarnLeaveEnd', {gameId, roomId, plyrIds, tokens, amounts, sync});
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase(), plyrIds: plyrIds.map(plyrId => plyrId.toLowerCase()), tokens: tokens.map(token => token.toLowerCase()), amounts }, 'earnLeaveEndGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameEarnLeave = async (ctx) => {
  try {
    const gameId = ctx.state.apiKey.plyrId.toLowerCase();
    const { plyrIds, roomId, tokens, amounts, sync } = ctx.request.body;
    if (plyrIds.length !== tokens.length || plyrIds.length !== amounts.length) {
      ctx.status = 400;
      ctx.body = { error: 'Input params was incorrect.' };
      return;
    }
    console.log('postGameEarnLeave', {gameId, roomId, plyrIds, tokens, amounts, sync});
    const taskId = await insertTask({ gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase(), plyrIds: plyrIds.map(plyrId => plyrId.toLowerCase()), tokens: tokens.map(token => token.toLowerCase()), amounts }, 'earnLeaveGameRoom', sync);
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
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getIsJoined = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId.toLowerCase();
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
  
  const ret = await isJoined({plyrId: plyrId.toLowerCase(), gameId: gameId.toLowerCase(), roomId: roomId.toLowerCase()});
  ctx.status = 200;
  ctx.body = { isJoined: ret };
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
  postGameBatchPay,
  postGameEarn,
  postGameBatchEarn,
  postGameEnd,
  postGameClose,
  postGameCreateJoinPay,
  postGameJoinPay,
  postGameEarnLeaveEnd,
  postGameEarnLeave,
  getIsJoined,

  approve,
}