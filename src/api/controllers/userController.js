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
const { approve } = require('./gameController');
const MirrorClaim = require('../../models/mirrorClaim');
const InstantPlayPass = require('../../models/instantPlayPass');
const { logActivity } = require('../../utils/activity');
const redis = getRedisClient();
const { insertPlyrIdToBlockscout } = require('../../db/postgres');

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

  const signatureMessage = `PLYR[ID] Registration`;

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

  await Secondary.deleteMany({ secondaryAddress: getAddress(address) });

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
    await insertPlyrIdToBlockscout(plyrId, mirror);

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
      // task: {
      //   id: messageId,
      //   status: 'PENDING',
      // },
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

exports.postRegisterWithClaimingCode = async (ctx) => {
  let { address, signature, plyrId, secret, chainId, avatar } = ctx.request.body;
  let { claimingCode } = ctx.params;

  if (!address || !signature || !plyrId || !secret || !claimingCode) {
    ctx.status = 400;
    ctx.body = {
      error: 'Address, signature, plyrId, secret, claimingCode are required'
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

  const signatureMessage = `PLYR[ID] Registration with claiming code: ${claimingCode}`;

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

  await Secondary.deleteMany({ secondaryAddress: getAddress(address) });

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

  let claimingCodeUser = await MirrorClaim.findOne({ code: claimingCode.toUpperCase() });
  if (!claimingCodeUser) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid claiming code'
    };
    return;
  }

  const mirror = claimingCodeUser.mirror;

  // remove old user
  await UserInfo.deleteOne({ plyrId: claimingCodeUser.plyrId, isInstantPlayPass: true });

  await UserInfo.create({
    plyrId,
    mirror,
    primaryAddress: getAddress(address),
    secret,
    chainId: chainId || 62831,
    avatar: getAvatarUrl(avatar),
    ippClaimed: true,
  });


  // remove claiming code
  await MirrorClaim.deleteOne({ code: claimingCode.toUpperCase() });
  await InstantPlayPass.updateOne({ plyrId: claimingCodeUser.plyrId }, { $set: { isDeleted: true } });

  if (process.env.NODE_ENV !== 'test') {
    await insertPlyrIdToBlockscout(plyrId, mirror);

    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'createUserWithMirror', JSON.stringify({
      address: getAddress(address),
      mirror,
      plyrId,
      chainId: chainId || 62831,
    }));
    console.log('Added message ID:', messageId);

    ctx.body = {
      plyrId,
      mirrorAddress: mirror,
      primaryAddress: getAddress(address),
      avatar: getAvatarUrl(avatar),
      // task: {
      //   id: messageId,
      //   status: 'PENDING',
      // },
      ippClaimed: true,
    };
  } else {
    ctx.body = {
      plyrId,
      mirrorAddress: mirror,
      primaryAddress: getAddress(address),
      avatar: getAvatarUrl(avatar),
    };
  }
}

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
        ippClaimed: user.ippClaimed,
        isIPP: user.isInstantPlayPass,
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
        ippClaimed: user.ippClaimed,
        isIPP: user.isInstantPlayPass,
      };
    }
  }
}

exports.postModifyAvatar = async (ctx) => {
  const { plyrId, avatar, signature } = ctx.request.body;

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
  await logActivity(plyrId, null, 'user', 'updateAvatar', { avatar });
}

exports.postSecondaryUnbind = async (ctx) => {
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

  const signatureMessage = `PLYR[ID] Secondary Unbind`;

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

  await Secondary.deleteMany({ secondaryAddress: getAddress(secondaryAddress) });

  ctx.status = 200;
  ctx.body = {
    plyrId: plyrId.toLowerCase(),
    secondaryAddress: getAddress(secondaryAddress),
  };
  await logActivity(plyrId, null, 'user', 'secondaryUnbind', { secondaryAddress: getAddress(secondaryAddress) });
}

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

  let secondaryUser = await UserInfo.findOne({ primaryAddress: getAddress(secondaryAddress) });
  if (secondaryUser) {
    ctx.status = 400;
    ctx.body = {
      error: 'You can not bind to this address, because this address is primary address of other user'
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

  await Secondary.deleteMany({ secondaryAddress: getAddress(secondaryAddress) });

  await Secondary.create({
    plyrId: plyrId.toLowerCase(),
    secondaryAddress: getAddress(secondaryAddress),
    boundAt: Date.now(),
  });

  ctx.status = 200;
  ctx.body = {
    plyrId: plyrId.toLowerCase(),
    secondaryAddress: getAddress(secondaryAddress),
  };
  await logActivity(plyrId, null, 'user', 'secondaryBind', { secondaryAddress: getAddress(secondaryAddress) });
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
  delete secondary._id;
  delete secondary.__v;
  ctx.status = 200;
  ctx.body = secondary;
  return;
}

exports.postLogin = async (ctx) => {
  let { plyrId, expiresIn, gameId } = ctx.request.body;
  console.log('postLogin', plyrId, expiresIn, gameId);
  const user = ctx.state.user;
  const userApiKey = ctx.state.apiKey;
  if (!gameId) {
    gameId = userApiKey.plyrId;
  }

  const nonce = user.nonce ? user.nonce : {};
  const deadline = user.deadline ? user.deadline : {};
  let gameNonce = nonce[gameId] ? nonce[gameId] + 1 : 1;
  nonce[gameId] = gameNonce;
  deadline[gameId] = Date.now() + (expiresIn ? expiresIn * 1000 : 86400 * 1000);
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { nonce, deadline, loginFailedCount: 0 } });

  const payload = { plyrId: plyrId.toLowerCase(), nonce: gameNonce, gameId, primaryAddress: user.primaryAddress, mirrorAddress: user.mirror };
  const JWT = generateJwtToken(payload, expiresIn);

  delete payload.nonce;

  ctx.status = 200;
  ctx.body = {
    sessionJwt: JWT,
    ...payload,
    avatar: getAvatarUrl(user.avatar),
    ippClaimed: user.ippClaimed,
    isIPP: user.isInstantPlayPass,
  }
  await logActivity(plyrId, gameId, 'user', 'login', { gameId });
}

