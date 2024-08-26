const { getRedisClient } = require("../../db/redis");
const ApiKey = require('../../models/apiKey');
const UserInfo = require('../../models/userInfo');
const UserApprove = require('../../models/userApprove');

const redis = getRedisClient();

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

const create = async ({gameId, expiresIn}) => {}

const join = async ({plyrId, gameId, roomId}) => {}

const leave = async ({plyrId, gameId, roomId}) => {}

const pay = async ({plyrId, gameId, roomId, amount}) => {}

const earn = async ({plyrId, gameId, roomId, amount}) => {}

const end = async ({gameId, roomId}) => {}

const close = async ({gameId, roomId}) => {}

const multicall = async ({gameId, functionDatas}) => {}

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

const postGameCreate = async (ctx) => {}

const postGameJoin = async (ctx) => {}

const postGameLeave = async (ctx) => {}

const postGamePay = async (ctx) => {}

const postGameEarn = async (ctx) => {}

const postGameEnd = async (ctx) => {}

const postGameClose = async (ctx) => {}

const postGameMulticall = async (ctx) => {}

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