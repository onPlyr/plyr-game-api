const { verifyMessage, isAddress, isHex } = require('viem');
const UserInfo = require('../../models/userInfo');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { verifyPlyrid } = require('../../utils/utils');
const { getRedisClient } = require('../../db/redis');

const redis = getRedisClient();

exports.getUserExists = async (ctx) => {
  let { plyrId, primaryAddress } = ctx.query;

  if (!plyrId && !primaryAddress) {
    ctx.status = 400;
    ctx.body = {
      error: 'PlyrId or primaryAddress is required'
    };
    return;
  }

  ctx.body = {
    exists: false
  };

  if (plyrId) {
    plyrId = plyrId.toLowerCase();
    // Check if user exists
    const user = await UserInfo.findOne({ plyrId });
    if (user) {
      ctx.body = {
        exists: true
      };
      return;
    }
  }

  if (primaryAddress) {
    // Check if user exists
    const user = await UserInfo.findOne({ primaryAddress });
    if (user) {
      ctx.body = {
        exists: true
      };
      return;
    }
  }
};

exports.postRegister = async (ctx) => {
  let { address, signature, plyrId, secret, chainId, avatar } = ctx.request.body;

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
      error: 'Invalid PLYR[ID}'
    };
    return;
  }

  plyrId = plyrId.toLowerCase();
  console.log('plyrId', plyrId);

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

  let ret = await UserInfo.findOne({ plyrId });
  if (ret && ret.plyrId === plyrId) {
    ctx.status = 400;
    ctx.body = {
      error: 'PLYR[ID] already exists'
    };
    console.log('ret', ret);
    return;
  }

  ret = await UserInfo.findOne({ primaryAddress: address.toLowerCase() });
  if (ret && ret.primaryAddress === address) {
    ctx.status = 400;
    ctx.body = {
      error: 'Primary already exists'
    };
    console.log('ret', ret);
    return;
  }

  const mirror = calcMirrorAddress(address);

  await UserInfo.create({
    plyrId,
    mirror: mirror,
    primaryAddress: address.toLowerCase(),
    secret,
    chainId: chainId || 62831,
    avatar: avatar ? avatar : '',
  });

  if (process.env.NODE_ENV !== 'test') {
    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'createUser', JSON.stringify({
      address,
      plyrId,
      chainId: chainId || 62831,
    }));
    console.log('Added message ID:', messageId);
  }

  ctx.body = {
    plyrId,
    mirror,
    primaryAddress: address
  };
};

exports.getUserInfo = async (ctx) => {
  let { plyrId } = ctx.params;

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID}'
    };
    return;
  }

  plyrId = plyrId.toLowerCase();

  const user = await UserInfo.findOne({ plyrId });
  if (!user) {
    ctx.status = 404;
    ctx.body = {
      error: 'PLYR[ID] not found'
    };
    return;
  } else {
    ctx.body = {
      plyrId: user.plyrId,
      mirror: user.mirror,
      primaryAddress: user.primaryAddress,
      chainId: user.chainId,
      avatar: user.avatar,
    };
  }
}