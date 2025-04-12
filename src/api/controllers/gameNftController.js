const GameNft = require('../../models/gameNft');
const Secondary = require('../../models/secondary');
const GameCredit = require('../../models/gameCredit');
const { getRedisClient } = require("../../db/redis");
const { checkTaskStatus } = require("../../services/task");
const { getAddress, verifyMessage, erc721Abi, createPublicClient, http } = require('viem');
const { CHAIN_CONFIG, gameNftConfig, GAME_NFT_FACTORY_ABI } = require('../../config');
const UserInfo = require('../../models/userInfo');
const { PinataSDK } = require('pinata');
const { getChainTag } = require('../middlewares/checkChainId');

const postNftCreateBySignature = async (ctx) => {
  const { gameId, name, symbol, image, signature } = ctx.request.body;
  if (!gameId || !name || !symbol) {
    ctx.status = 400;
    ctx.body = { error: 'gameId, name, symbol, and chainId are required' };
    return;
  }

  const chainTag = ctx.state.chainTag;

  const user = await UserInfo.findOne({plyrId: gameId.toLowerCase()});
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }

  const signatureMessage = `Create game nft for ${gameId.toUpperCase()} ${name} ${symbol}`;

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

  try {
    await costCredit(gameId, chainTag, 'create');
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: error.message };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chainTag, name, symbol, image: image || '' }, 'createGameNft', true);
  if (ret.status === 'SUCCESS') {
    const { nft } = ret.taskData;
    await GameNft.updateOne({ gameId, nft, chainTag }, { $set: { image } });
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postNftCreate = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { name, symbol, image } = ctx.request.body;
  const chainTag = ctx.state.chainTag;

  if (!name || !symbol) {
    ctx.status = 400;
    ctx.body = { error: 'name, symbol, and chainId are required' };
    return;
  }

  try {
    await costCredit(gameId, chainTag, 'create');
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: error.message };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chainTag, name, symbol, image: image || '' }, 'createGameNft', true);
  if (ret.status === 'SUCCESS') {
    const { nft } = ret.taskData;
    await GameNft.updateOne({ gameId, nft, chainTag }, { $set: { image } });
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postNftMint = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  let { nfts, addresses, tokenUris, metaJsons } = ctx.request.body;

  if (!nfts || !addresses) {
    ctx.status = 400;
    ctx.body = { error: 'nfts, addresses, and chainId are required' };
    return;
  }

  const chainTag = ctx.state.chainTag;

  if (!tokenUris && !metaJsons) {
    ctx.status = 400;
    ctx.body = { error: 'tokenUris or metaJsons are required' };
    return;
  }

  if (addresses.length !== tokenUris.length) {
    ctx.status = 400;
    ctx.body = { error: 'addresses and tokenUris must be the same length' };
    return;
  }

  if (metaJsons && metaJsons.length !== addresses.length) {
    ctx.status = 400;
    ctx.body = { error: 'addresses and metaJsons must be the same length' };
    return;
  }

  const isBelong = await isNftsBelongToGame(gameId, nfts, chainTag);
  if (!isBelong) {
    ctx.status = 400;
    ctx.body = { error: 'nfts do not belong to this game' };
    return;
  }

  const timestamp = Date.now();
  if (metaJsons && !tokenUris) {
    tokenUris = [];
    for (let i = 0; i < metaJsons.length; i++) {
      const url = await uploadFile(metaJsons[i], 'application/json');
      tokenUris.push(url);
    }
  }

  try {
    await costCredit(gameId, chainTag, 'mint');
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: error.message };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chainTag, nfts, addresses, tokenUris }, 'mintGameNft', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postNftBurn = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { nfts, tokenIds } = ctx.request.body;

  if (!nfts || !tokenIds) {
    ctx.status = 400;
    ctx.body = { error: 'nfts, tokenIds, and chainId are required' };
    return;
  }

  const chainTag = ctx.state.chainTag;

  if (tokenIds.length !== nfts.length) {
    ctx.status = 400;
    ctx.body = { error: 'tokenIds and nfts must be the same length' };
    return;
  }

  const isBelong = await isNftsBelongToGame(gameId, nfts, chainTag);
  if (!isBelong) {
    ctx.status = 400;
    ctx.body = { error: 'nfts do not belong to this game' };
    return;
  }

  try {
    await costCredit(gameId, chainTag, 'burn');
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: error.message };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chainTag, nfts, tokenIds }, 'burnGameNft', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const postNftTransfer = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  const { nfts, fromAddresses, toAddresses, tokenIds } = ctx.request.body;

  if (!nfts || !fromAddresses || !toAddresses || !tokenIds) {
    ctx.status = 400;
    ctx.body = { error: 'nfts, fromAddresses, toAddresses, tokenIds, and chainId are required' };
    return;
  }

  const chainTag = ctx.state.chainTag;

  if (fromAddresses.length !== tokenIds.length || toAddresses.length !== tokenIds.length) {
    ctx.status = 400;
    ctx.body = { error: 'fromAddresses, toAddresses, and tokenIds must be the same length' };
    return;
  }

  const isBelong = await isNftsBelongToGame(gameId, nfts, chainTag);
  if (!isBelong) {
    ctx.status = 400;
    ctx.body = { error: 'nfts do not belong to this game' };
    return;
  }

  try {
    await costCredit(gameId, chainTag, 'transfer');
  } catch (error) {
    ctx.status = 400;
    ctx.body = { error: error.message };
    return;
  }

  const ret = await insertTask({ gameId: gameId.toLowerCase(), chainTag, nfts, fromAddresses, toAddresses, tokenIds }, 'transferGameNft', true);
  if (ret.status === 'SUCCESS') {
    ctx.status = 200;
    ctx.body = ret;
  } else {
    ctx.status = 500;
    ctx.body = { error: ret.errorMessage };
  }
}

