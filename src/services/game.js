const { chain, gameRuleV1SC, GAME_RULE_V1_ABI } = require('../config');
const { encodeFunctionData, erc20Abi, isAddress, parseUnits, decodeEventLog } = require('viem');
const { TOKEN_LIST } = require('../config');
const UserApprove = require('../models/userApprove');
const GameRoom = require('../models/gameRoom');
const { sendAndWaitTx } = require('../utils/tx');
const { logActivity } = require('../utils/activity');

async function create({gameId, expiresIn}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'create',
    args: [
      gameId,
      expiresIn,
    ]
  });

  const hash = receipt.transactionHash;

  console.log('create receipt:', receipt);
  if (receipt.status !== 'success') {
    await logActivity(gameId, gameId, 'game', 'create', { gameId, hash, success: receipt.status });
    throw new Error('Transaction failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: GAME_RULE_V1_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'GameRoomCreated') {
        const { gameId, roomId, roomAddress } = decodedLog.args;
        await GameRoom.updateOne({ gameId, roomId }, { $set: { gameId, roomId: roomId.toString(), roomAddress } }, { upsert: true });
        result = { gameId, roomId: roomId.toString(), roomAddress };
        await logActivity(gameId, gameId, 'game', 'create', { gameId, roomId: roomId.toString(), roomAddress, hash, success: receipt.status });
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function join({plyrIds, gameId, roomId}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'join',
    args: [
      gameId,
      roomId,
      plyrIds,
    ]
  });

  const hash = receipt.transactionHash;
  console.log('join receipt:', receipt);
  for (let plyrId of plyrIds) {
    await logActivity(plyrId, gameId, 'game', 'join', { gameId, roomId, hash, success: receipt.status });
  }
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }
  return {hash, result};
}

async function isJoined({plyrId, gameId, roomId}) {
  let ret = await chain.readContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'isJoined',
    args: [
      gameId,
      roomId,
      plyrId,
    ]
  });
  console.log("isJoined", {plyrId, gameId, roomId, ret});
  return ret;
}

async function leave({plyrIds, gameId, roomId}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'leave',
    args: [
      gameId,
      roomId,
      plyrIds,
    ]
  });

  const hash = receipt.transactionHash;
  console.log('leave receipt:', receipt);
  for (let plyrId of plyrIds) {
    await logActivity(plyrId, gameId, 'game', 'leave', { gameId, roomId, hash, success: receipt.status });
  }

  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }
  return {hash, result};
}

async function pay({plyrId, gameId, roomId, token, amount}) {
  let result = {};
  let tokenAddress;
  let decimals;
  if (isAddress(token)) {
    tokenAddress = token;
    if (token === zeroAddress) {
      decimals = 18;
    } else {
      decimals = await chain.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
        args: [],
      });
    }
  } else if (TOKEN_LIST[token.toLowerCase()]) {
    tokenAddress = TOKEN_LIST[token.toLowerCase()].address;
    decimals = TOKEN_LIST[token.toLowerCase()].decimals;
  } else {
    throw new Error('Invalid token: ' + token);
  }

  console.log('request pay', {gameId, roomId, plyrId, tokenAddress, amount, decimals});

  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'pay',
    args: [
      gameId,
      roomId,
      plyrId,
      tokenAddress, 
      parseUnits(amount.toString(), decimals),
    ]
  });

  const hash = receipt.transactionHash;
  await logActivity(plyrId, gameId, 'game', 'pay', { gameId, roomId, token: token.toLowerCase(), amount, hash, success: receipt.status });
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  } else {
    // update userApprove sub amount
    const userApprove = await UserApprove.findOne({ gameId, plyrId, token });
    if (userApprove) {
      if (userApprove.amount >= amount) {
        await UserApprove.updateOne({ gameId, plyrId, token }, { $inc: { amount: -amount } });
      } else {
        await UserApprove.deleteOne({ gameId, plyrId, token });
      }
    }
  }

  console.log('pay receipt:', receipt);
  
  return {hash, result};
}

async function earn({plyrId,gameId, roomId, token, amount}) {
  let result = {};
  let tokenAddress;
  let decimals;
  if (isAddress(token)) {
    tokenAddress = token;
    if (token === zeroAddress) {
      decimals = 18;
    } else {
      decimals = await chain.readContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: 'decimals',
        args: [],
      });
    }
  } else if (TOKEN_LIST[token.toLowerCase()]) {
    tokenAddress = TOKEN_LIST[token.toLowerCase()].address;
    decimals = TOKEN_LIST[token.toLowerCase()].decimals;
  } else {
    throw new Error('Invalid token: ' + token);
  }

  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'earn',
    args: [
      gameId,
      roomId,
      plyrId,
      tokenAddress, 
      parseUnits(amount.toString(), decimals),
    ]
  });

  const hash = receipt.transactionHash;

  console.log('earn receipt:', receipt);
  await logActivity(plyrId, gameId, 'game', 'earn', { gameId, roomId, token: token.toLowerCase(), amount, hash, success: receipt.status });
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }
  return {hash, result};
}

async function end({gameId, roomId}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'end',
    args: [
      gameId,
      roomId,
    ]
  });

  const hash = receipt.transactionHash;

  console.log('end receipt:', receipt);
  await logActivity(gameId, gameId, 'game', 'end', { gameId, roomId, hash, success: receipt.status });

  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }
  return {hash, result};
}

