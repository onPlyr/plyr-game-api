const airdropController = require('./airdropController');
const config = require('../../config');
const { getRedisClient } = require('../../db/redis');

jest.mock('../../config');
jest.mock('../../db/redis');

describe('airdropController', () => {
  let mockCtx;
  
  beforeEach(() => {
    mockCtx = {
      request: { body: {} },
      status: 0,
      body: {},
    };
    
    // Mock Redis client
    getRedisClient.mockReturnValue({
      xadd: jest.fn().mockResolvedValue('mockMessageId'),
    });
  });

  describe('postClaim', () => {
    it('should return 401 when input is invalid', async () => {
      mockCtx.request.body = { campaignId: 'invalid', address: 'invalid', playedGame: 'invalid' };
      
      await airdropController.postClaim(mockCtx);
      
      expect(mockCtx.status).toBe(401);
      expect(mockCtx.body).toEqual({ error: 'Invalid Input params' });
    });

    it('should return 401 when there is no claimable reward', async () => {
      mockCtx.request.body = { campaignId: 1, address: '0x1234567890123456789012345678901234567890', playedGame: true };
      config.chain.readContract.mockResolvedValue(0n);
      
      await airdropController.postClaim(mockCtx);
      
      expect(mockCtx.status).toBe(401);
      expect(mockCtx.body).toEqual({ error: 'No claimable reward' });
    });
  });

  describe('getCampaignInfo', () => {
    it('should return formatted campaign information', async () => {
      const mockCampaigns = [
        { startTime: 1000n, vestPeriodCount: 10n, vestPeriodLength: 3600n, unclaimedReward: 1000000000000000000n },
      ];
      config.chain.readContract.mockResolvedValue(mockCampaigns);
      
      await airdropController.getCampaignInfo(mockCtx);
      
      expect(mockCtx.status).toBe(200);
      expect(mockCtx.body).toHaveLength(1);
      expect(mockCtx.body[0]).toHaveProperty('status');
      expect(mockCtx.body[0]).toHaveProperty('unclaimedReward', '1');
    });
  });

  describe('getCampaignClaimableReward', () => {
    it('should return the claimable reward amount', async () => {
      mockCtx.params = { campaignId: 1, address: '0x1234567890123456789012345678901234567890' };
      config.chain.readContract.mockResolvedValue(2000000000000000000n);
      
      await airdropController.getCampaignClaimableReward(mockCtx);
      
      expect(mockCtx.status).toBe(200);
      expect(mockCtx.body).toEqual({ claimableReward: '2' });
    });
  });
});
