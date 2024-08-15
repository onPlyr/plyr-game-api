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

router.get('/now', hmacAuth('user'), baseController.getNow);
router.get('/status', hmacAuth('admin'), baseController.getStatus);


router.get('/user/exists/:queryStr', hmacAuth('user'), userController.getUserExists);
router.post('/user/register', hmacAuth('user'), userController.postRegister);
router.get('/user/info/:plyrId', hmacAuth('user'), userController.getUserInfo);
router.post('/user/modify/:plyrId/avatar', hmacAuth('user'), userController.postModifyAvatar);
router.post('/user/secondary/bind', hmacAuth('user'), userController.postSecondaryBind);
router.get('/user/secondary/:plyrId', hmacAuth('user'), userController.getSecondary);


router.get('/task/status/:id', hmacAuth('user'), statusController.getTaskStatus);


router.get('/jwt/publicKey', hmacAuth('user'), jwtController.getPublicKey);
router.post('/jwt/verify', hmacAuth('user'), jwtController.postVerifyJwt);
router.post('/jwt/verifyUser', hmacAuth('user'), jwtController.postVerifyUserJwt);


router.post('/airdrop/compaign/:compaignId/claim', hmacAuth('user'), airdropController.postClaim);

module.exports = router;
