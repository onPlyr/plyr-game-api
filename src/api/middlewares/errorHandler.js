const errorHandler = async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error('Unexpected error:', err);

    ctx.status = err.status || 500;
    ctx.body = {
      error: err.message || 'Internal server error',
    };
    ctx.body.stack = err.stack;
    ctx.app.emit('error', err, ctx);
  }
};

module.exports = errorHandler;