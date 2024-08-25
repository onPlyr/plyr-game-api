const { getRedisClient } = require("../../db/redis");
const ApiKey = require('../../models/apiKey');
const UserInfo = require('../../models/userInfo');
const UserApprove = require('../../models/userApprove');

const redis = getRedisClient();

const approve = async ({plyrId, gameId, amount, expiresIn}) => {
  await UserApprove.updateOne({plyrId, gameId}, {plyrId, gameId, amount, expiresIn}, {upsert: true});
}

const getAllowance = async ({plyrId, gameId}) => {
  const userApprove = await UserApprove.findOne({plyrId, gameId});
  return userApprove.amount;
}

const revoke = async ({plyrId, gameId}) => {
  await UserApprove.deleteOne({plyrId, gameId});
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
  const { plyrId, gameId, amount, expiresIn } = ctx.request.body;
  try {
    await approve({ plyrId, gameId, amount, expiresIn });
    ctx.status = 200;
    ctx.body = { message: 'Approved' };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const getGameAllowance = async (ctx) => {
  const { plyrId, gameId } = ctx.request.body;
  try {
    const allowance = await getAllowance({ plyrId, gameId });
    ctx.status = 200;
    ctx.body = { allowance };
  } catch (error) {
    ctx.status = 500;
    ctx.body = { error: error.message };
  }
}

const postGameRevoke = async (ctx) => {
  const { plyrId, gameId } = ctx.request.body;
  try {
    await revoke({ plyrId, gameId });
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