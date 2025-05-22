const Router = require('@koa/router');
const baseController = require('../controllers/baseController');
const userController = require('../controllers/userController');
const statusController = require('../controllers/statusController');
const jwtController = require('../controllers/jwtController');
const airdropController = require('../controllers/airdropController');
const gameController = require('../controllers/gameController');
const withdrawController = require('../controllers/withdrawController');
const instantPlayPassController = require('../controllers/instantPlayPassController');
const activityLogsController = require('../controllers/activityLogsController');
const nftController = require('../controllers/nftController');
const permissionController = require('../controllers/permissionController');
const authController = require('../controllers/authController');
const chipController = require('../controllers/chipController');
const gameNftController = require('../controllers/gameNftController');

const hmacAuth = require('../middlewares/hmacAuth');
const otpAuth = require('../middlewares/otpAuth');
const checkToken = require('../middlewares/checkToken');
const checkSessionJwts = require('../middlewares/checkSessionJwts');
const checkSessionJwt = require('../middlewares/checkSessionJwt');
const checkAllowance = require('../middlewares/checkAllowance');
const checkUserExistsInParams = require('../middlewares/checkUserExistsInParams');
const checkTokenInParams = require('../middlewares/checkTokenInParams');
const checkUserExistsInBody = require('../middlewares/checkUserExistsInBody');
const checkAllowances = require('../middlewares/checkAllowances');
const checkTokens = require('../middlewares/checkTokens');
const checkGameId = require('../middlewares/checkGameId');
const checkAllJoined = require('../middlewares/checkAllJoined');
const tokenListController = require('../controllers/tokenListController');
const { checkChainId } = require('../middlewares/checkChainId');
const wrapBadge = require('../middlewares/wrapBadge');

const router = new Router({
  prefix: '/api'
});

router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

router.get('/now', hmacAuth('user'), baseController.getNow);
router.get('/status', hmacAuth('admin'), baseController.getStatus);

// user apis
router.get('/user/exists/:queryStr', hmacAuth('user'), userController.getUserExists);
router.post('/user/register', hmacAuth('user'), userController.postRegister);
router.post('/user/register/:claimingCode', hmacAuth('user'), userController.postRegisterWithClaimingCode);
router.get('/user/info/:plyrId', hmacAuth('user'), userController.getUserInfo);
router.post('/user/modify/avatar', hmacAuth('user'), userController.postModifyAvatar);
router.post('/user/secondary/bind', hmacAuth('user'), userController.postSecondaryBind);
router.post('/user/secondary/unbind', hmacAuth('user'), userController.postSecondaryUnbind);
router.get('/user/secondary/:plyrId', hmacAuth('user'), userController.getSecondary);
router.post('/user/login', hmacAuth('user'), otpAuth, userController.postLogin);
router.post('/user/loginAndApprove', hmacAuth('user'), otpAuth, checkToken, checkGameId, userController.postLoginAndApprove);
router.post('/user/logout', hmacAuth('user'), userController.postLogout);
router.post('/user/session/verify', hmacAuth('user'), userController.postUserSessionVerify);
router.post('/user/reset2fa', hmacAuth('user'), userController.postReset2fa);
router.get('/user/basic/:address', userController.getUserBasicInfo);
router.post('/user/avatars', userController.getAvatars);
router.get('/user/balance/:plyrId', hmacAuth('user'), checkUserExistsInParams, userController.getUserBalance);
router.get('/balance/:address', hmacAuth('user'), userController.getAddressBalance);
router.get('/user/balance/:plyrId/:tokenName', hmacAuth('user'), checkUserExistsInParams, checkTokenInParams, userController.getUserTokenBalance);
router.get('/user/avatar/:plyrId', hmacAuth('user'), checkUserExistsInParams, userController.getAvatar);
router.get('/user/activeSessions/:plyrId', hmacAuth('user'), checkUserExistsInParams, userController.getActiveSessions);
router.post('/user/session/discardBySignature', hmacAuth('user'), userController.postDiscardSessionBySignature);
router.post('/user/session/discardBy2fa', hmacAuth('user'), otpAuth, userController.postDiscardSessionBy2fa);
router.post('/user/addDepositLog', hmacAuth('user'), userController.postAddDepositLog);

