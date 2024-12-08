const axios = require('axios');

const localChainId = 16180;

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
                
                // Fetch and add CMC prices
                const prices = await this.fetchCMCPrices(this.tokenList.tokens);
                this.tokenList.tokens = this.tokenList.tokens.map(token => ({
                    ...token,
                    price: token.cmcId ? prices[token.cmcId] : null,
                    updatedAt: new Date().toISOString(),
                    nextUpdatedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
                }));

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

    async getTokenList() {
        if (!this.initialized) {
            await this.initialize();
        }
        return this.tokenList;
    }

    // 设置回调函数的方法
    setTokenListUpdateCallback(callback) {
        this.onTokenListUpdate = callback;
    }
}

// Create singleton instance
const tokenListService = new TokenListService();

module.exports = tokenListService;