const isNftsBelongToGame = async (gameId, nfts, chainTag) => {
  for (let i = 0; i < nfts.length; i++) {
    const nft = nfts[i];
    const gameNft = await GameNft.findOne({ gameId: gameId.toLowerCase(), nft: getAddress(nft), chainTag });
    if (!gameNft) {
      return false;
    }
  }
  return true;
}

const getBalance = async (ctx) => {
  const { plyrId, gameId, nft, chainId } = ctx.query;

  if(!plyrId || !chainId) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId and chainId are required' };
    return;
  }

  const chainTag = getChainTag(chainId);
  if (!chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid chainId' };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }
  
  // Build query object with only defined filters
  const query = { chainTag };
  
  // Only add gameId to query if it's defined
  if (gameId !== undefined) {
    query.gameId = gameId.toLowerCase();
  }
  
  // Only add nft to query if it's defined
  if (nft !== undefined) {
    query.nft = getAddress(nft);
  }
  
  // Execute the query with only the defined filters
  const gameNfts = await GameNft.find(query);
  if (!gameNfts || gameNfts.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'nft not found' };
    return;
  }

  const publicClient = await createPublicClient({
    chain: CHAIN_CONFIG[chainTag].chain,
    transport: http(CHAIN_CONFIG[chainTag].rpcUrls[0]),
  });

  let balances = await Promise.all(gameNfts.map(async (gameNft)=>{
    const mirrorBalance = await publicClient.readContract({
      address: gameNft.nft,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [user.mirror]
    });
    const primaryBalance = await publicClient.readContract({
      address: gameNft.nft,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [user.primaryAddress]
    });
    const secondaries = await Secondary.find({plyrId: plyrId.toLowerCase()});
    const secondaryBalances = await Promise.all(secondaries.map(async (secondary) => {
      const balance = await publicClient.readContract({
        address: gameNft.nft,
        abi: erc721Abi,
        functionName: 'balanceOf',
        args: [secondary.secondaryAddress]
      });
      return {
        balance
      };
    }));
    const totalBalance = (mirrorBalance + primaryBalance + secondaryBalances.reduce((acc, { balance }) => acc + balance, 0n)).toString();
    return {
      gameId: gameNft.gameId,
      name: gameNft.name,
      symbol: gameNft.symbol,
      nft: gameNft.nft,
      balance: totalBalance
    };
  }));

  let ret = {};
  balances.map((item)=>{
    if (!ret[item.gameId]) {
      ret[item.gameId] = {};
    }

    ret[item.gameId][item.nft] = {
      name: item.name,
      symbol: item.symbol,
      balance: item.balance,
    };
  })
  
  ctx.status = 200;
  ctx.body = ret;
}

