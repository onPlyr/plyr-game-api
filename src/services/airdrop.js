const { chain, airdropSC, AIRDROP_ABI } = require('../config');
const { sendAndWaitTx } = require('../utils/tx');

async function claimAirdropReward({ campaignId, address, playedGame }) {
  console.log('claimAirdropReward:', campaignId, address, playedGame);
  const receipt = await sendAndWaitTx({
    address: airdropSC,
    abi: AIRDROP_ABI,
    functionName: 'claimReward',
    args: [
      campaignId,
      address,
      playedGame,
    ]
  });

  console.log('claimAirdropReward receipt:', receipt);
  return receipt.transactionHash;
}

module.exports = { claimAirdropReward };