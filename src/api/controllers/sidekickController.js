const Sidekick = require('../../models/sidekick');

exports.getReadJwt = async (ctx) => {
    const sidekickRandom = ctx.params.sidekickRandom;
    const sidekick = await Sidekick.findOne({ random: sidekickRandom });
    if (!sidekick) {
        ctx.status = 404;
        ctx.body = {
            error: 'Sidekick not found'
        };
        return;
    }

    const timeout = 10*60*1000;
    if (Date.now() - sidekick.createdAt > timeout) {
        ctx.status = 404;
        ctx.body = {
            error: 'Sidekick expired'
        };
        return;
    }

    ctx.status = 200;
    ctx.body = {
        sessionJwt: sidekick.jwt
    };
}

exports.postRevokeJwt = async (ctx) => {
    const sidekickRandom = ctx.params.sidekickRandom;
    const sidekick = await Sidekick.findOne({ random: sidekickRandom });
    if (!sidekick) {
        ctx.status = 404;
        ctx.body = {
            error: 'Sidekick not found'
        };
        return;
    }
    await Sidekick.deleteOne({ random: sidekickRandom });
    ctx.status = 200;
    ctx.body = {
        message: 'Sidekick jwt revoked'
    };
}