const getIsHolding = async (ctx) => {
  const { plyrId, gameId, nft, chainId } = ctx.query;

  if(!plyrId || !gameId || !nft || !chainId) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId, gameId, nft, and chainId are required' };
    return;
  }

  const chainTag = getChainTag(chainId);
  if (!chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid chainId' };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'user not found' };
    return;
  }

  const gameNft = await GameNft.findOne({ gameId: gameId.toLowerCase(), nft: getAddress(nft), chainTag });
  if (!gameNft) {
    ctx.status = 404;
    ctx.body = { error: 'nft not found' };
    return;
  }

  const publicClient = await createPublicClient({
    chain: CHAIN_CONFIG[chainTag].chain,
    transport: http(CHAIN_CONFIG[chainTag].rpcUrls[0]),
  });

  const mirrorBalance = await publicClient.readContract({
    address: gameNft.nft,
    abi: erc721Abi,
    functionName: 'balanceOf',
    args: [user.mirror]
  });
  const primaryBalance = await publicClient.readContract({
    address: gameNft.nft,
    abi: erc721Abi,
    functionName: 'balanceOf',
    args: [user.primaryAddress]
  });
  const secondaries = await Secondary.find({plyrId: plyrId.toLowerCase()});
  const secondaryBalances = await Promise.all(secondaries.map(async (secondary) => {
    const balance = await publicClient.readContract({
      address: gameNft.nft,
      abi: erc721Abi,
      functionName: 'balanceOf',
      args: [secondary.secondaryAddress]
    });
    return {
      balance
    };
  }));
  const totalBalance = (mirrorBalance + primaryBalance + secondaryBalances.reduce((acc, { balance }) => acc + balance, 0n)).toString();
  ctx.status = 200;
  ctx.body = { isHolding: totalBalance > 0, balance: totalBalance }; 
}

const getInfo = async (ctx) => {
  const { gameId, nft, chainId } = ctx.query;

  if(!gameId && !nft) {
    ctx.status = 400;
    ctx.body = { error: 'gameId or nft are required' };
    return;
  }

  const chainTag = getChainTag(chainId);
  if (!chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'Invalid chainId' };
    return;
  }

  let query = {chainTag};
  if (gameId) {
    query.gameId = gameId.toLowerCase();
  }
  if (nft) {
    query.nft = getAddress(nft);
  }
  const gameNfts = await GameNft.find(query);
  if (!gameNfts || gameNfts.length === 0) {
    ctx.status = 404;
    ctx.body = { error: 'nft not found' };
    return;
  }

  const publicClient = await createPublicClient({
    chain: CHAIN_CONFIG[chainTag].chain,
    transport: http(CHAIN_CONFIG[chainTag].rpcUrls[0]),
  });

  let ret = await Promise.all(gameNfts.map(async (gameNft) => {
    let info = await publicClient.readContract({
      address: gameNftConfig[chainTag].gameNftFactory,
      abi: GAME_NFT_FACTORY_ABI,
      functionName: 'nftInfo',
      args: [gameNft.nft]
    });

    return {
      gameId: gameNft.gameId,
      nft: gameNft.nft,
      name: gameNft.name,
      symbol: gameNft.symbol,
      image: gameNft.image,
      totalSupply: info[4].toString(),
      holderCount: info[5].toString(),
    };
  }));

  ctx.status = 200;
  ctx.body = ret;
}

const getCredit = async (ctx) => {
  const gameId = ctx.state.apiKey.plyrId;
  let gameCredit = await GameCredit.findOne({ gameId: gameId.toLowerCase() });
  if (!gameCredit) {
    await GameCredit.create({ gameId: gameId.toLowerCase() });
    gameCredit = await GameCredit.findOne({ gameId: gameId.toLowerCase() });
  }
  ctx.status = 200;
  ctx.body = { credit: gameCredit.credit };
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

const costCredit = async (gameId, chainTag, method) => {
  let gameCredit = await GameCredit.findOne({ gameId: gameId.toLowerCase() });
  if (!gameCredit) {
    await GameCredit.create({ gameId: gameId.toLowerCase() });
    gameCredit = await GameCredit.findOne({ gameId: gameId.toLowerCase() });
  }

  const cost = method === 'create' ? gameNftConfig[chainTag].createCredit : gameNftConfig[chainTag].mintCredit;
  if (gameCredit.credit < cost) {
    throw new Error('not enough credit');
  }

  await GameCredit.updateOne({ gameId: gameId.toLowerCase() }, { $inc: { credit: -cost } });
}

const postUploadFile = async (ctx) => {
  let { content, fileType } = ctx.request.body;
  if (!content || !fileType) {
    ctx.status = 400;
    ctx.body = { error: 'content and fileType are required' };
    return;
  }

  const url = await uploadFile(content, fileType);
  ctx.status = 200;
  ctx.body = { url };
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
  postNftCreate,
  postNftMint,
  postNftBurn,
  postNftTransfer,
  getBalance,
  getInfo,
  getIsHolding,
  getCredit,
  isNftsBelongToGame,
  postNftCreateBySignature,
  postUploadFile,
}