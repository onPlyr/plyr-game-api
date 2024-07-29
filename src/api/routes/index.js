const Router = require('@koa/router');
const baseController = require('../controllers/baseController');

const router = new Router({
  prefix: '/api'
});

router.get('/', (ctx) => {
  ctx.body = { message: 'Welcome to the API' };
});

router.get('/now', baseController.getNow);
router.get('/status', baseController.getStatus);

module.exports = router;
