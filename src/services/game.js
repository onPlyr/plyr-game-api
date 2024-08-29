const { chain, gameRuleV1SC, GAME_RULE_V1_ABI } = require('../config');
const { encodeFunctionData, erc20Abi, isAddress, parseUnits } = require('viem');
const { TOKEN_LIST } = require('../config');
const UserApprove = require('../models/userApprove');


async function create({gameId, expiresIn}) {
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

  // TODO: get GameRoom ID and Contract Address from receipt

  console.log('create receipt:', receipt);
  return hash;
}

async function join({plyrIds, gameId, roomId}) {
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
  return hash;
}

async function leave({plyrIds, gameId, roomId}) {
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
  return hash;
}

async function pay({plyrId, gameId, roomId, token, amount}) {
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
    functionName: 'pay',
    args: [
      gameId,
      roomId,
      plyrId,
      tokenAddress, 
      parseUnits(amount, decimals),
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
  return hash;
}

async function earn({plyrId,gameId, roomId, token, amount}) {
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
      parseUnits(amount, decimals),
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('earn receipt:', receipt);
  return hash;
}

async function end({gameId, roomId}) {
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
  return hash;
}

async function close({gameId, roomId}) {
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
  return hash;
}

// Input:
// const functionDatas = [
//   { function: 'join', params: { roomId: 'room1' } },
//   { function: 'pay', params: { roomId: 'room1', plyrId: 'plyr1', token: 'token1', amount: 50 } },
// ];
async function multicall({ gameId, roomId, functionDatas, sessionJwts }) {
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
          parseUnits(params.amount, decimals),
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
  return hash;
}

module.exports = {
  create,
  join,
  leave,
  pay,
  earn,
  end,
  close,
}