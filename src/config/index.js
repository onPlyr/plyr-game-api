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

const account = privateKeyToAccount(process.env.PK);

const client = createWalletClient({
  account,
  chain: plyrTestnet,
  transport: http(),
}).extend(publicActions);

const ROUTER_ABI = require('./Router.json').abi;
const REGISTER_ABI = require('./Register.json').abi;
const MIRROR_BYTECODE = require('./Mirror.json').bytecode;

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI,
  redisUrl: process.env.REDIS_URL,
  PK: process.env.PK,
  chain: client,
  plyrRegisterSC: '0xC650e83b1cC9A1438fe2b1E9b4556B6fAa6B6Fb4',
  plyrRouterSC: '0xaABae47f41fee8f877c7F2641A306A01F7d8A2FA',
  ROUTER_ABI,
  REGISTER_ABI,
  MIRROR_BYTECODE,
  jwtPrivateKey: Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf-8'),
  jwtPublicKey: Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf-8'),
};
