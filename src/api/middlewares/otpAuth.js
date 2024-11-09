const UserInfo = require("../../models/userInfo");
const { is2faUsed } = require("../../utils/utils");
const { authenticator } = require('otplib');
authenticator.options = {
  step: 30,
  window: 1
};

const otpAuth = async (ctx, next) => {
  const { plyrId, otp } = ctx.request.body;

  if (is2faUsed(plyrId, otp)) {
    ctx.status = 401;
    ctx.body = { error: '2FA token already used' };
    return;
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    ctx.status = 404;
    ctx.body = { error: 'User not found' };
    return;
  }

  if (user.isInstantPlayPass) {
    ctx.status = 403;
    ctx.body = { error: 'User is instant play pass, can not use 2fa to login' };
    return;
  }

  if (user.bannedAt > 0 && user.bannedAt > Date.now() - 1000*60) {
    ctx.status = 403;
    ctx.body = { error: 'User is temporary locked' };
    return;
  }

  const isValid = authenticator.verify({ token: otp, secret: user.secret });
  if (!isValid) {
    ctx.status = 401;
    ctx.body = { error: 'Invalid 2fa token' };

    if (user.loginFailedCount >= 4) {
      await UserInfo.updateOne({ plyrId: user.plyrId }, { $set: { bannedAt: Date.now(), loginFailedCount: 0 } });
    } else {
      await UserInfo.updateOne({ plyrId: user.plyrId }, { $inc: { loginFailedCount: 1 } });
    }
    return;
  }

  ctx.state.user = user;
  await next();
};

module.exports = otpAuth;