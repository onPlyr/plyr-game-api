const { verifyMessage, isAddress, isHex, getAddress } = require('viem');
const UserInfo = require('../../models/userInfo');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { verifyPlyrid, getAvatarUrl } = require('../../utils/utils');
const { getRedisClient } = require('../../db/redis');
const Secondary = require('../../models/secondary');
const ApiKey = require('../../models/apiKey');
const { authenticator } = require('otplib');
const { generateJwtToken } = require('../../utils/jwt');

const redis = getRedisClient();

authenticator.options = {
  step: 30,
  window: 1
};

exports.getUserExists = async (ctx) => {
  let { queryStr } = ctx.params;

  if (!queryStr) {
    ctx.status = 400;
    ctx.body = {
      error: 'PlyrId or primaryAddress is required'
    };
    return;
  }
  
  let plyrId;
  let primaryAddress;
  if (isAddress(queryStr)) {
    primaryAddress = getAddress(queryStr);
  } else {
    plyrId = queryStr.toLowerCase();
  }

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
    const user = await UserInfo.findOne({ primaryAddress: getAddress(primaryAddress)});
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

  ret = await UserInfo.findOne({ primaryAddress: getAddress(address) });
  if (ret && ret.primaryAddress === getAddress(address)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Primary address already exists'
    };
    console.log('ret', ret);
    return;
  }

  const mirror = calcMirrorAddress(address);

  await UserInfo.create({
    plyrId,
    mirror: mirror,
    primaryAddress: getAddress(address),
    secret,
    chainId: chainId || 62831,
    avatar: getAvatarUrl(avatar),
  });

  if (process.env.NODE_ENV !== 'test') {
    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'createUser', JSON.stringify({
      address: getAddress(address),
      plyrId,
      chainId: chainId || 62831,
    }));
    console.log('Added message ID:', messageId);

    ctx.body = {
      plyrId,
      mirror,
      primaryAddress: getAddress(address),
      avatar: getAvatarUrl(avatar),
      task: {
        id: messageId,
        status: 'PENDING',
      },
    };
  } else {
    ctx.body = {
      plyrId,
      mirror,
      primaryAddress: getAddress(address),
      avatar: getAvatarUrl(avatar),
    };
  }
};

exports.getUserInfo = async (ctx) => {
  let { plyrId } = ctx.params;

  if (isAddress(plyrId)) {
    const primaryAddress = getAddress(plyrId);
    const user = await UserInfo.findOne({ primaryAddress });
    if (!user) {
      ctx.status = 404;
      ctx.body = {
        error: 'Primary address not found'
      };
      return;
    } else {
      let avatar = getAvatarUrl(user.avatar);

      ctx.body = {
        plyrId: user.plyrId,
        mirror: user.mirror,
        primaryAddress: user.primaryAddress,
        chainId: user.chainId,
        avatar,
        createdAt: user.createdAt,
      };
    }
  } else {
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
      let avatar = getAvatarUrl(user.avatar);
      ctx.body = {
        plyrId: user.plyrId,
        mirror: user.mirror,
        primaryAddress: user.primaryAddress,
        chainId: user.chainId,
        avatar,
        createdAt: user.createdAt,
      };
    }
  }
}

exports.postModifyAvatar = async (ctx) => {
  const { plyrId } = ctx.params;
  const { avatar } = ctx.request.body;

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID]'
    };
    return;
  }

  if (!avatar || typeof avatar !== 'string') {
    ctx.status = 400;
    ctx.body = {
      error: 'Avatar must be a non-empty string'
    };
    return;
  }

  const normalizedPlyrId = plyrId.toLowerCase();

  const updatedUser = await UserInfo.findOneAndUpdate(
    { plyrId: normalizedPlyrId },
    { $set: { avatar } },
    { new: true }
  );

  if (!updatedUser) {
    ctx.status = 404;
    ctx.body = {
      error: 'PLYR[ID] not found'
    };
    return;
  }

  ctx.body = {
    plyrId: updatedUser.plyrId,
    avatar: updatedUser.avatar,
  };
};