// instant play pass
router.post('/instantPlayPass/register', hmacAuth('user'), instantPlayPassController.postRegister);
router.post('/instantPlayPass/reveal/claimingCode', hmacAuth('user'), checkSessionJwt, instantPlayPassController.postRevealClaimingCode);
router.post('/instantPlayPass/reveal/privateKey', hmacAuth('user'), instantPlayPassController.postRevealPrivateKey);
router.get('/instantPlayPass/verify/claimingCode/:code', hmacAuth('user'), instantPlayPassController.getVerifyClaimingCode);

// task apis
router.get('/task/status/:id', hmacAuth('user'), statusController.getTaskStatus);

// jwt apis
router.get('/jwt/publicKey', hmacAuth('user'), jwtController.getPublicKey);

// airdrop apis
router.post('/airdrop/campaign/claim', hmacAuth('user'), airdropController.postClaim);
router.get('/airdrop/campaign/info', hmacAuth('user'), airdropController.getCampaignInfo);
router.get('/airdrop/campaign/:campaignId/claimableReward/:address', hmacAuth('user'), airdropController.getCampaignClaimableReward);
router.get('/airdrop/campaign/:campaignId/userReward/:address', hmacAuth('user'), airdropController.getCampaignUserReward);
router.get('/airdrop/allClaimableReward/:address', hmacAuth('user'), airdropController.getAllClaimableReward);
router.post('/airdrop/claimAllClaimableReward', hmacAuth('user'), airdropController.postClaimAllClaimableReward);

// game apis
router.post('/game/approve', hmacAuth('user'), otpAuth, checkToken, checkGameId, gameController.postGameApprove);
router.get('/game/allowance/:plyrId/:gameId/:token', hmacAuth('user'), gameController.getGameAllowance);
router.get('/game/allowanceByGameId/:plyrId/:gameId', hmacAuth('user'), gameController.getGameAllowanceByGameId);
router.get('/game/allowances/:plyrId', hmacAuth('user'), gameController.getGameAllowances);
router.post('/game/revoke', hmacAuth('user'), otpAuth, gameController.postGameRevoke);
router.post('/game/revokeBySignature', hmacAuth('user'), gameController.postGameRevokeBySignature);
router.post('/game/create', hmacAuth('user'), gameController.postGameCreate);
router.post('/game/join', hmacAuth('user'), checkSessionJwts, gameController.postGameJoin);
router.post('/game/leave', hmacAuth('user'), checkSessionJwts, checkAllJoined, gameController.postGameLeave);
router.post('/game/pay', hmacAuth('user'), checkSessionJwts, checkTokens, checkAllowances, checkAllJoined, gameController.postGameBatchPay);
router.post('/game/earn', hmacAuth('user'), checkTokens, gameController.postGameBatchEarn);
router.post('/game/end', hmacAuth('user'), gameController.postGameEnd);
router.post('/game/close', hmacAuth('user'), gameController.postGameClose);
router.post('/game/createJoinPay', hmacAuth('user'), checkSessionJwts, checkTokens, checkAllowances, gameController.postGameCreateJoinPay);
router.post('/game/joinPay', hmacAuth('user'), checkSessionJwts, checkTokens, checkAllowances, gameController.postGameJoinPay);
router.post('/game/earnLeaveEnd', hmacAuth('user'), checkTokens, gameController.postGameEarnLeaveEnd);
router.post('/game/earnLeave', hmacAuth('user'), checkTokens, gameController.postGameEarnLeave);
router.get('/game/isJoined', hmacAuth('user'), gameController.getIsJoined);

// chip apis
router.post('/game/chip/createBySignature', hmacAuth('user'), chipController.postChipCreateBySignature);
router.post('/game/chip/create', hmacAuth('user'), chipController.postChipCreate);
router.post('/game/chip/mint', hmacAuth('user'), chipController.postChipMint);
router.post('/game/chip/burn', hmacAuth('user'), chipController.postChipBurn);
router.post('/game/chip/transfer', hmacAuth('user'), chipController.postChipTransfer);
router.get('/game/chip/balance', hmacAuth('user'), chipController.getBalance);
router.get('/game/chip/info', hmacAuth('user'), chipController.getInfo);

