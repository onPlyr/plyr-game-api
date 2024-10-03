const { checkTaskStatus } = require('../../services/task');

exports.getTaskStatus = async (ctx) => {
  let ret = await checkTaskStatus(ctx.params.id);
  ctx.body = {
    ...ret,
  };
};