exports.postSecondaryBind = async (ctx) => {
  const { plyrId, secondaryAddress, signature } = ctx.request.body;

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID]'
    };
    return;
  }

  if (!isAddress(secondaryAddress)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid secondary address'
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

  let user = await UserInfo.findOne({ plyrId: verifyPlyrid(plyrId) });
  if (!user) {
    ctx.status = 400;
    ctx.body = {
      error: 'User not exists'
    };
    return;
  }

  if (getAddress(user.primaryAddress) === getAddress(secondaryAddress)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Secondary must different with primary address'
    }
    return;
  }

  let ret = await Secondary.findOne({ secondaryAddress: getAddress(secondaryAddress) });
  if (ret) {
    ctx.status = 400;
    ctx.body = {
      error: 'Secondary address already exists'
    };
    return;
  }

  const singatureMessage = `PLYR[ID] Secondary Bind`;

  const valid = await verifyMessage({
    address: secondaryAddress,
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

  await Secondary.create({
    plyrId: plyrId.toLowerCase(),
    secondaryAddress: getAddress(secondaryAddress),
  });

  ctx.status = 200;
  ctx.body = {
    plyrId: plyrId.toLowerCase(),
    secondaryAddress: getAddress(secondaryAddress),
  };
}

exports.getSecondary = async (ctx) => {
  const { plyrId } = ctx.params;

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID]'
    };
    return;
  }

  const secondary = await Secondary.find({ plyrId: plyrId.toLowerCase() });
  ctx.status = 200;
  ctx.body = secondary;
  return;
}

exports.postLogin = async (ctx) => {
  const { apikey } = ctx.headers;
  const { plyrId, token, deadline } = ctx.request.body;
  const userApiKey = await ApiKey.findOne({ apiKey: apikey });
  if (!userApiKey) {
    ctx.status = 401;
    ctx.body = {
      error: 'Unauthorized API key'
    };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = {
      error: 'User not found'
    };
    return;
  }

  const isValid = authenticator.verify({ token, secret: user.secret });
  if (!isValid) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid token'
    };
    return;
  }

  const gameId = userApiKey.plyrId;

  const nonce = user.nonce ? user.nonce : {};
  let gameNonce = nonce[gameId] ? nonce[gameId] + 1 : 1;
  nonce[gameId] = gameNonce;
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { nonce } });

  const _deadline = deadline ? deadline : Date.now() + 1000 * 60 * 60 * 24;

  const payload = { plyrId, nonce: gameNonce, deadline: _deadline, gameId, primaryAddress: user.primaryAddress, mirror: user.mirror };
  const JWT = generateJwtToken(payload);

  ctx.status = 200;
  ctx.body = {
    token: JWT,
    ...payload,
  }
}

exports.postLogout = async (ctx) => {
  const { apikey } = ctx.headers;
  const { plyrId, token } = ctx.request.body;
  const payload = verifyToken(token);
  if (!payload) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid token',
    };
    return;
  }

  const userApiKey = await ApiKey.findOne({ apiKey: apikey });
  if (!userApiKey) {
    ctx.status = 401;
    ctx.body = {
      error: 'Unauthorized API key'
    };
    return;
  }

  const gameId = userApiKey.plyrId;

  if (payload.plyrId !== plyrId || payload.gameId !== gameId) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid plyrId or gameId',
    };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 401;
    ctx.body = {
      error: 'User not found',
    };
    return;
  }

  const nonce = user.nonce ? user.nonce : {};
  const gameNonce = nonce[gameId] ? nonce[gameId] : 0;
  if (payload.nonce + 1 < gameNonce) {
    ctx.status = 200;
    ctx.body = {
      message: 'JWT nonce is expired',
    };
    return;
  }

  nonce[gameId] = gameNonce + 1;
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { nonce } });

  ctx.status = 200;
  ctx.body = {
    message: 'Logout success',
  };
}