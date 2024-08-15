const config = require("../../config");
const userInfo = require("../../models/userInfo");

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