const Router = require('@koa/router');
const baseController = require('../controllers/baseController');
const userController = require('../controllers/userController');
const statusController = require('../controllers/statusController');
const jwtController = require('../controllers/jwtController');
const airdropController = require('../controllers/airdropController');
const hmacAuth = require('../middlewares/hmacAuth');

const router = new Router({
  prefix: '/api'
});

router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

router.get('/now', baseController.getNow);
router.get('/status', hmacAuth('admin'), baseController.getStatus);


router.get('/user/exists/:queryStr', hmacAuth('user'), userController.getUserExists);
router.post('/user/register', hmacAuth('user'), userController.postRegister);
router.get('/user/info/:plyrId', hmacAuth('user'), userController.getUserInfo);
router.post('/user/modify/:plyrId/avatar', hmacAuth('user'), userController.postModifyAvatar);
router.post('/user/secondary/bind', hmacAuth('user'), userController.postSecondaryBind);
router.get('/user/secondary/:plyrId', hmacAuth('user'), userController.getSecondary);
router.post('/user/login', hmacAuth('user'), userController.postLogin);
router.post('/user/logout', hmacAuth('user'), userController.postLogout);
router.post('/user/session/verify', hmacAuth('user'), userController.postUserSessionVerify);

router.get('/task/status/:id', hmacAuth('user'), statusController.getTaskStatus);


router.get('/jwt/publicKey', hmacAuth('user'), jwtController.getPublicKey);
// router.post('/jwt/verify', hmacAuth('user'), jwtController.postVerifyJwt);


router.post('/airdrop/campaign/claim', hmacAuth('user'), airdropController.postClaim);
router.get('/airdrop/campaign/info', hmacAuth('user'), airdropController.getCampaignInfo);
router.get('/airdrop/campaign/:campaignId/claimableReward/:address', hmacAuth('user'), airdropController.getCampaignClaimableReward);
router.get('/airdrop/campaign/:campaignId/userReward/:address', hmacAuth('user'), airdropController.getCampaignUserReward);

module.exports = router;
