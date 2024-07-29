const Router = require('@koa/router');
const baseController = require('../controllers/baseController');
const hmacAuth = require('../middlewares/hmacAuth');

const router = new Router({
  prefix: '/api'
});

router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

router.get('/now', hmacAuth('user'), baseController.getNow);
router.get('/status', hmacAuth('admin'), baseController.getStatus);

module.exports = router;