exports.postLoginAndApprove = async (ctx) => {
  const { plyrId, expiresIn, gameId, token, tokens, amount, amounts } = ctx.request.body;
  console.log('postLoginAndApprove', plyrId, expiresIn, gameId, token, tokens, amount);
  const user = ctx.state.user;
  const nonce = user.nonce ? user.nonce : {};
  const deadline = user.deadline ? user.deadline : {};
  let gameNonce = nonce[gameId] ? nonce[gameId] + 1 : 1;
  nonce[gameId] = gameNonce;
  deadline[gameId] = Date.now() + (expiresIn ? expiresIn * 1000 : 86400 * 1000);
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { nonce, deadline, loginFailedCount: 0 } });

  const payload = { plyrId: plyrId.toLowerCase(), nonce: gameNonce, gameId, primaryAddress: user.primaryAddress, mirrorAddress: user.mirror };
  const JWT = generateJwtToken(payload, expiresIn);

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
  }

  if (tokens && tokens.length > 0) {
    for (let i = 0; i < tokens.length; i++) {
      if (isNaN(amounts[i]) || Number(amounts[i]) <= 0) {
        ctx.status = 401;
        ctx.body = { error: "Approve amount was incorrect." };
        return;
      }
      await approve({ plyrId, gameId, token: tokens[i].toLowerCase(), amount: amounts[i], expiresIn });
    }
  }

  delete payload.nonce;

  ctx.status = 200;
  ctx.body = {
    sessionJwt: JWT,
    ...payload,
    avatar: getAvatarUrl(user.avatar),
    ippClaimed: user.ippClaimed,
    isIPP: user.isInstantPlayPass,
  }
  await logActivity(plyrId, gameId, 'user', 'loginAndApprove', { gameId, token, amount, expiresIn });
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

  if (user.isInstantPlayPass) {
    ctx.status = 401;
    ctx.body = {
      error: 'Instant Play Pass user cannot logout',
    };
    return;
  }

  const nonce = user.nonce ? user.nonce : {};
  const deadline = user.deadline ? user.deadline : {};
  const gameNonce = nonce[gameId] ? nonce[gameId] : 0;
  if (payload.nonce < gameNonce) {
    ctx.status = 401;
    ctx.body = {
      message: 'JWT nonce is expired',
    };
    return;
  }

  nonce[gameId] = gameNonce + 1;
  deadline[gameId] = 0;
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { nonce, deadline } });

  ctx.status = 200;
  ctx.body = {
    message: 'Logout success',
  };
  await logActivity(plyrId, gameId, 'user', 'logout', {gameId});
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
    payload: {
      ...payload,
      avatar: getAvatarUrl(user.avatar),
      ippClaimed: user.ippClaimed,
      isIPP: user.isInstantPlayPass,
    },
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
  await logActivity(plyrId, null, 'user', 'reset2fa', {});
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
  const tokenList = config.TOKEN_LIST();

  // Create array of promises for all token balances
  const promises = [config.chain.getBalance({
      address: user.mirror,
    })];

  // Track token symbols for mapping results
  const tokenSymbols = ['plyr'];

  // Add balance check for each non-zero address token
  for (const [symbol, tokenInfo] of Object.entries(tokenList)) {
    if (tokenInfo.address !== '0x0000000000000000000000000000000000000000') {
      promises.push(config.chain.readContract({
        abi: erc20Abi,
        address: tokenInfo.address,
        functionName: "balanceOf",
        args: [user.mirror]
      }));
      tokenSymbols.push(symbol);
    }
  }

  const balances = await Promise.all(promises);

  // Format response with all token balances
  const response = {};
  balances.forEach((balance, index) => {
    response[tokenSymbols[index]] = formatEther(balance);
  });

  ctx.status = 200;
  ctx.body = response;
}


