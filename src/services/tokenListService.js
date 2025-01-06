const axios = require('axios');

const localChainId = 62831;

class TokenListService {
    constructor() {
        this.tokenList = null;
        this.lastEtag = null;
        this.TOKEN_LIST_URL = 'https://raw.githubusercontent.com/onPlyr/plyr-api-tokenlist/refs/heads/main/plyrapi.tokenlist.json';
        this.REFRESH_INTERVAL = 10 * 60 * 1000; // 10 minutes
        this.refreshTimer = null;
        this.initialized = false;
        this.onTokenListUpdate = null; // 添加回调函数
    }

    async initialize() {
        if (this.initialized) {
            return;
        }

        // Initial fetch
        await this.fetchTokenList();
        
        // Set up periodic refresh only in non-test environment
        if (process.env.NODE_ENV !== 'test') {
            this.startRefreshTimer();
        }

        this.initialized = true;
    }

    startRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
        }
        this.refreshTimer = setInterval(() => this.fetchTokenList(), this.REFRESH_INTERVAL);
    }

    stopRefreshTimer() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }

    async fetchTokenList() {
        try {
            const response = await axios.get(this.TOKEN_LIST_URL, {
                headers: this.lastEtag ? { 'If-None-Match': this.lastEtag } : {}
            });

            // Update cache only if content changed
            if (response.status === 200) {
                this.tokenList = response.data;
                this.tokenList.tokens = this.tokenList.tokens.filter(token => token.chainId === localChainId);
                
                // Fetch prices from multiple sources
                await this.updateTokenPrices(this.tokenList.tokens);

                console.log('Token list data received:', JSON.stringify(this.tokenList, null, 2));
                this.lastEtag = response.headers.etag;
                console.log('Token list cache updated');
                if (this.onTokenListUpdate) {
                    this.onTokenListUpdate(this.tokenList);
                }
            }
        } catch (error) {
            if (error.response && error.response.status === 304) {
                console.log('Token list not modified, using cached version');
            } else {
                console.error('Error fetching token list:', error.message);
            }
        }
    }

    async updateTokenPrices(tokens) {
        const currentTime = new Date().toISOString();
        const nextUpdate = new Date(Date.now() + 10 * 60 * 1000).toISOString();

        // Group tokens by price source
        const cmcTokens = tokens.filter(token => token.cmcId);
        const cgTokens = tokens.filter(token => !token.cmcId && token.cgId);
        const dexTokens = tokens.filter(token => !token.cmcId && !token.cgId && token.cmcDexAddress);

        // Fetch prices from different sources
        const cmcPrices = await this.fetchCMCPrices(cmcTokens);
        const cgPrices = await this.fetchCGPrices(cgTokens);
        const dexPrices = await this.fetchCMCDexPrices(dexTokens);

        // Update tokens with prices and sources
        this.tokenList.tokens = tokens.map(token => {
            let price = null;
            let priceSource = null;

            if (token.cmcId && cmcPrices[token.cmcId]) {
                price = cmcPrices[token.cmcId];
                priceSource = 'cmc_api';
            } else if (!token.cmcId && token.cgId && cgPrices[token.cgId]) {
                price = cgPrices[token.cgId];
                priceSource = 'cg_api';
            } else if (!token.cmcId && !token.cgId && token.cmcDexAddress && dexPrices[token.cmcDexAddress]) {
                price = dexPrices[token.cmcDexAddress];
                priceSource = 'cmc_dex_api';
            }

            return {
                ...token,
                price,
                priceSource,
                updatedAt: currentTime,
                nextUpdatedAt: nextUpdate
            };
        });
    }

    async fetchCMCPrices(tokens) {
        try {
            console.log('Fetching CMC prices for tokens:', tokens.map(token => [token.symbol, token.cmcId]).join(', '));
            const cmcIds = tokens.map(token => token.cmcId).filter(id => id);
            if (cmcIds.length === 0) return {};

            const response = await axios.get('https://pro-api.coinmarketcap.com/v2/cryptocurrency/quotes/latest', {
                headers: {
                    'X-CMC_PRO_API_KEY': '27bbe891-0ed7-4354-808c-8c128786965b'
                },
                params: {
                    id: cmcIds.join(',')
                }
            });

            const prices = {};
            if (response.data && response.data.data) {
                console.log('CMC price returned:', JSON.stringify(response.data, null, 2));
                Object.values(response.data.data).forEach(token => {
                    prices[token.id] = token.quote.USD.price.toString();
                });
            }
            return prices;
        } catch (error) {
            console.error('Error fetching CMC prices:', error.message);
            return {};
        }
    }

    async fetchCGPrices(tokens) {
        try {
            console.log('Fetching CG prices for tokens:', tokens.map(token => [token.symbol, token.cgId]).join(', '));
            const cgIds = tokens.map(token => token.cgId).filter(id => id);
            if (cgIds.length === 0) return {};

            const response = await axios.get('https://api.coingecko.com/api/v3/simple/price', {
                params: {
                    ids: cgIds.join(','),
                    vs_currencies: 'usd'
                }
            });

            const prices = {};
            if (response.data) {
                console.log('CG price returned:', JSON.stringify(response.data, null, 2));
                Object.entries(response.data).forEach(([id, data]) => {
                    prices[id] = data.usd.toString();
                });
            }
            return prices;
        } catch (error) {
            console.error('Error fetching CoinGecko prices:', error.message);
            return {};
        }
    }

    async fetchCMCDexPrices(tokens) {
        try {
            console.log('Fetching CMC DEX prices for tokens:', tokens.map(token => [token.symbol, token.cmcDexAddress]).join(', '));
            const prices = {};
            for (const token of tokens) {
                if (!token.cmcDexAddress || !token.cmcDexNetwork) continue;

                const response = await axios.get('https://pro-api.coinmarketcap.com/v4/dex/pairs/quotes/latest', {
                    headers: {
                        'X-CMC_PRO_API_KEY': '27bbe891-0ed7-4354-808c-8c128786965b'
                    },
                    params: {
                        network_slug: token.cmcDexNetwork,
                        contract_address: token.cmcDexAddress,
                        convert_id: 2781 // USD
                    }
                });
                console.log('CMC DEX price returned:', JSON.stringify(response.data, null, 2));
                if (response.data && response.data.data && response.data.data.quote) {
                    prices[token.cmcDexAddress] = response.data.data[0].quote[0].price.toString();
                }
            }
            return prices;
        } catch (error) {
            console.error('Error fetching CMC DEX prices:', error.message);
            return {};
        }
    }

    async getTokenList() {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.tokenList;
    }

    setTokenListUpdateCallback(callback) {
        this.onTokenListUpdate = callback;
    }
}

let tokenListService;

if (!tokenListService) {
    tokenListService = new TokenListService();
}

module.exports = tokenListService;
