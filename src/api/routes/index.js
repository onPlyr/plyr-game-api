const Router = require('@koa/router');
const baseController = require('../controllers/baseController');
const userController = require('../controllers/userController');
const statusController = require('../controllers/statusController');
const jwtController = require('../controllers/jwtController');
const airdropController = require('../controllers/airdropController');
const gameController = require('../controllers/gameController');
const withdrawController = require('../controllers/withdrawController');

const hmacAuth = require('../middlewares/hmacAuth');
const otpAuth = require('../middlewares/otpAuth');
const checkToken = require('../middlewares/checkToken');
const checkSessionJwts = require('../middlewares/checkSessionJwts');
const checkAllowance = require('../middlewares/checkAllowance');
const checkUserExistsInParams = require('../middlewares/checkUserExistsInParams');
const checkTokenInParams = require('../middlewares/checkTokenInParams');
const checkUserExistsInBody = require('../middlewares/checkUserExistsInBody');



const router = new Router({
  prefix: '/api'
});

router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

router.get('/now', hmacAuth('user'), baseController.getNow);
router.get('/status', hmacAuth('admin'), baseController.getStatus);


router.get('/user/exists/:queryStr', hmacAuth('user'), userController.getUserExists);
router.post('/user/register', hmacAuth('user'), userController.postRegister);
router.get('/user/info/:plyrId', hmacAuth('user'), userController.getUserInfo);
router.post('/user/modify/:plyrId/avatar', hmacAuth('user'), userController.postModifyAvatar);
router.post('/user/secondary/bind', hmacAuth('user'), userController.postSecondaryBind);
router.get('/user/secondary/:plyrId', hmacAuth('user'), userController.getSecondary);
router.post('/user/login', hmacAuth('user'), otpAuth, userController.postLogin);
router.post('/user/logout', hmacAuth('user'), userController.postLogout);
router.post('/user/session/verify', hmacAuth('user'), userController.postUserSessionVerify);
router.post('/user/reset2fa', hmacAuth('user'), userController.postReset2fa);
router.get('/user/basic/:address', userController.getUserBasicInfo);
router.get('/user/balance/:plyrId', hmacAuth('user'), checkUserExistsInParams, userController.getUserBalance);
router.get('/user/balance/:plyrId/:tokenName', hmacAuth('user'), checkUserExistsInParams, checkTokenInParams, userController.getUserTokenBalance);

router.get('/task/status/:id', hmacAuth('user'), statusController.getTaskStatus);


router.get('/jwt/publicKey', hmacAuth('user'), jwtController.getPublicKey);
// router.post('/jwt/verify', hmacAuth('user'), jwtController.postVerifyJwt);


router.post('/airdrop/campaign/claim', hmacAuth('user'), airdropController.postClaim);
router.get('/airdrop/campaign/info', hmacAuth('user'), airdropController.getCampaignInfo);
router.get('/airdrop/campaign/:campaignId/claimableReward/:address', hmacAuth('user'), airdropController.getCampaignClaimableReward);
router.get('/airdrop/campaign/:campaignId/userReward/:address', hmacAuth('user'), airdropController.getCampaignUserReward);

router.post('/game/approve', hmacAuth('user'), otpAuth, checkToken, gameController.postGameApprove);
router.get('/game/allowance', hmacAuth('user'), gameController.getGameAllowance);
router.post('/game/revoke', hmacAuth('user'), otpAuth, checkToken, gameController.postGameRevoke);
router.post('/game/create', hmacAuth('user'), gameController.postGameCreate);
router.post('/game/join', hmacAuth('user'), checkSessionJwts, gameController.postGameJoin);
router.post('/game/leave', hmacAuth('user'), checkSessionJwts, gameController.postGameLeave);
router.post('/game/pay', hmacAuth('user'), checkSessionJwts, checkAllowance, gameController.postGamePay);
router.post('/game/earn', hmacAuth('user'), gameController.postGameEarn);
router.post('/game/end', hmacAuth('user'), gameController.postGameEnd);
router.post('/game/close', hmacAuth('user'), gameController.postGameClose);
router.get('/game/isJoined', hmacAuth('user'), gameController.getIsJoined);
// router.post('/game/multicall', hmacAuth('user'), checkSessionJwts, gameController.postGameMulticall);

router.post('/withdraw', hmacAuth('user'), checkToken, checkUserExistsInBody, withdrawController.postWithdraw);
router.post('/transfer', hmacAuth('user'), checkToken, checkUserExistsInBody, withdrawController.postTransfer);
router.get('/isGame/:plyrId', hmacAuth('user'), withdrawController.getIsGame);

module.exports = router;
