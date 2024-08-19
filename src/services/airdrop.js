const { chain, airdropSC, AIRDROP_ABI } = require('../config');

async function claimAirdropReward({ campaignId, address, playedGame }) {
  const hash = await chain.writeContract({
    address: airdropSC,
    abi: AIRDROP_ABI,
    functionName: 'claimReward',
    args: [
      campaignId,
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