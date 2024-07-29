const Koa = require('koa');
const bodyParser = require('koa-bodyparser');
const cors = require('@koa/cors');
const logger = require('koa-logger');
const config = require('../config');
const routes = require('./routes');
const mongoose = require('mongoose');

const MONGODB_URI = config.mongodbUri;
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Could not connect to MongoDB', err));

const app = new Koa();

app.use(cors());
app.use(logger());
app.use(bodyParser());
app.use(routes.routes()).use(routes.allowedMethods());

let server;

function startServer() {
  server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port}`);
  });
  return server;
}

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = { app, startServer };