// game nft apis
router.post('/game/nft/createBySignature', hmacAuth('user'), checkChainId, gameNftController.postNftCreateBySignature);
router.post('/game/nft/create', hmacAuth('user'), checkChainId, gameNftController.postNftCreate);
router.post('/game/nft/mint', hmacAuth('user'), checkChainId, gameNftController.postNftMint);
router.post('/game/nft/burn', hmacAuth('user'), checkChainId, gameNftController.postNftBurn);
router.post('/game/nft/transfer', hmacAuth('user'), checkChainId, gameNftController.postNftTransfer);
router.get('/game/nft/balance', hmacAuth('user'), gameNftController.getBalance);
router.get('/game/nft/list', hmacAuth('user'), gameNftController.getList);
router.get('/game/nft/info', hmacAuth('user'), gameNftController.getInfo);
router.get('/game/nft/count', hmacAuth('user'), gameNftController.getCount);
router.get('/game/nft/credit', hmacAuth('user'), gameNftController.getCredit);
router.post('/game/nft/upload', hmacAuth('user'), gameNftController.postUploadFile);
router.get('/game/nft/get/:chain/:contract/:tokenId', hmacAuth('user'), nftController.getNftById);
router.get('/game/nft/owner/:chain/:contract/:tokenId', hmacAuth('user'), nftController.getNftOwner);
router.get('/game/nft/isBurnt/:chain/:contract/:tokenId', hmacAuth('user'), nftController.getIsBurnt);

// game badge apis
router.post('/game/badge/createBySignature', hmacAuth('user'), checkChainId, wrapBadge, gameNftController.postNftCreateBySignature);
router.post('/game/badge/create', hmacAuth('user'), checkChainId, wrapBadge, gameNftController.postNftCreate);
router.post('/game/badge/mint', hmacAuth('user'), checkChainId, wrapBadge, gameNftController.postBadgeMint);
router.post('/game/badge/remove', hmacAuth('user'), checkChainId, wrapBadge, gameNftController.postBadgeRemove);
router.post('/game/badge/removeBySignature', hmacAuth('user'), checkChainId, wrapBadge, gameNftController.postBadgeRemoveBySignature);
router.post('/game/badge/burn', hmacAuth('user'), checkChainId, wrapBadge, gameNftController.postNftBurn);
router.get('/game/badge/balance', hmacAuth('user'), wrapBadge, gameNftController.getBalance);
router.get('/game/badge/list', hmacAuth('user'), wrapBadge, gameNftController.getList);
router.get('/game/badge/info', hmacAuth('user'), wrapBadge, gameNftController.getInfo);
router.get('/game/badge/count', hmacAuth('user'), wrapBadge, gameNftController.getCount);
router.get('/game/badge/get/:chain/:contract/:tokenId', hmacAuth('user'), wrapBadge, nftController.getNftById);
router.get('/game/badge/owner/:chain/:contract/:tokenId', hmacAuth('user'), wrapBadge, nftController.getNftOwner);
router.get('/game/badge/isBurnt/:chain/:contract/:tokenId', hmacAuth('user'), wrapBadge, nftController.getIsBurnt);

// public apis
router.get('/tokenlist', tokenListController.getTokenList);
router.get('/tokenlist/:tokenId', tokenListController.getTokenList);

// activity logs
router.get('/actionLog/:plyrId', hmacAuth('user'), activityLogsController.getLogs);

// withdraw apis
router.post('/withdraw', hmacAuth('user'), checkToken, checkUserExistsInBody, withdrawController.postWithdraw);
router.post('/transfer', hmacAuth('user'), checkToken, checkUserExistsInBody, withdrawController.postTransfer);
router.get('/isGame/:plyrId', hmacAuth('user'), withdrawController.getIsGame);

// nft apis
router.get('/nft/:chain/:contract/:plyrId', hmacAuth('user'), nftController.getNft);

// permission apis
router.post('/developer/upgrade', hmacAuth('user'), permissionController.postUpgradePermission);
router.get('/developer/status/:plyrId', hmacAuth('user'), permissionController.getStatus);
router.get('/developer/listing/:status', hmacAuth('user'), permissionController.getListingStatus);
router.post('/developer/reject', hmacAuth('user'), permissionController.postRejectPermission);
router.post('/developer/approve', hmacAuth('user'), permissionController.postApprovePermission);
router.post('/developer/revealApiKey', hmacAuth('user'), permissionController.postRevealApiKey)
router.post('/developer/resetApiKey', hmacAuth('user'), permissionController.resetApiKey);

// Authenticated apis for sidekick / plyr[connect]
router.get('/auth/read/:uid', hmacAuth('user'), authController.getRead);
router.post('/auth/revoke/:uid', hmacAuth('user'), authController.postRevoke);



module.exports = router;
