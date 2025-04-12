const GameNft = require('../../models/gameNft');
const Secondary = require('../../models/secondary');
const GameCredit = require('../../models/gameCredit');
const { getRedisClient } = require("../../db/redis");
const { checkTaskStatus } = require("../../services/task");
const { getAddress, erc20Abi, formatEther, verifyMessage, erc721Abi } = require('viem');
const { chain, plyrRouterSC, ROUTER_ABI, CHAIN_CONFIG, gameNftConfig } = require('../../config');
const UserInfo = require('../../models/userInfo');
const { PinataSDK } = require('pinata');

const postNftCreateBySignature = async (ctx) => {
  const { gameId, chainTag, name, symbol, image, signature } = ctx.request.body;
  if (!gameId || !name || !symbol || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'gameId, name, symbol, and chainTag are required' };
    return;
  }

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
  const { chainTag, name, symbol, image } = ctx.request.body;

  if (!name || !symbol || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'name, symbol, and chainTag are required' };
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
  let { chainTag, nfts, addresses, tokenUris, metaJsons } = ctx.request.body;

  if (!nfts || !addresses || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'nfts, addresses, and chainTag are required' };
    return;
  }

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
      const url = await uploadFile(JSON.stringify(metaJsons[i], null, 2), nfts[i] + '_' + timestamp + '_' + i, 'application/json');
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
  const { chainTag, nfts, tokenIds } = ctx.request.body;

  if (!nfts || !tokenIds || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'nfts, tokenIds, and chainTag are required' };
    return;
  }

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
  const { chainTag, nfts, fromAddresses, toAddresses, tokenIds } = ctx.request.body;

  if (!nfts || !fromAddresses || !toAddresses || !tokenIds || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'nfts, fromAddresses, toAddresses, tokenIds, and chainTag are required' };
    return;
  }

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
  const { plyrId, gameId, nft, chainTag } = ctx.query;

  if(!plyrId || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId and chainTag are required' };
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
    const totalBalance = formatEther(mirrorBalance + primaryBalance + secondaryBalances.reduce((acc, { balance }) => acc + balance, 0n));
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
  const { plyrId, gameId, nft, chainTag } = ctx.query;

  if(!plyrId || !gameId || !nft || !chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'plyrId, gameId, nft, and chainTag are required' };
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
  const totalBalance = formatEther(mirrorBalance + primaryBalance + secondaryBalances.reduce((acc, { balance }) => acc + balance, 0n));
  ctx.status = 200;
  ctx.body = { isHolding: totalBalance > 0, balance: totalBalance }; 
}

const getInfo = async (ctx) => {
  const { gameId, nft, chainTag } = ctx.query;

  if(!gameId && !nft) {
    ctx.status = 400;
    ctx.body = { error: 'gameId or nft are required' };
    return;
  }

  if (!chainTag) {
    ctx.status = 400;
    ctx.body = { error: 'chainTag is required' };
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
    transport: http(CHAIN_CONFIG[chainTag].rpcUrls[0]),
  });

  let ret = await Promise.all(gameNfts.map(async (gameNft) => {
    let info = await publicClient.readContract({
      address: plyrRouterSC,
      abi: ROUTER_ABI,
      functionName: 'nftInfo',
      args: [gameNft.nft]
    });

    return {
      gameId: gameNft.gameId,
      nft: gameNft.nft,
      name: gameNft.name,
      symbol: gameNft.symbol,
      image: gameNft.image,
      totalSupply: formatEther(info[4]),
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
  return gameCredit.credit;
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
  let { fileTxt, name, fileType } = ctx.request.body;
  if (!fileTxt || !name || !fileType) {
    ctx.status = 400;
    ctx.body = { error: 'fileTxt, name, and fileType are required' };
    return;
  }

  const url = await uploadFile(fileTxt, name, fileType);
  ctx.status = 200;
  ctx.body = { url };
}

const uploadFile = async (fileTxt, name, fileType) => {
  const pinata = new PinataSDK({
    pinataJwt: process.env.PINATA_JWT,
  });
  
  const file = new File([fileTxt], name, { type: fileType });
  const upload = await pinata.upload.public.file(file).group('2734fd44-7e7a-490e-b35b-f2c8fc01b116');
  console.log('upload', upload);
  return `https://ipfs.plyr.network/ipfs/${upload.cid}`
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