exports.getAddressBalance = async (ctx) => {
  const address = ctx.params.address;
  if (!address || !isAddress(address)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid address'
    };
    return;
  }

  const tokenList = config.TOKEN_LIST();

  // Create array of promises for all token balances
  const promises = [config.chain.getBalance({
      address,
  })];

  // Track token symbols for mapping results
  const tokenSymbols = ['plyr'];

  // Add balance check for each non-zero address token
  for (const [symbol, tokenInfo] of Object.entries(tokenList)) {
    if (tokenInfo.address !== '0x0000000000000000000000000000000000000000') {
      promises.push(config.chain.readContract({
        abi: erc20Abi,
        address: tokenInfo.address,
        functionName: "balanceOf",
        args: [address]
      }));
      tokenSymbols.push(symbol);
    }
  }

  const balances = await Promise.all(promises);

  // Format response with all token balances
  const response = {};
  balances.forEach((balance, index) => {
    response[tokenSymbols[index]] = formatEther(balance);
  });

  ctx.status = 200;
  ctx.body = response;
}


exports.getUserTokenBalance = async (ctx) => {
  const user = ctx.state.user;
  const tokenAddress = ctx.state.tokenAddress;
  const { tokenName } = ctx.params;
  if (tokenAddress === zeroAddress) {
    const ret = await config.chain.getBalance({
      address: user.mirror,
    });
    ctx.status = 200;
    ctx.body = {
      [tokenName]: formatEther(ret)
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
      [tokenName]: formatUnits(ret[0], ret[1])
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

exports.getActiveSessions = async (ctx) => {
  const user = ctx.state.user;
  console.log('User object:', user);  // Log the entire user object
  const deadline = user.deadline ? user.deadline : {};
  console.log('Deadline object:', deadline);  // Log the deadline object
  const now = Date.now();
  console.log('Current timestamp:', now);  // Log the current timestamp
  const activeSessions = Object.entries(deadline)
    .filter(([gameId, timestamp]) => {
      const isActive = timestamp > now;
      console.log(`Session ${gameId}: timestamp ${timestamp}, isActive: ${isActive}`);  // Log each session's status
      return isActive;
    })
    .reduce((acc, [gameId, timestamp]) => {
      acc[gameId] = timestamp;
      return acc;
    }, {});
  console.log('Active sessions:', activeSessions);  // Log the final result
  ctx.status = 200;
  ctx.body = {
    activeSessions
  };
}

exports.postDiscardSessionBySignature = async (ctx) => {
  const { plyrId, gameId, signature } = ctx.request.body;
  const signatureMessage = `PLYR[ID] Discard Session ${gameId.toUpperCase()}`;

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
  
  const deadline = user.deadline ? user.deadline : {};
  delete deadline[gameId];
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { deadline } });

  ctx.status = 200;
  ctx.body = {
    message: 'Session discarded successfully'
  };
  await logActivity(plyrId, gameId, 'user', 'discardSession', { gameId });
}

exports.postDiscardSessionBy2fa = async (ctx) => {
  const { plyrId, gameId } = ctx.request.body;
  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = {
      error: 'User not found'
    };
    return;
  }

  const deadline = user.deadline ? user.deadline : {};
  delete deadline[gameId];
  await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { deadline } });

  ctx.status = 200;
  ctx.body = {
    message: 'Session discarded successfully'
  };
  await logActivity(plyrId, gameId, 'user', 'discardSession', { gameId });
}

exports.postAddDepositLog = async (ctx) => {
  const { plyrId, gameId, token, amount, hash } = ctx.request.body;
  await logActivity(plyrId, gameId, 'user', 'deposit', { token, amount, hash });
  ctx.status = 200;
  ctx.body = {
    message: 'Deposit log added successfully'
  };
}

exports.getAvatars = async (ctx) => {
  const { plyrIds } = ctx.request.body;

  // Add validation
  if (!Array.isArray(plyrIds)) {
    ctx.status = 400;
    ctx.body = {
      error: 'plyrIds must be an array'
    };
    return;
  }

  // Convert all plyrIds to lowercase for case-insensitive search
  const normalizedPlyrIds = plyrIds.map(id => id.toLowerCase());

  const avatars = await UserInfo.find({ plyrId: { $in: normalizedPlyrIds } }, 'plyrId avatar');
  ctx.status = 200;
  ctx.body = {
    avatars: avatars.map(avatar => ({
      plyrId: avatar.plyrId,
      avatar: getAvatarUrl(avatar.avatar),
    })),
  };
}