const { verifyMessage, isAddress, isHex, getAddress, formatEther, erc20Abi, formatUnits, zeroAddress } = require('viem');
const UserInfo = require('../../models/userInfo');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { verifyPlyrid, getAvatarUrl, is2faUsed } = require('../../utils/utils');
const { getRedisClient } = require('../../db/redis');
const Secondary = require('../../models/secondary');
const ApiKey = require('../../models/apiKey');
const { authenticator } = require('otplib');
const { generateJwtToken, verifyToken } = require('../../utils/jwt');
const config = require('../../config');

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
      error: 'Invalid PLYR[ID]'
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
      mirrorAddress: mirror,
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
      mirrorAddress: mirror,
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
        mirrorAddress: user.mirror,
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
        error: 'Invalid PLYR[ID]'
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
        mirrorAddress: user.mirror,
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
  const { avatar, signature } = ctx.request.body;

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

  const signatureMessage = `PLYR[ID] Update Profile Image`;

  if (!isHex(signature)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Signature must be a hex string'
    };
    return;
  }

  const normalizedPlyrId = plyrId.toLowerCase();

  const user = await UserInfo.findOne({ plyrId: normalizedPlyrId });
  if (!user) {
    ctx.status = 404;
    ctx.body = {
      error: 'PLYR[ID] not found'
    };
    return;
  }

  const valid = await verifyMessage({
    address: user.primaryAddress,
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

  const signatureMessage = `PLYR[ID] Secondary Bind`;

  const valid = await verifyMessage({
    address: secondaryAddress,
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
  const { plyrId, expiresIn } = ctx.request.body;
  const user = ctx.state.user;
  const userApiKey = ctx.state.apiKey;
  const gameId = userApiKey.plyrId;

  const nonce = user.nonce ? user.nonce : {};
  let gameNonce = nonce[gameId] ? nonce[gameId] + 1 : 1;
  nonce[gameId] = gameNonce;
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { nonce, loginFailedCount: 0 } });

  const payload = { plyrId, nonce: gameNonce, gameId, primaryAddress: user.primaryAddress, mirrorAddress: user.mirror };
  const JWT = generateJwtToken(payload, expiresIn);

  delete payload.nonce;

  ctx.status = 200;
  ctx.body = {
    sessionJwt: JWT,
    ...payload,
    avatar: getAvatarUrl(user.avatar),
  }
}

exports.postLogout = async (ctx) => {
  const { sessionJwt } = ctx.request.body;
  const payload = verifyToken(sessionJwt);
  if (!payload) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid sessionJwt',
    };
    return;
  }

  const userApiKey = ctx.state.apiKey;

  const gameId = userApiKey.plyrId;
  const plyrId = payload.plyrId;

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
  if (payload.nonce < gameNonce) {
    ctx.status = 401;
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

exports.postUserSessionVerify = async (ctx) => {
  const userApiKey = ctx.state.apiKey;
  const { sessionJwt } = ctx.request.body;
  const payload = verifyToken(sessionJwt);
  if (!payload) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid sessionJwt',
    };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: payload.plyrId });
  if (!user) {
    ctx.status = 401;
    ctx.body = {
      error: 'User not found',
    };
    return;
  }
  const gameId = payload.gameId;
  if (gameId !== userApiKey.plyrId) {
    ctx.status = 401;
    ctx.body = {
      error: 'JWT and API key mismatch',
    };
    return;
  }

  const nonce = user.nonce ? user.nonce : {};
  const gameNonce = nonce[gameId] ? nonce[gameId] : 0;
  if (isNaN(payload.nonce) || payload.nonce < gameNonce) {
    ctx.status = 401;
    ctx.body = {
      error: 'JWT nonce is expired',
    };
    return;
  }

  ctx.status = 200;
  ctx.body = {
    success: true,
    payload,
  };
}

exports.postReset2fa = async (ctx) => {
  const { plyrId, signature, secret } = ctx.request.body;
  const signatureMessage = `PLYR[ID] Reset Two-Factor Authentication`;

  if (!isHex(signature)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Signature must be a hex string'
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

  const valid = await verifyMessage({
    address: user.primaryAddress,
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

  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { secret } });

  ctx.status = 200;
  ctx.body = {
    message: 'Two-Factor Authentication reset successfully'
  };
}

exports.getUserBasicInfo = async (ctx) => {
  let { address } = ctx.params;

  if (!isAddress(address)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid address'
    };
    return;
  }

  const user = await UserInfo.findOne({ primaryAddress: getAddress(address) });
  if (!user) {
    ctx.status = 404;
    ctx.body = {
      error: 'PLYR[ID] not found'
    };
    return;
  }

  ctx.status = 200;
  ctx.body = {
    plyrId: user.plyrId,
    avatar: user.avatar,
  };
}

exports.getUserBalance = async (ctx) => {
  const user = ctx.state.user;

  const ret = await Promise.all([config.chain.getBalance({
      address: user.mirror,
    }),
    config.chain.readContract({
      abi: erc20Abi,
      address: config.TOKEN_LIST['gamr'].address,
      functionName: "balanceOf",
      args: [user.mirror]
    })
  ]);

  ctx.status = 200;
  ctx.body = {
    plyr: formatEther(ret[0]),
    gamr: formatEther(ret[1]),
  };
}

exports.getUserTokenBalance = async (ctx) => {
  const user = ctx.state.user;
  const tokenAddress = ctx.state.tokenAddress;
  if (tokenAddress === zeroAddress) {
    const ret = await config.chain.getBalance({
      address: user.mirror,
    });
    ctx.status = 200;
    ctx.body = {
      balance: formatEther(ret)
    }
  } else {
    const ret = await Promise.all([
      config.chain.readContract({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: 'balanceOf',
        args: [user.mirror]
      }),
      config.chain.readContract({
        abi: erc20Abi,
        address: tokenAddress,
        functionName: 'decimals',
        args: []
      })
    ]);

    ctx.status = 200;
    ctx.body = {
      balance: formatUnits(ret[0], ret[1])
    }
  }
}

exports.getAvatar = async (ctx) => {
  const user = ctx.state.user;
  const avatar = user.avatar;
  const avatarUrl = getAvatarUrl(avatar);
  ctx.status = 200;
  ctx.body = {
    avatar: avatarUrl,
  };
}