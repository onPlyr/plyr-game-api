const GameNft = require('../../models/gameNft');
const Secondary = require('../../models/secondary');
const GameCredit = require('../../models/gameCredit');
const GameBadgeCollection = require('../../models/gameBadgeCollection');
const GameBadgeRule = require('../../models/gameBadgeRule');
const { getRedisClient } = require("../../db/redis");
const { checkTaskStatus } = require("../../services/task");
const { getAddress, verifyMessage, erc721Abi, createPublicClient, http } = require('viem');
const { CHAIN_CONFIG, gameNftConfig, GAME_NFT_FACTORY_ABI, GAME_NFT_ABI, localChainTag } = require('../../config');
const UserInfo = require('../../models/userInfo');
const { PinataSDK } = require('pinata');
const { getChainTag } = require('../middlewares/checkChainId');
const { getMetaJson } = require('./nftController');
const gameBadge = require('../../models/gameBadge');

const MAX_BATCH_SIZE = 10; // max batch mint size for fuji and avalanche

const postBadgeInitBySignature = async (ctx) => {
  const { gameId, signature } = ctx.request.body;
  if (!gameId || !signature) {
    ctx.status = 400;
    ctx.body = { error: 'gameId and signature are required' };
    return;
  }

  const user = await UserInfo.findOne({plyrId: gameId.toLowerCase()});
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }

  let collection = await GameBadgeCollection.findOne({gameId});
  if (collection) {
    ctx.status = 400;
    ctx.body = { error: 'badge collection already exists' };
    return;
  }

  const signatureMessage = `Initialize game badge for ${gameId.toUpperCase()}`;

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

  const ret = await insertTask({ gameId: gameId.toLowerCase(), name: gameId.toUpperCase() + '-BADGE', symbol: gameId.toUpperCase() + '-BADGE' }, 'createGameBadge', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postBadgeInit = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;

  let collection = await GameBadgeCollection.findOne({gameId});
  if (collection) {
    ctx.status = 400;
    ctx.body = { error: 'badge collection already exists' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), name: gameId.toUpperCase() + '-BADGE', symbol: gameId.toUpperCase() + '-BADGE' }, 'createGameBadge', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const getBadgeIsInited = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;

  let collection = await GameBadgeCollection.findOne({gameId});
  if (collection) {
    ctx.status = 200;
    ctx.body = { isInited: true };
    return;
  }

  ctx.status = 200;
  ctx.body = { isInited: false };
}

const postBadgeCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { name, description, slug, image, attributes } = ctx.request.body;

  if (!name || !description || !slug) {
    ctx.status = 400;
    ctx.body = { error: 'name, description, and slug are required' };
    return;
  }

  let collection = await GameBadgeCollection.findOne({gameId});
  if (!collection) {
    ctx.status = 404;
    ctx.body = { error: 'badge collection not initialized' };
    return;
  }

  await GameBadgeRule.create({
    gameId,
    contractAddress: collection.badgeCollection,
    slug,
    name,
    description,
    image,
    attributes: attributes ? attributes : [],
  });

  ctx.status = 200;
  ctx.body = { success: true };
}

