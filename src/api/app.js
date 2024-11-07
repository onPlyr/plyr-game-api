const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const logger = require('koa-logger');
const config = require('../config');
const routes = require('./routes');
const errorHandler  = require('./middlewares/errorHandler');


const app = new Koa();

app.use(cors());
app.use(async (ctx, next) => {
  const requestIP = ctx.get('X-Real-IP') || 
              ctx.get('X-Forwarded-For')?.split(',')[0] || 
              ctx.ip || 
              'unknown';
  console.log('requestIP', requestIP);
  await next();
});
app.use(logger());
app.use(bodyParser());
app.use(errorHandler);
app.use(routes.routes()).use(routes.allowedMethods());

app.on('error', (err, ctx) => {
  console.error('error:', err);
});

let server;

function startServer() {
  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
  return server;
}

module.exports = { app, startServer };