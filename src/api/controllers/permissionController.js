const { isHex, verifyMessage, recoverMessageAddress } = require('viem');
const ApiKey = require('../../models/apiKey');
const UserInfo = require('../../models/userInfo');
const PermissionUpgrade = require('../../models/permissionUpgrade');
const Admin = require('../../models/admin');
const crypto = require('crypto');

function generateApiKey() {
  return crypto.randomBytes(16).toString('hex');
}

function generateSecretKey() {
  return crypto.randomBytes(32).toString('hex');
}

const isPlyrIdUpgradeable = async (plyrId) => {
  // check if plyrId is already a gameId
  const apiKey = await ApiKey.findOne({ plyrId: plyrId.toLowerCase() });
  if (apiKey) {
    throw new Error('PlyrId is already a gameId');
  }

  const user = await UserInfo.findOne({ plyrId: plyrId.toLowerCase() });
  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

const isPendingPermissionUpgrade = async (plyrId) => {
  const upgrade = await PermissionUpgrade.findOne({ plyrId: plyrId.toLowerCase() });
  if (!upgrade) {
    throw new Error("Permission upgrade not found");
  }

  if (upgrade.status !== 'pending') {
    throw new Error("Permission upgrade already processed");
  }
}

exports.postUpgradePermission = async (ctx) => {
  const { plyrId, signature, information } = ctx.request.body;

  try {
    if (!isHex(signature)) {
      throw new Error('Signature must be a hex string');
    }

    const user = await isPlyrIdUpgradeable(plyrId);

    const signatureMessage = `PLYR[ID] Permission Upgrade`;

    const valid = await verifyMessage({
      address: user.primaryAddress,
      message: signatureMessage,
      signature
    });
  
    if (!valid) {
      throw new Error('Invalid signature');
    }

    await PermissionUpgrade.create({
      plyrId: user.plyrId,
      information,
      status: 'pending'
    });

    ctx.status = 200;
    ctx.body = {
      message: 'Permission upgrade requested'
    };
  } catch (error) {
    console.log(error);
    ctx.status = 400;
    ctx.body = {
      error: error.message
    };
    return;
  } 
}

exports.getListingStatus = async (ctx) => {
  const status = ctx.params.status;
  const p = await PermissionUpgrade.find({ status });
  ctx.status = 200;
  ctx.body = p;
  return;
}

exports.getStatus = async (ctx) => {
  const { plyrId } = ctx.params;
  const p = await PermissionUpgrade.findOne({ plyrId: plyrId.toLowerCase() });
  if (!p) {
    ctx.status = 404;
    ctx.body = {
      error: 'Permission request not found'
    };
    return;
  }
  ctx.status = 200;
  ctx.body = p;
}

exports.postApprovePermission = async (ctx) => {
  let { plyrId, signature } = ctx.request.body;

  try {

    plyrId = plyrId.toLowerCase();

    await isPendingPermissionUpgrade(plyrId);

    const signatureMessage = `Approve ${plyrId.toUpperCase()}\'s permission upgrade`;

    const address = await recoverMessageAddress({
      message: signatureMessage,
      signature
    });

    const admin = await Admin.findOne({ address });

    if (!admin) {
      throw new Error('Invalid signature');
    }

    await PermissionUpgrade.updateOne({ plyrId }, { status: 'success', approvedBy: admin.name, approvedAt: Date.now() });

    await ApiKey.create({
      plyrId,
      apiKey: generateApiKey(),
      secretKey: generateSecretKey(),
      role: 'game'
    });

    ctx.status = 200;
    ctx.body = {
      message: 'Permission upgrade approved'
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      error: error.message
    };
    return;
  }
}

exports.postRejectPermission = async (ctx) => {
  let { plyrId, signature } = ctx.request.body;
  console.log('postRejectPermission 1', { plyrId, signature });

  try {

    plyrId = plyrId.toLowerCase();


    await isPendingPermissionUpgrade(plyrId);

    const signatureMessage = `Reject ${plyrId.toUpperCase()}\'s permission upgrade`;

    const address = await recoverMessageAddress({
      message: signatureMessage,
      signature
    });

    console.log('postRejectPermission 2', { address, signatureMessage, signature });

    const admin = await Admin.findOne({ address });

    console.log('postRejectPermission 3', { admin });

    if (!admin) {
      throw new Error('Invalid signature');
    }

    await PermissionUpgrade.updateOne({ plyrId }, { status: 'failed', approvedBy: admin.name, approvedAt: Date.now() });

    ctx.status = 200;
    ctx.body = {
      message: 'Permission upgrade rejected'
    };
  } catch (error) {
    ctx.status = 400;
    ctx.body = {
      error: error.message
    };
    return;
  }
}

exports.postRevealApiKey = async (ctx) => {
  let { plyrId, signature } = ctx.request.body;
  plyrId = plyrId.toLowerCase();

  try {
    const user = await UserInfo.findOne({ plyrId });
    if (!user) {
      throw new Error('User not found');
    }

    const signatureMessage = `Reveal ${plyrId.toUpperCase()}\'s API key`;

    const valid = await verifyMessage({
      address: user.primaryAddress,
      message: signatureMessage,
      signature
    });

    if (!valid) {
      throw new Error('Invalid signature');
    }

    const apiKey = await ApiKey.findOne({ plyrId });
    if (!apiKey) {
      throw new Error('API key not found');
    }

    ctx.status = 200;
    ctx.body = {
      apiKey: apiKey.apiKey,
      secretKey: apiKey.secretKey
    };
  } catch (error) {
    console.log(error);
    ctx.status = 400;
    ctx.body = {
      error: error.message
    };
    return;
  }
}

exports.resetApiKey = async (ctx) => {
  let { plyrId, signature } = ctx.request.body;
  plyrId = plyrId.toLowerCase();
  try {
    const user = await UserInfo.findOne({ plyrId });
    if (!user) {
      throw new Error('User not found');
    }

    const signatureMessage = `Reset ${plyrId.toUpperCase()}\'s API key`;

    const valid = await verifyMessage({
      address: user.primaryAddress,
      message: signatureMessage,
      signature
    });

    if (!valid) {
      throw new Error('Invalid signature');
    }

    const apiKey = await ApiKey.findOne({ plyrId });
    if (!apiKey) {
      throw new Error('API key not found');
    }

    const newApiKey = generateApiKey();
    const newSecretKey = generateSecretKey();

    await ApiKey.updateOne({ plyrId }, { apiKey: newApiKey, secretKey: newSecretKey });

    ctx.status = 200;
    ctx.body = {
      apiKey: newApiKey,
      secretKey: newSecretKey
    };

  } catch (error) {
    console.log(error);
    ctx.status = 400;
    ctx.body = {
      error: error.message
    };
    return;
  }
}

