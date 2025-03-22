require('dotenv').config();
const { defineChain, http, createWalletClient, publicActions } = require('viem');
const { privateKeyToAccount } = require('viem/accounts');
const tokenListService = require('../services/tokenListService');

// Initialize token list service after 5 seconds
let initialized = false;
if (process.env.NODE_ENV !== 'test' && !initialized) {
  setTimeout(() => {
    tokenListService.initialize();
    initialized = true;
  }, 5000);
}

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
const GAME_CHIP_FACTORY_ABI = require('./GameChipFactory.json').abi;
const REGISTER_ABI = require('./Register.json').abi;
const MIRROR_BYTECODE = require('./Mirror.json').bytecode;
const AIRDROP_ABI = require('./Airdrop.json');
const GAME_RULE_V1_ABI = require('./GameRuleV1.json').abi;

let _TOKEN_LIST = {
  'plyr': {
    address: '0x0000000000000000000000000000000000000000',
    decimals: 18,
  },
  'gamr': {
    address: '0xa875625fe8A955406523E52E485f351b92908ce1',
    decimals: 18,
  }, // testnet
};

function TOKEN_LIST() {
  return _TOKEN_LIST;
}

function updateTokenList(tokenListData) {
  const CHAIN_ID = Number(client.chain.id); // PLYR TAU Testnet chain ID
  const filteredTokens = {};
  
  if (!tokenListData || !Array.isArray(tokenListData.tokens)) {
    console.log('Invalid token list data:', tokenListData);
    return;
  }

  console.log('Filtering tokens for chain ID:', CHAIN_ID);
  
  tokenListData.tokens
    .filter(token => token.chainId === CHAIN_ID)
    .forEach(token => {
      filteredTokens[token.apiId] = {
        address: token.address,
        decimals: token.decimals,
      };
    });
  
    _TOKEN_LIST = filteredTokens;
  console.log('Token list has been updated successfully:', _TOKEN_LIST);
}

// set update callback
tokenListService.setTokenListUpdateCallback(updateTokenList);

const nftSubgraphs = {
  43113: 'https://gateway.thegraph.com/api/c211a616cd01759736cc37444494d002/subgraphs/id/FjqPUbTyFmLxhq4eDEDCpqveRJDZaxxKYxHs6uFehUd9',
  43114: 'https://gateway.thegraph.com/api/c211a616cd01759736cc37444494d002/subgraphs/id/J72c2C6Y6JH7enFECfGfhBBtiULYsuEurGYAWK37Fu3k',
  62831: 'https://graph-testnet.onplyr.com/subgraphs/name/onplyr/common-nft-subgraph',
  16180: 'https://graph-testnet.onplyr.com/subgraphs/name/onplyr/common-nft-subgraph',
}

const chainNameToChainId = {
  'fuji': 43113,
  'avalanche': 43114,
  'plyrTestnet': 62831,
  'plyr': 16180,
}

const nftAlias = {
  43113: {
    'zoogenes': '0x857890E33fdF115F4F318BDEee4115e0e7162537'.toLowerCase(),
  },
  43114: {
    'zoogenes': '0x9Fc13E6408CA6A997d6EB8A25440Cbcb20745E8B'.toLowerCase(),
  }
}

module.exports = {
  port: process.env.PORT || 3000,
  mongodbUri: process.env.MONGODB_URI,
  redisUrl: process.env.REDIS_URL,
  PK: process.env.PK,
  chain: client,
  plyrRegisterSC: '0xC650e83b1cC9A1438fe2b1E9b4556B6fAa6B6Fb4',
  plyrRouterSC: '0xaABae47f41fee8f877c7F2641A306A01F7d8A2FA',
  ROUTER_ABI,
  GAME_CHIP_FACTORY_ABI,
  REGISTER_ABI,
  MIRROR_BYTECODE,
  airdropSC: '0x60318fC530b84dD548867CF23E602b5427533852',
  AIRDROP_ABI,
  jwtPrivateKey: Buffer.from(process.env.JWT_PRIVATE_KEY, 'base64').toString('utf-8'),
  jwtPublicKey: Buffer.from(process.env.JWT_PUBLIC_KEY, 'base64').toString('utf-8'),
  gameRuleV1SC: '0x1c20E9ffD6Fac7a4842286683A8FfBE5B882990e',
  GAME_RULE_V1_ABI,
  TOKEN_LIST,
  chainNameToChainId,
  nftSubgraphs,
  nftAlias,
};
