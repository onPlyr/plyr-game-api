const { parseEther, formatEther } = require("viem");
const { chain } = require("../../config");

const BURN_ADDRESS = '0x0100000000000000000000000000000000000000';
const MAX_SUPPLY = 750_000_000;
const LOCKED_ADDRESSES = [
  '0x9196129cf8af34e78f6c3cf992a9617ed741cf23',
  '0x9cc1f9e4a274875f4e8b78bf4c9ec193056596e8',
  '0xf63846bf2fa38934cb949584267604bfcb034cc6',
  '0xE861C8B1f8451BA7515F252aC19a68dC05D0DfeD',
  '0x6c149a5843af837d20e3332934489eff3b66d13a',
  '0xd6fc5bc03f3603356d1d0855c109fdeefec08ad3',
  '0x62be983a1416083aaccea9d211a985c8069a9689',
  '0xebA97778942973339362FA92A2c9f55979DC3307',
  '0x769696c833e36def95d6ef60b5ce4e1ea21610fd',
  '0xfa8d71c6750bc856b3a482bf6abae137a666ed0b',
  '0x81256E05eC6f2630fA2454c820265F4FF75adf4A',
  '0x958b04c7B206ee577B9d3bfeaC451F2b0056D646',
];

exports.getTotalSupply = async (ctx) => {
  const burnBalance = await chain.getBalance({
    address: BURN_ADDRESS,
  });
  ctx.status = 200;
  ctx.set('Content-Type', 'text/plain');
  ctx.body = formatEther(parseEther(MAX_SUPPLY.toString()) - burnBalance);
}

exports.getCirculatingSupply = async (ctx) => {
  const rets = await Promise.all(LOCKED_ADDRESSES.map(address => chain.getBalance({ address })));
  const lockedBalance = rets.reduce((acc, ret) => acc + parseEther(formatEther(ret)), 0n);
  const burnBalance = await chain.getBalance({ address: BURN_ADDRESS });
  const circulatingSupply = parseEther(MAX_SUPPLY.toString()) - burnBalance - lockedBalance;
  ctx.status = 200;
  ctx.set('Content-Type', 'text/plain');
  ctx.body = formatEther(circulatingSupply);
}

exports.getBurnedSupply = async (ctx) => {
  const burnBalance = await chain.getBalance({
    address: BURN_ADDRESS,
  });
  ctx.status = 200;
  ctx.set('Content-Type', 'text/plain');
  ctx.body = formatEther(burnBalance.toString());
}

exports.getLockedSupply = async (ctx) => {
  const rets = await Promise.all(LOCKED_ADDRESSES.map(address => chain.getBalance({ address })));
  const lockedBalance = rets.reduce((acc, ret) => acc + parseEther(formatEther(ret)), 0n);
  ctx.status = 200;
  ctx.set('Content-Type', 'text/plain');
  ctx.body = formatEther(lockedBalance);
}
