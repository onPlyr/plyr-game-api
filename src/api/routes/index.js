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
const sidekickController = require('../controllers/sidekickController');

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

// sidekick apis
router.get('/sidekick/authenticatedData/read/:sidekickRandom', hmacAuth('user'), sidekickController.getReadJwt);
router.post('/sidekick/authenticatedData/revoke/:sidekickRandom', hmacAuth('user'), sidekickController.postRevokeJwt);

module.exports = router;
