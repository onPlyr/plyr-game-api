const { formatEther, getAddress, isAddress } = require("viem");
const config = require("../../config");
const { getRedisClient } = require("../../db/redis");
const redis = getRedisClient();

exports.postClaim = async (ctx) => {
  const { campaignId, address, playedGame } = ctx.request.body;
  console.log('postClaim:', campaignId, address, playedGame);

  if (typeof playedGame !== 'boolean' || !isAddress(address) || isNaN(campaignId)) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid Input params',
    };
    return;
  }

  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getClaimableReward',
    args: [campaignId, address]
  });
  console.log(ret);

  if (ret === 0n || Number(ret) === 0) {
    ctx.status = 401;
    ctx.body = {
      error: 'No claimable reward',
    };
    return;
  }

  ctx.status = 200;

  if (process.env.NODE_ENV !== 'test') {
    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'claimAirdropReward', JSON.stringify({
      campaignId,
      address: getAddress(address),
      playedGame,
    }));
    console.log('Added message ID:', messageId);

    ctx.body = {
      task: {
        id: messageId,
        status: 'PENDING',
      },
    };
  } else {
    ctx.body = {};
  }
}

exports.getCampaignInfo = async (ctx) => {
  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getCampaigns'
  });
  console.log(ret);
  let returnBody = [];
  ret.map((item, i) => {
    let obj = {};
    obj.campaignId = i;
    Object.keys(item).map((key) => {
      if (key !== 'unclaimedReward') {
        obj[key] = Number(item[key].toString());
      } else {
        obj[key] = item[key].toString();
      }
    });
    obj.unclaimedReward = formatEther(obj.unclaimedReward);
    if (obj.startTime * 1000 > Date.now()) {
      obj.status = 'not started';
    } else if (obj.startTime * 1000 + obj.vestPeriodCount * obj.vestPeriodLength * 1000 < Date.now()) {
      obj.status = 'ended';
    } else {
      obj.status = 'ongoing';
      obj.periodId = Math.floor((Date.now() - obj.startTime * 1000) / (obj.vestPeriodLength * 1000));
      if (obj.periodId < obj.vestPeriodCount) {
        obj.nextPeriodTime = Number(obj.startTime) + Number((obj.periodId + 1) * obj.vestPeriodLength);
      }
    }
    returnBody.push(obj);
  });
  
  ctx.status = 200;
  ctx.body = returnBody;
}

exports.getAllClaimableReward = async (ctx) => {
  const { address } = ctx.params;
  // get all compaign
  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getCampaigns'
  });
  console.log(ret);
  let returnBody = [];
  ret.map((item, i) => {
    let obj = {};
    obj.campaignId = i;
    Object.keys(item).map((key) => {
      if (key !== 'unclaimedReward') {
        obj[key] = Number(item[key].toString());
      } else {
        obj[key] = item[key].toString();
      }
    });
    obj.unclaimedReward = formatEther(obj.unclaimedReward);
    if (obj.startTime * 1000 > Date.now()) {
      obj.status = 'not started';
    } else if (obj.startTime * 1000 + obj.vestPeriodCount * obj.vestPeriodLength * 1000 < Date.now()) {
      obj.status = 'ended';
    } else {
      obj.status = 'ongoing';
      obj.periodId = Math.floor((Date.now() - obj.startTime * 1000) / (obj.vestPeriodLength * 1000));
      if (obj.periodId < obj.vestPeriodCount) {
        obj.nextPeriodTime = Number(obj.startTime) + Number((obj.periodId + 1) * obj.vestPeriodLength);
      }
    }
    returnBody.push(obj);
  });

  let totalClaimableReward = 0n;
  for (let i=0; i<returnBody.length; i++) {
    if (returnBody[i].status === 'ongoing') {
      let ret = await config.chain.readContract({
        address: config.airdropSC,
        abi: config.AIRDROP_ABI,
        functionName: 'getClaimableReward',
        args: [returnBody[i].campaignId, address]
      });
      console.log(ret);
      totalClaimableReward += ret;
    }
  }

  ctx.status = 200;
  ctx.body = {
    totalClaimableReward: formatEther(totalClaimableReward)
  };
}

exports.postClaimAllClaimableReward = async (ctx) => {
  const { address, playedGame } = ctx.request.body;

  if (typeof address !== 'string' || !isAddress(address)) {
    ctx.status = 401;
    ctx.body = {
      error: 'Invalid Input params',
    };
    return;
  }

  let _playedGame = true;
  if (typeof playedGame === 'boolean') {
    _playedGame = playedGame;
  }

  // get all compaign
  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getCampaigns'
  });
  console.log(ret);
  let returnBody = [];
  ret.map((item, i) => {
    let obj = {};
    obj.campaignId = i;
    Object.keys(item).map((key) => {
      if (key !== 'unclaimedReward') {
        obj[key] = Number(item[key].toString());
      } else {
        obj[key] = item[key].toString();
      }
    });
    obj.unclaimedReward = formatEther(obj.unclaimedReward);
    if (obj.startTime * 1000 > Date.now()) {
      obj.status = 'not started';
    } else if (obj.startTime * 1000 + obj.vestPeriodCount * obj.vestPeriodLength * 1000 < Date.now()) {
      obj.status = 'ended';
    } else {
      obj.status = 'ongoing';
      obj.periodId = Math.floor((Date.now() - obj.startTime * 1000) / (obj.vestPeriodLength * 1000));
      if (obj.periodId < obj.vestPeriodCount) {
        obj.nextPeriodTime = Number(obj.startTime) + Number((obj.periodId + 1) * obj.vestPeriodLength);
      }
    }
    returnBody.push(obj);
  });

  let taskIds = [];
  if (process.env.NODE_ENV !== 'test') {
    for (let i=0; i<returnBody.length; i++) {
      if (returnBody[i].status === 'ongoing') {
        let ret = await config.chain.readContract({
          address: config.airdropSC,
          abi: config.AIRDROP_ABI,
          functionName: 'getClaimableReward',
          args: [returnBody[i].campaignId, address]
        });
        console.log(ret);

        if (ret === 0n || Number(ret) === 0) {
          continue;
        }

        const STREAM_KEY = 'mystream';
        // insert message into redis stream
        let taskId = await redis.xadd(STREAM_KEY, '*', 'claimAirdropReward', JSON.stringify({
          campaignId: returnBody[i].campaignId,
          address: getAddress(address),
          playedGame: _playedGame,
        }));
        console.log('Added message ID:', taskId);
        taskIds.push(taskId);
      }
    }

    ctx.status = 200;

    ctx.body = {
      task: taskIds.map(v=>{return {id: v, status: 'PENDING'}}),
    };
  } else {
    ctx.body = {};
  }
}

exports.getCampaignClaimableReward = async (ctx) => {
  const { campaignId, address } = ctx.params;

  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getClaimableReward',
    args: [campaignId, address]
  });
  console.log(ret);

  ctx.status = 200;
  ctx.body = {
    claimableReward: formatEther(ret)
  };
}

exports.getCampaignUserReward = async (ctx) => {
  const { campaignId, address } = ctx.params;

  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'userRewards',
    args: [campaignId, address]
  });
  console.log(ret);

  ctx.status = 200;
  ctx.body = {
    claimedReward: formatEther(ret[0]),
    totalReward: formatEther(ret[1]),
    unclaimedReward: formatEther(ret[1] - ret[0]),
  };
}
