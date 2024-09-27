const { chain, gameRuleV1SC, GAME_RULE_V1_ABI } = require('../config');
const { encodeFunctionData, erc20Abi, isAddress, parseUnits, decodeEventLog } = require('viem');
const { TOKEN_LIST } = require('../config');
const UserApprove = require('../models/userApprove');
const GameRoom = require('../models/gameRoom');


async function create({gameId, expiresIn}) {
  let result = {};
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'create',
    args: [
      gameId,
      expiresIn,
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('create receipt:', receipt);
  if (receipt.status !== 'success') {
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
      }
    } catch (error) {
      console.log('Failed to decode log', i, ':', error.message);
    }
  }

  return {hash, result};
}

async function join({plyrIds, gameId, roomId}) {
  let result = {};
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'join',
    args: [
      gameId,
      roomId,
      plyrIds,
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('join receipt:', receipt);
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
  return ret;
}

async function leave({plyrIds, gameId, roomId}) {
  let result = {};
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'leave',
    args: [
      gameId,
      roomId,
      plyrIds,
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('leave receipt:', receipt);
  return {hash, result};
}

async function pay({plyrId, gameId, roomId, token, amount}) {
  let result = {};
  let tokenAddress;
  let decimals;
  if (isAddress(token)) {
    tokenAddress = token;
    decimals = await chain.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
      args: [],
    });
  } else if (TOKEN_LIST[token.toLowerCase()]) {
    tokenAddress = TOKEN_LIST[token.toLowerCase()].address;
    decimals = TOKEN_LIST[token.toLowerCase()].decimals;
  } else {
    throw new Error('Invalid token: ' + token);
  }

  console.log('request pay', {gameId, roomId, plyrId, tokenAddress, amount, decimals});

  const hash = await chain.writeContract({
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

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

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
    decimals = await chain.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: 'decimals',
      args: [],
    });
  } else if (TOKEN_LIST[token.toLowerCase()]) {
    tokenAddress = TOKEN_LIST[token.toLowerCase()].address;
    decimals = TOKEN_LIST[token.toLowerCase()].decimals;
  } else {
    throw new Error('Invalid token: ' + token);
  }

  const hash = await chain.writeContract({
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

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('earn receipt:', receipt);
  return {hash, result};
}

async function end({gameId, roomId}) {
  let result = {};
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'end',
    args: [
      gameId,
      roomId,
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('end receipt:', receipt);
  return {hash, result};
}

async function close({gameId, roomId}) {
  let result = {};
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'close',
    args: [
      gameId,
      roomId,
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('close receipt:', receipt);
  return {hash, result};
}

// Input:
// const functionDatas = [
//   { function: 'join', params: { roomId: 'room1' } },
//   { function: 'pay', params: { roomId: 'room1', plyrId: 'plyr1', token: 'token1', amount: 50 } },
// ];
async function multicall({ gameId, roomId, functionDatas, sessionJwts }) {
  let result = {};
  let datas = [];
  for (const functionData of functionDatas) {
    const { function: functionName, params } = functionData;
    if (functionName === 'join' || functionName === 'leave') {
      const plyrIds = Object.keys(sessionJwts);
      const _data = encodeFunctionData({
        abi: GAME_RULE_V1_ABI,
        functionName,
        args: [
          gameId,
          roomId,
          plyrIds,
        ],
      });
      datas.push(_data);
    }

    if (functionName === 'pay' || functionName === 'earn') {
      let tokenAddress;
      let decimals;
      if (isAddress(params.token)) {
        tokenAddress = params.token;
        decimals = await chain.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: 'decimals',
          args: [],
        });
      } else if (TOKEN_LIST[params.token.toLowerCase()]) {
        tokenAddress = TOKEN_LIST[params.token.toLowerCase()].address;
        decimals = TOKEN_LIST[params.token.toLowerCase()].decimals;
      } else {
        throw new Error('Invalid token: ' + params.token);
      }
      
      const _data = encodeFunctionData({
        abi: GAME_RULE_V1_ABI,
        functionName,
        args: [
          gameId,
          roomId,
          params.plyrId,
          tokenAddress,
          parseUnits(params.amount.toString(), decimals),
        ],
      });
      datas.push(_data);
    }

    if (functionName === 'end' || functionName === 'close') {
      const _data = encodeFunctionData({
        abi: GAME_RULE_V1_ABI,
        functionName,
        args: [
          gameId,
          roomId,
        ],
      });
      datas.push(_data);
    }
  }

  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'multicall',
    args: [
      datas,
    ],
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('multicall receipt:', receipt);
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
}