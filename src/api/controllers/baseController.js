const os = require('os');

exports.getNow = (ctx) => {
  ctx.body = {
    now: new Date().toISOString()
  };
};

exports.getStatus = (ctx) => {
  ctx.body = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      total: os.totalmem(),
      free: os.freemem()
    },
    cpu: os.cpus().length
  };
};
