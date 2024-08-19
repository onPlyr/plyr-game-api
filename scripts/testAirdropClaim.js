

async function main() {
  const { claimAirdropReward } = require('../src/services/airdrop');
  let ret = await claimAirdropReward({ campaignId: '0', address: '0x6Ab499c8E2f3CBc9C99034b6e2912149212bE770', playedGame: true });

}

main().catch(console.error);
