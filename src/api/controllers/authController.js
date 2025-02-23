const Auth = require('../../models/auth');

exports.getRead = async (ctx) => {
    const uid = ctx.params.uid;
    const auth = await Auth.findOne({ uid: uid });
    if (!auth) {
        ctx.status = 404;
        ctx.body = {
            error: 'Auth not found'
        };
        return;
    }

    const timeout = 10*60*1000;
    if (Date.now() - auth.createdAt > timeout) {
        ctx.status = 404;
        ctx.body = {
            error: 'Auth expired'
        };
        return;
    }

    ctx.status = 200;
    ctx.body = {
        data: auth.data
    };
}

exports.postRevoke = async (ctx) => {
    const uid = ctx.params.uid;
    const auth = await Auth.findOne({ uid: uid });
    if (!auth) {
        ctx.status = 404;
        ctx.body = {
            error: 'Auth not found'
        };
        return;
    }
    await Auth.deleteOne({ uid: uid });
    ctx.status = 200;
    ctx.body = {
        message: 'Auth data revoked'
    };
}
