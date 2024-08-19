const config = require("../../config");
const userInfo = require("../../models/userInfo");
const { verifyPlyrid } = require("../../utils/utils");

exports.postClaim = async (ctx) => {
  const { compaignId } = ctx.params;
  const { address, playedGame } = ctx.request.body;

  ctx.status = 200;

  if (process.env.NODE_ENV !== 'test') {
    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'claimAirdropReward', JSON.stringify({
      compaignId,
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

exports.getCampaginInfo = async (ctx) => {
  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getCampaigns'
  });
  console.log(ret);
  let returnBody = [];
  ret.map((item, i) => {
    let obj = {};
    obj.compaignId = i;
    Object.keys(item).map((key) => {
      obj[key] = item[key].toString();
    });
    returnBody.push(obj);
  });
  
  ctx.status = 200;
  ctx.body = returnBody;
}

exports.getCampaginClaimableReward = async (ctx) => {
  const { compaignId, address } = ctx.params;

  let ret = await config.chain.readContract({
    address: config.airdropSC,
    abi: config.AIRDROP_ABI,
    functionName: 'getClaimableReward',
    args: [compaignId, address]
  });
  console.log(ret);

  ctx.status = 200;
  ctx.body = {
    claimableReward: ret.toString()
  };
}
