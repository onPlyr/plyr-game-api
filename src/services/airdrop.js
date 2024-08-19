const { chain, airdropSC, AIRDROP_ABI } = require('../config');

async function claimAirdropReward({ campaignId, address, playedGame }) {
  console.log('claimAirdropReward:', campaignId, address, playedGame);
  const hash = await chain.writeContract({
    address: airdropSC,
    abi: AIRDROP_ABI,
    functionName: 'claimReward',
    args: [
      campaignId,
      address,
      playedGame,
    ]
  });

  const receipt = await chain.waitForTransactionReceipt({
    hash: hash,
  });

  console.log('claimAirdropReward receipt:', receipt);
  return hash;
}

module.exports = { claimAirdropReward };