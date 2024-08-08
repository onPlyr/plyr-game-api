const { verifyMessage, isAddress, isHex, getAddress } = require('viem');
const UserInfo = require('../../models/userInfo');
const { calcMirrorAddress } = require('../../utils/calcMirror');
const { verifyPlyrid } = require('../../utils/utils');
const { getRedisClient } = require('../../db/redis');

const redis = getRedisClient();

const DEFAULT_AVATR = 'https://ipfs.plyr.network/ipfs/QmNRjvbBfJ7GpRzjs7uxRUytAAuuXjhBqKhDETbET2h6wR';

exports.getUserExists = async (ctx) => {
  let { queryStr } = ctx.params;

  if (!queryStr) {
    ctx.status = 400;
    ctx.body = {
      error: 'PlyrId or primaryAddress is required'
    };
    return;
  }
  
  let plyrId;
  let primaryAddress;
  if (isAddress(queryStr)) {
    primaryAddress = getAddress(queryStr);
  } else {
    plyrId = queryStr.toLowerCase();
  }

  if (!plyrId && !primaryAddress) {
    ctx.status = 400;
    ctx.body = {
      error: 'PlyrId or primaryAddress is required'
    };
    return;
  }

  ctx.body = {
    exists: false
  };

  if (plyrId) {
    plyrId = plyrId.toLowerCase();
    // Check if user exists
    const user = await UserInfo.findOne({ plyrId });
    if (user) {
      ctx.body = {
        exists: true
      };
      return;
    }
  }

  if (primaryAddress) {
    // Check if user exists
    const user = await UserInfo.findOne({ primaryAddress: getAddress(primaryAddress)});
    if (user) {
      ctx.body = {
        exists: true
      };
      return;
    }
  }
};

exports.postRegister = async (ctx) => {
  let { address, signature, plyrId, secret, chainId, avatar } = ctx.request.body;

  if (!address || !signature || !plyrId || !secret) {
    ctx.status = 400;
    ctx.body = {
      error: 'Address, signature, plyrId, secret are required'
    };
    return;
  }

  if (!isHex(signature)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Signature must be a hex string'
    };
    return;
  }

  if (!isAddress(address)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid address'
    };
    return;
  }

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID}'
    };
    return;
  }

  plyrId = plyrId.toLowerCase();
  console.log('plyrId', plyrId);

  const singatureMessage = `PLYR[ID] Registration`;

  const valid = await verifyMessage({
    address,
    message: singatureMessage,
    signature
  });

  if (!valid) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid signature'
    };
    return;
  }

  let ret = await UserInfo.findOne({ plyrId });
  if (ret && ret.plyrId === plyrId) {
    ctx.status = 400;
    ctx.body = {
      error: 'PLYR[ID] already exists'
    };
    console.log('ret', ret);
    return;
  }

  ret = await UserInfo.findOne({ primaryAddress: getAddress(address) });
  if (ret && ret.primaryAddress === getAddress(address)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Primary address already exists'
    };
    console.log('ret', ret);
    return;
  }

  const mirror = calcMirrorAddress(address);

  await UserInfo.create({
    plyrId,
    mirror: mirror,
    primaryAddress: getAddress(address),
    secret,
    chainId: chainId || 62831,
    avatar: avatar ? avatar : DEFAULT_AVATR,
  });

  if (process.env.NODE_ENV !== 'test') {
    const STREAM_KEY = 'mystream';
    // insert message into redis stream
    const messageId = await redis.xadd(STREAM_KEY, '*', 'createUser', JSON.stringify({
      address: getAddress(address),
      plyrId,
      chainId: chainId || 62831,
    }));
    console.log('Added message ID:', messageId);

    ctx.body = {
      plyrId,
      mirror,
      primaryAddress: getAddress(address),
      avatar: avatar ? avatar : DEFAULT_AVATR,
      task: {
        id: messageId,
        status: 'PENDING',
      },
    };
  } else {
    ctx.body = {
      plyrId,
      mirror,
      primaryAddress: getAddress(address),
      avatar: avatar ? avatar : DEFAULT_AVATR,
    };
  }
};

exports.getUserInfo = async (ctx) => {
  let { plyrId } = ctx.params;

  if (isAddress(plyrId)) {
    const primaryAddress = getAddress(plyrId);
    const user = await UserInfo.findOne({ primaryAddress });
    if (!user) {
      ctx.status = 404;
      ctx.body = {
        error: 'Primary address not found'
      };
      return;
    } else {
      let avatar = user.avatar ? user.avatar : DEFAULT_AVATR;
      avatar = avatar.startsWith('ipfs://') ? 'https://ipfs.plyr.network/ipfs/' + avatar.slice(7) : avatar;

      ctx.body = {
        plyrId: user.plyrId,
        mirror: user.mirror,
        primaryAddress: user.primaryAddress,
        chainId: user.chainId,
        avatar,
      };
    }
  } else {
    if (!verifyPlyrid(plyrId)) {
      ctx.status = 400;
      ctx.body = {
        error: 'Invalid PLYR[ID}'
      };
      return;
    }
  
    plyrId = plyrId.toLowerCase();
  
    const user = await UserInfo.findOne({ plyrId });
    if (!user) {
      ctx.status = 404;
      ctx.body = {
        error: 'PLYR[ID] not found'
      };
      return;
    } else {
      let avatar = user.avatar ? user.avatar : DEFAULT_AVATR;
      avatar = avatar.startsWith('ipfs://') ? 'https://ipfs.plyr.network/ipfs/' + avatar.slice(7) : avatar;
      ctx.body = {
        plyrId: user.plyrId,
        mirror: user.mirror,
        primaryAddress: user.primaryAddress,
        chainId: user.chainId,
        avatar,
      };
    }
  }
}

exports.postModifyAvatar = async (ctx) => {
  const { plyrId } = ctx.params;
  const { avatar } = ctx.request.body;

  if (!verifyPlyrid(plyrId)) {
    ctx.status = 400;
    ctx.body = {
      error: 'Invalid PLYR[ID]'
    };
    return;
  }

  if (!avatar || typeof avatar !== 'string') {
    ctx.status = 400;
    ctx.body = {
      error: 'Avatar must be a non-empty string'
    };
    return;
  }

  const normalizedPlyrId = plyrId.toLowerCase();

  const updatedUser = await UserInfo.findOneAndUpdate(
    { plyrId: normalizedPlyrId },
    { $set: { avatar } },
    { new: true }
  );

  if (!updatedUser) {
    ctx.status = 404;
    ctx.body = {
      error: 'PLYR[ID] not found'
    };
    return;
  }

  ctx.body = {
    plyrId: updatedUser.plyrId,
    avatar: updatedUser.avatar,
  };
};