const postBadgeMint = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  let { plyrIds, slugs } = ctx.request.body;

  if (!plyrIds || !slugs) {
    ctx.status = 400;
    ctx.body = { error: 'plyrIds and slugs are required' };
    return;
  }

  const chainTag = ctx.state.chainTag;
  if (plyrIds.length > MAX_BATCH_SIZE) {
    ctx.status = 400;
    ctx.body = { error: `plyrIds length must be less than ${MAX_BATCH_SIZE}` };
    return;
  }

  if (plyrIds.length !== slugs.length) {
    ctx.status = 400;
    ctx.body = { error: 'plyrIds and slugs must be the same length' };
    return;
  }

  let metaJsons = [];
  let addresses = [];
  for (let i = 0; i < plyrIds.length; i++) {
    let rule = await GameBadgeRule.findOne({gameId, slug: slugs[i].toLowerCase()});
    if (!rule) {
      ctx.status = 404;
      ctx.body = { error: 'badge rule not found' };
      return;
    }
    let plyr = await UserInfo.findOne({plyrId: plyrIds[i].toLowerCase()});
    if (!plyr) {
      ctx.status = 404;
      ctx.body = { error: 'user not found' };
      return;
    }
    addresses.push(plyr.mirror);
    metaJsons.push({
      name: rule.name,
      slug: rule.slug,
      image: rule.image,
      attributes: [
        {
          trait_type: 'SLUG',
          value: rule.slug
        },
        ...rule.attributes,
      ],
    });
  }

  let tokenUris = [];
  for (let i = 0; i < metaJsons.length; i++) {
    const url = await uploadFile(metaJsons[i], 'application/json');
    tokenUris.push(url);
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), plyrIds, slugs, addresses, tokenUris, metaJsons }, 'mintGameBadge', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postBadgeBurn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { plyrIds, slugs, tokenIds } = ctx.request.body;

  if (!plyrIds || !slugs || !tokenIds) {
    ctx.status = 400;
    ctx.body = { error: 'plyrIds, slugs, and tokenIds are required' };
    return;
  }

  if (plyrIds.length > MAX_BATCH_SIZE) {
    ctx.status = 400;
    ctx.body = { error: `plyrIds length must be less than ${MAX_BATCH_SIZE}` };
    return;
  }

  if (tokenIds.length !== plyrIds.length) {
    ctx.status = 400;
    ctx.body = { error: 'tokenIds and plyrIds must be the same length' };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), plyrIds, slugs, tokenIds }, 'burnGameBadge', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const getList = async (ctx) => {
  const { plyrId, gameId } = ctx.query;

  if(!plyrId || !gameId) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId and gameId are required' };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }
  
  // Build query object with only defined filters
  const query = { plyrId: plyrId.toLowerCase() };
  
  // Only add gameId to query if it's defined
  if (gameId !== undefined) {
    query.gameId = gameId.toLowerCase();
  }
  
  const gameBadges = await gameBadge.find(query);
  if (!gameBadges || gameBadges.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'badge not found' };
    return;
  }

  ctx.status = 200;
  ctx.body = gameBadges;
}

const getInfo = async (ctx) => {
  const { gameId, slug } = ctx.query;

  let query = {};
  if (gameId) {
    query.gameId = gameId.toLowerCase();
  }
  if (slug) {
    query.slug = slug.toLowerCase();
  }
  const gameBadgeRules = await GameBadgeRule.find(query);
  if (!gameBadgeRules || gameBadgeRules.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'badge not found' };
    return;
  }

  const ret = [];
  for (let i=0; i<gameBadgeRules.length; i++) {
    let rule = gameBadgeRules[i];
    let badges = await gameBadge.find({gameId: rule.gameId, slug: rule.slug});
    let uniqueHolders = new Set();
    for (let j=0; j<badges.length; j++) {
      uniqueHolders.add(badges[j].plyrId);
    }
    ret.push({
      gameId: rule.gameId,
      contractAddress: rule.contractAddress,
      name: rule.name,
      description: rule.description,
      slug: rule.slug,
      image: rule.image,
      attributes: rule.attributes,
      createdAt: rule.createdAt,
      holders: uniqueHolders.size,
      count: badges.length,
    });
  }

  ctx.status = 200;
  ctx.body = ret;
}

const insertTask = async (params, taskName, sync = false) => {
  const redis = getRedisClient();
  const STREAM_KEY = 'mystream';
  const taskId = await redis.xadd(STREAM_KEY, '*', taskName, JSON.stringify(params));
  if (sync) {
    let retry = 0;
    while (retry < 50) {
      let ret = await checkTaskStatus(taskId);
      if (ret.status === 'PENDING' || ret.status === 'NOT_FOUND') {
        retry++;
        await new Promise(resolve => setTimeout(resolve, 500));
        continue;
      }
      return ret;
    }
    return {
      taskId,
      status: 'TIMEOUT',
      errorMessage: 'Task timeout, but still maybe success, you can check the task status by taskId later',
    };
  }
  return taskId;
}

const uploadFile = async (content, fileType) => {
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
  });

  const groupId = '2734fd44-7e7a-490e-b35b-f2c8fc01b116';

  if (fileType === 'application/json') {
    const upload = await pinata.upload.public.json(content).group(groupId);
    console.log('upload', upload);
    return `https://ipfs.plyr.network/ipfs/${upload.cid}`;
  } else {
    // use base64
    const upload = await pinata.upload.public.base64(content).group(groupId);
    console.log('upload', upload);
    return `https://ipfs.plyr.network/ipfs/${upload.cid}`;
  }
}

module.exports = {
  postBadgeInit,
  postBadgeInitBySignature,
  getBadgeIsInited,
  postBadgeCreate,
  postBadgeMint,
  postBadgeBurn,
  getList,
  getInfo,
}