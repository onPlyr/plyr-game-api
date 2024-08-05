const mongoose = require('mongoose');
const crypto = require('crypto');
const UserInfo = require('../src/models/userInfo');
const config = require('../src/config');
const { getAddress } = require('viem');

const MONGODB_URI = config.mongodbUri;

mongoose.connect(MONGODB_URI);

async function main() {
  const ret = await UserInfo.find();

  for (let i=0; i<ret.length; i++) {
    let user = ret[i];
    let primaryAddress = user.primaryAddress;
    let plyrId = user.plyrId;

    let primaryCheckSum = getAddress(primaryAddress);

    console.log(`Updating user ${plyrId} with primaryAddress ${primaryAddress} -> ${primaryCheckSum}`);
    await UserInfo.updateOne({ plyrId }, { primaryAddress: primaryCheckSum });
  }
}

main(console.log).catch(console.log);