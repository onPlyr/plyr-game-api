const { verifyMessage, isAddress, isHex } = require('viem');
const UserInfo = require('../../models/userInfo');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { verifyPlyrid } = require('../../utils/utils');

exports.getUserExists = async (ctx) => {
  const { plyrId } = ctx.query;

  if (!plyrId) {
    ctx.status = 400;
    ctx.body = {
      error: 'PlyrId is required'
    };
    return;
  }

  // Check if user exists
  const user = await UserInfo.findOne({ plyrId });
  if (!user) {
    ctx.body = {
      exists: false
    };
    return;
  } else {
    ctx.body = {
      exists: true
    };
    return;
  }
};

exports.postRegister = async (ctx) => {
  const { address, signature, plyrId, secret } = ctx.request.body;

  if (!address || !signature || !plyrId || !secret) {
    ctx.status = 400;
    ctx.body = {
      error: 'Address, signature, plyrId, secret are required'
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

  if (!isAddress(address)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid address'
    };
    return;
  }

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid plyrId'
    };
    return;
  }

  const singatureMessage = `PLYR[ID] Registration`;

  const valid = await verifyMessage({
    address,
    message: singatureMessage,
    signature
  });

  if (!valid) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid signature'
    };
    return;
  }

  await UserInfo.create({
    plyrId,
    mirror: address,
    secret
  });

  if (process.env.NODE_ENV !== 'test') {
    // insert message into redis stream
  }

  const mirror = calcMirrorAddress(address);

  ctx.body = {
    plyrId,
    mirror,
  };
};