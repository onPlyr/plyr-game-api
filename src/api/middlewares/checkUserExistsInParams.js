const UserInfo = require('../../models/userInfo');

const checkUserExistsInParams = async (ctx, next) => {
  const { plyrId } = ctx.params;

  const user = await UserInfo.findOne({ plyrId });
  if (!user) {
    ctx.status = 404;
    ctx.body = {
      error: 'User not found'
    };
    return;
  }

  ctx.state.user = user;

  await next();
};

module.exports = checkUserExistsInParams;