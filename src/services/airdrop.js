const { chain, airdropSC, AIRDROP_ABI } = require('../config');

async function claimAirdropReward({ compaignId, address, playedGame }) {
  const hash = await chain.writeContract({
    address: airdropSC,
    abi: AIRDROP_ABI,
    functionName: 'claimReward',
    args: [
      compaignId,
      address,
      playedGame
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('createUser receipt:', receipt);
}

module.exports = { claimAirdropReward };