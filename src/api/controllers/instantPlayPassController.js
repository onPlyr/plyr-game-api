const { ethers } = require('ethers');
const { faker } = require('@faker-js/faker');
const UserInfo = require('../../models/userInfo');
const InstantPlayPass = require('../../models/instantPlayPass');
const MirrorClaim = require('../../models/mirrorClaim');
const { verifyPlyrid, getAvatarUrl, generateRandomNumber } = require('../../utils/utils');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { getAddress } = require('viem');
const { getRedisClient } = require('../../db/redis');
const { generateJwtToken } = require('../../utils/jwt');
const redis = getRedisClient();
const { approve } = require('./gameController');



async function createRandomAddress() {
  const wallet = ethers.Wallet.createRandom();
  const keystoreJson = await wallet.encrypt(process.env.PLAYPASS_SECRET);
  return {
    address: wallet.address,
    keystoreJson,
  };
}

async function getPrivateKey(keystoreJson) {
  const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, process.env.PLAYPASS_SECRET);
  return wallet.privateKey;
}

const randomUsername = (hexDigits) => {
  const generateParts = () => {
    const firstPart = faker.color.human().toLowerCase().replace(/[\s-]+/g, '_');
    const secondPart = faker.food.fruit().toLowerCase().replace(/[\s-]+/g, '_');
    return { firstPart, secondPart };
  };

  let firstPart, secondPart;
  do {
    ({ firstPart, secondPart } = generateParts());
  } while (!/^[a-z_]+$/.test(`${firstPart}_${secondPart}`));

  const username = `${firstPart}_${secondPart}_${hexDigits}`;
  return username;
}

exports.postRegister = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { tokens } = ctx.request.body;

  const account = await createRandomAddress();
  const plyrId = randomUsername(account.address.slice(-6)).toLowerCase();
  console.log('Instant Play Pass Register', plyrId, gameId, account.address);

  let ret = await UserInfo.findOne({ plyrId });
  if (ret && ret.plyrId === plyrId) {
    ctx.status = 400;
    ctx.body = {
      error: 'PLYR[ID] already exists'
    };
    console.log('ret', ret);
    return;
  }

  const mirror = calcMirrorAddress(account.address);

  const nonce = {
    [gameId]: 1,
  }

  const expiresIn = 86400 * 365 * 30 * 1000;

  const deadline = {
    [gameId]: Date.now() + expiresIn,
  }

  await UserInfo.create({
    plyrId,
    mirror: mirror,
    primaryAddress: getAddress(account.address),
    secret: 'null',
    chainId: 16180,
    avatar: getAvatarUrl(),
    nonce,
    deadline,
    isInstantPlayPass: true,
  });

  await InstantPlayPass.create({
    plyrId,
    gameId,
    primaryAddress: getAddress(account.address),
    mirror,
    keystoreJson: account.keystoreJson,
  });

  // login and approve tokens 
  const payload = { plyrId: plyrId.toLowerCase(), nonce: nonce[gameId], gameId, primaryAddress: getAddress(account.address), mirrorAddress: mirror };
  const JWT = generateJwtToken(payload, expiresIn);
  const amount = 100000000;

  for (const token of tokens) {
    await approve({ plyrId, gameId, token: token.toLowerCase(), amount, expiresIn });
  }

  delete payload.nonce;

  if (process.env.NODE_ENV !== 'test') {
    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'createUser', JSON.stringify({
      address: getAddress(account.address),
      plyrId,
      chainId: 16180,
    }));
    console.log('Added message ID:', messageId);

    ctx.body = {
      sessionJwt: JWT,
      ...payload,
      avatar: getAvatarUrl(),
      task: {
        id: messageId,
        status: 'PENDING',
      },
    };
  } else {
    ctx.body = {
      sessionJwt: JWT,
      ...payload,
      avatar: getAvatarUrl(),
    };
  }
}

exports.postRevealClaimingCode = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const user = ctx.state.user;
  if (!user.isInstantPlayPass) {
    ctx.status = 401;
    ctx.body = {
      error: 'Only Instant Play Pass user can reveal claiming code',
    };
    return;
  }

  let random = generateRandomNumber(8, 1);
  random = random[0].toUpperCase();
  // change random to AABB-CCDD-EEFF-1122 format, remove tail -
  random = random.replace(/(.{4})/g, '$1-').slice(0, -1);

  // upsert mirror claim
  await MirrorClaim.updateOne({
    plyrId: user.plyrId,
    gameId,
  }, {
    plyrId: user.plyrId,
    gameId,
    mirror: user.mirror,
    primaryAddress: user.primaryAddress,
    code: random,
  }, {
    upsert: true,
  });

  ctx.body = {
    plyrId: user.plyrId,
    gameId,
    mirror: user.mirror,
    primaryAddress: user.primaryAddress,
    claimingCode: random,
    claimingUrl: `${process.env.FRONTEND_URL}/signup?claimingCode=${random}`,
  };
}

exports.postRevealPrivateKey = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const user = ctx.state.user;
  if (!user.isInstantPlayPass) {
    ctx.status = 401;
    ctx.body = {
      error: 'Only Instant Play Pass user can reveal claiming code',
    };
    return;
  }

  const instantPlayPass = await InstantPlayPass.findOne({
    plyrId: user.plyrId,
    gameId,
  });

  if (!instantPlayPass) {
    ctx.status = 404;
    ctx.body = {
      error: 'Instant Play Pass not found',
    };
    return;
  }
  console.log('revealing private key', user.plyrId, gameId);
  const pk = await getPrivateKey(instantPlayPass.keystoreJson);
  console.log('decrypted private key', pk.slice(0, 6) + '...' + pk.slice(-4));

  ctx.body = {
    plyrId: user.plyrId,
    gameId,
    mirror: user.mirror,
    primaryAddress: user.primaryAddress,
    privateKey: pk,
  };
}

exports.getVerifyClaimingCode = async (ctx) => {
  const { code } = ctx.params;
  const mirrorClaim = await MirrorClaim.findOne({
    code: code.toUpperCase(),
  });

  if (!mirrorClaim) {
    ctx.status = 404;
    ctx.body = {
      error: 'Claiming code not found',
    };
  }

  ctx.body = {
    plyrId: mirrorClaim.plyrId,
    verified: true,
  };
}