async function close({gameId, roomId}) {
  let result = {};
  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'close',
    args: [
      gameId,
      roomId,
    ]
  });

  const hash = receipt.transactionHash;

  console.log('close receipt:', receipt);
  await logActivity(gameId, gameId, 'game', 'close', { gameId, roomId, hash, success: receipt.status });
  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }
  return {hash, result};
}

async function createJoinPay({gameId, expiresIn, plyrIds, tokens, amounts}) {
  let result = {};
  let _tokens = [];
  let _amounts = [];
  for (let i=0; i<tokens.length; i++) {
    const token = tokens[i];
    const amount = amounts[i];
    let tokenAddress;
    let decimals;
    if (isAddress(token)) {
      tokenAddress = token;
      if (token === zeroAddress) {
        decimals = 18;
      } else {
        decimals = await chain.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'decimals',
          args: [],
        });
      }
    } else if (TOKEN_LIST[token.toLowerCase()]) {
      tokenAddress = TOKEN_LIST[token.toLowerCase()].address;
      decimals = TOKEN_LIST[token.toLowerCase()].decimals;
    } else {
      throw new Error('Invalid token: ' + token);
    }
    _tokens.push(tokenAddress);
    _amounts.push(parseUnits(amount.toString(), decimals));
  }

  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'createJoinPay',
    args: [
      gameId,
      expiresIn,
      plyrIds,
      _tokens,
      _amounts,
    ]
  });

  const hash = receipt.transactionHash;

  console.log('createJoinPay receipt:', receipt);
  

  if (receipt.status !== 'success') {
    for (let i=0; i<plyrIds.length; i++) {
      await logActivity(plyrIds[i], gameId, 'game', 'createJoinPay', { gameId, token: tokens[i].toLowerCase(), amount: amounts[i], hash, success: receipt.status });
    }
    throw new Error('Transaction failed');
  }

  for (let i = 0; i < receipt.logs.length; i++) {
    const log = receipt.logs[i];
    try {
      const decodedLog = decodeEventLog({
        abi: GAME_RULE_V1_ABI,
        data: log.data,
        topics: log.topics,
      });
      console.log('Decoded log', i, ':', decodedLog);
      if (decodedLog.eventName === 'GameRoomCreated') {
        const { gameId, roomId, roomAddress } = decodedLog.args;
        await GameRoom.updateOne({ gameId, roomId }, { $set: { gameId, roomId: roomId.toString(), roomAddress } }, { upsert: true });
        result = { gameId, roomId: roomId.toString(), roomAddress };
        for (let i=0; i<plyrIds.length; i++) {
          await logActivity(plyrIds[i], gameId, 'game', 'createJoinPay', { gameId, roomId: roomId.toString(), token: tokens[i].toLowerCase(), amount: amounts[i], hash, success: receipt.status });
        }
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    const plyrId = plyrIds[i];
    const token = tokens[i];
    const amount = amounts[i];
    const userApprove = await UserApprove.findOne({ gameId, plyrId, token });
    if (userApprove) {
      if (userApprove.amount >= amount) {
        await UserApprove.updateOne({ gameId, plyrId, token }, { $inc: { amount: -amount } });
      } else {
        await UserApprove.deleteOne({ gameId, plyrId, token });
      }
    }
  }

  return {hash, result};
}

async function earnLeaveEnd({gameId, roomId, plyrIds, tokens, amounts}) {
  let result = {};
  let _tokens = [];
  let _amounts = [];
  for (let i=0; i<tokens.length; i++) {
    const token = tokens[i];
    const amount = amounts[i];
    let tokenAddress;
    let decimals;
    if (isAddress(token)) {
      tokenAddress = token;
      if (token === zeroAddress) {
        decimals = 18;
      } else {
        decimals = await chain.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'decimals',
          args: [],
        });
      }
    } else if (TOKEN_LIST[token.toLowerCase()]) {
      tokenAddress = TOKEN_LIST[token.toLowerCase()].address;
      decimals = TOKEN_LIST[token.toLowerCase()].decimals;
    } else {
      throw new Error('Invalid token: ' + token);
    }
    _tokens.push(tokenAddress);
    if (!amount) {
      _amounts.push("0");
    } else {
      _amounts.push(parseUnits(amount.toString(), decimals));
    }
  }

  const receipt = await sendAndWaitTx({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'earnLeaveEnd',
    args: [
      gameId,
      roomId,
      plyrIds,
      _tokens,
      _amounts,
    ]
  });

  const hash = receipt.transactionHash;

  console.log('earnLeaveEnd receipt:', receipt);

  for (let i=0; i<plyrIds.length; i++) {
    await logActivity(plyrIds[i], gameId, 'game', 'earnLeaveEnd', { gameId, roomId, token: tokens[i].toLowerCase(), amount: amounts[i], hash, success: receipt.status });
  }

  if (receipt.status !== 'success') {
    throw new Error('Transaction failed');
  }

  return {hash, result};
}

module.exports = {
  create,
  join,
  leave,
  pay,
  earn,
  end,
  close,
  isJoined,
  createJoinPay,
  earnLeaveEnd,
}