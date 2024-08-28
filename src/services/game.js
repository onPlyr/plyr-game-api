const { chain, gameRuleV1SC, GAME_RULE_V1_ABI } = require('../config');

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
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'pay',
    args: [
      gameId,
      roomId,
      plyrId,
      token, 
      amount
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('pay receipt:', receipt);
  return hash;
}

async function earn({plyrId,gameId, roomId, token, amount}) {
  const hash = await chain.writeContract({
    address: gameRuleV1SC,
    abi: GAME_RULE_V1_ABI,
    functionName: 'earn',
    args: [
      gameId,
      roomId,
      plyrId,
      token, 
      amount
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

module.exports = {
  create,
  join,
  leave,
  pay,
  earn,
  end,
  close,
}