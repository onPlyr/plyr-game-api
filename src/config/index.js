require('dotenv').config();
const { defineChain, http, createWalletClient, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');

const plyrTestnet = defineChain({
  id: 62831,
  name: 'PLYR TAU Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'PLYR',
    symbol: 'PLYR'
  },
  rpcUrls: {
    default: {
      http: ['https://subnets.avax.network/plyr/testnet/rpc']
    }
  },
  blockExplorers: {
    default: { name: 'PLYR TAU Testnet Explorer', url: 'https://subnets-test.avax.network/plyr'}
  },
  contracts: {
    multicall3: {
      address: '0xF5091764aeb17da0f09e9BdBAFec4C2F754Cf6ae',
      blockCreated: 112606,
    }
  }
});

const plyrMainnet = defineChain({
  id: 16180,
  name: 'PLYR PHI',
  nativeCurrency: {
    decimals: 18,
    name: 'PLYR',
    symbol: 'PLYR'
  },
  rpcUrls: {
    default: {
      http: ['https://subnets.avax.network/plyr/mainnet/rpc']
    }
  },
  blockExplorers: {
    default: { name: 'PLYR PHI Explorer', url: 'https://subnets.avax.network/plyr'}
  },
  contracts: {
    multicall3: {
      address: '0x5De6e8f2d786E218C5cC48d719aa5C092991323f',
      blockCreated: 56817,
    }
  }
});

const account = privateKeyToAccount(process.env.PK);

const client = createWalletClient({
  account,
  chain: plyrMainnet,
  transport: http(),
}).extend(publicActions);

const ROUTER_ABI = require('./Router.json').abi;
const REGISTER_ABI = require('./Register.json').abi;
const MIRROR_BYTECODE = require('./Mirror.json').bytecode;
const AIRDROP_ABI = require('./Airdrop.json');

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI,
  redisUrl: process.env.REDIS_URL,
  PK: process.env.PK,
  chain: client,
  plyrRegisterSC: '0x9684c4d61A62CFc43174953B814995E412cA1096',
  plyrRouterSC: '0x0EF26D14851c84Dca15CB0265d9EA74f9cAEb828',
  ROUTER_ABI,
  REGISTER_ABI,
  MIRROR_BYTECODE,
  airdropSC: '0x60318fC530b84dD548867CF23E602b5427533852',
  AIRDROP_ABI,
  jwtPrivateKey: Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf-8'),
  jwtPublicKey: Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf-8'),
};
