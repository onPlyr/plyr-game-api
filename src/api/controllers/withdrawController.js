const { verifyMessage, isHex } = require('viem');
const { getRedisClient } = require("../../db/redis");
const GameRoom = require('../../models/gameRoom');

const insertTask = async (params, taskName) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', taskName, JSON.stringify(params));
  return taskId;
}

exports.postWithdraw = async (ctx) => {
  const { plyrId, signature, token, amount, toChain, toAddress } = ctx.request.body;
  if (!plyrId || !signature || !token || !amount || !toChain || !toAddress) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid request'
    };
    return;
  }

  if (isGame(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Game can not use this api'
    };
    return;
  }

  if (Number(amount) <= 0 || isNaN(amount)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid amount'
    };
    return;
  }

  if (!isHex(signature)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Signature must be a hex string'
    };
    return;
  }

  const user = ctx.state.user;
  const tokenAddress = ctx.state.tokenAddress;

  const signatureMessage = `PLYR[ID] Withdraw token: ${token}, amount: ${amount}`;

  const valid = await verifyMessage({
    message: signatureMessage,
    signature,
    signer: user.primaryAddress
  });

  if (!valid) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid signature'
    };
    return;
  }

  // insert task to create withdraw tx
  const taskId = await insertTask({ from: user.primaryAddress, to: toAddress, amount, token: tokenAddress, toChain }, 'createWithdrawTx');

  ctx.status = 200;
  ctx.body = {
    task: {
      id: taskId,
      status: 'PENDING',
    }
  }
}

async function isGame(plyrId) {
  const room = await GameRoom.findOne({ gameId: plyrId });
  return room ? true : false;
}

exports.getIsGame = async (ctx) => {
  const { plyrId } = ctx.params;
  if (!plyrId) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID]'
    };
    return;
  }

  const ret = await isGame(plyrId);

  ctx.status = 200;
  ctx.body = {
    isGame: ret
  }
}