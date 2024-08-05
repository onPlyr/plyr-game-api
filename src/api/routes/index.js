const Router = require('@koa/router');
const baseController = require('../controllers/baseController');
const userController = require('../controllers/userController');
const statusController = require('../controllers/statusController');
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
router.get('/task/status/:id', hmacAuth('user'), statusController.getTaskStatus);

module.exports = router;
