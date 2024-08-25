const { getRedisClient } = require("../../db/redis");
const ApiKey = require('../../models/apiKey');
const UserInfo = require('../../models/userInfo');

const redis = getRedisClient();




const approve = async ({plyrId, gameId, amount, expiresIn}) => {}

const revoke = async ({plyrId, gameId}) => {}

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
  const user = ctx.state.user;

  ctx.status = 200;
  ctx.body = { message: 'Approved' };
}

const postGameRevoke = async (ctx) => {}

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