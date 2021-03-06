'use strict';
var config = require('../config');
var logger = require('../utils/logger');
var btcHelper = require('../utils/btcHelper');
var ethHelper = require('../utils/ethHelper');
var xrp = require('../utils/xrpHelper');
var offlineTool = require('../utils/offlineOperations');
let xrpHelper = new xrp();
xrpHelper.connect();
/**
 * 
 * @param {address} req 
 * @param {coin} req 
 */
async function balance(req, res) {
  if (req.query.address == undefined || req.query.coin == undefined) {
    res.status(400).send({ status: false, error: 'no address provided' });
    return;
  }
  var balanceRes = {};
  switch (req.query.coin.toUpperCase()) {
    case 'BTC': {
      balanceRes = await btcHelper.balance(req.query.address);
      break;
    }
    case 'ETH': {
      balanceRes = await ethHelper.balance(req.query.address);
      break;
    }
    case 'XRP': {
      try {
        balanceRes = await xrpHelper.getBalance(req.query.address);
        balanceRes.status = true;
      } catch (error) {
        balanceRes.status = false;
        balanceRes.error = error.reason;
        break;
      }
      break;
    }
    default: {
      balanceRes.status = false;
      balanceRes.error = 'coin not supported'
      break;
    }
  }
  return (balanceRes.status) ? res.status(200).send(balanceRes) : res.status(400).send(balanceRes);
}
/**
 * 
 * @param {txhash} req  
 * @param {coin} req 
 *
 */
async function txStatus(req, res) {
  if (req.query.txhash == undefined || req.query.coin == undefined) {
    res.status(400).send({ status: false, error: 'txhash or coin not given' });
    return;
  }
  var response = {};
  switch (req.query.coin.toUpperCase()) {
    case 'BTC': {
      response = await btcHelper.txDetails(req.query.txhash);
      break;
    }
    case 'ETH': {
      response = await ethHelper.txDetails(req.query.txhash);
      break;
    }
    case 'XRP': {
      try {
        response = await xrpHelper.getTransaction(req.query.txhash);
        response.status = true;
      } catch (error) {
        response.status = false;
        response.error = error.reason;
        break;
      }
      break;
    }
    default: {
      response.status = false;
      response.error = 'coin not supported'
      break;
    }
  }
  return (response.status) ? res.status(200).json(response) : res.status(400).json(response);
}
/**
 * 
 * @param {} 
 *
 */
async function getMnemonic(req, res) {
  var response = {};
  try {
    response = await offlineTool.getMnemonic();
  } catch (error) {
    return res.status(400).json({ status: false, error: error.message || error });
  }
  return (response.status) ? res.status(200).json(response) : res.status(400).json(response);
}
/**
 * 
 * @param {extendedkey} req
 * @param {coin} req
 * @param {total} req 
 */
async function generateAddress(req, res) {
  console.log();
  if (req.body.extendedkey == undefined || req.body.coin == undefined || req.body.total == undefined) {
    res.status(400).send({ status: false, error: 'please provide all parameters' });
    return;
  }
  let response = {};
  try {
    response = await offlineTool.generateAddresses(req.body.extendedkey, req.body.coin, req.body.total);
  } catch (error) {
    res.status(400).send({ status: false, error: error.message || error });
    return;
  }
  return (response.status) ? res.status(200).json(response) : res.status(400).json(response);
}

/**
 * 
 * @param {addresses} Array   
 * @param {toAddress} string
 * @param {sendAmount} string 
 * @param {coin} string 
 * 
 */
async function createTxn(req, res) {
  if (req.body.addresses == undefined || req.body.toAddress == undefined || req.body.coin == undefined || req.body.sendAmount == undefined || req.body.addresses.length < 1) {
    res.status(400).send({ status: false, error: 'please provide all parameters' });
    return;
  }
  let response = {};
  try {
    switch (req.body.coin.toUpperCase()) {
      case 'BTC': {
        response = await btcHelper.createTx(req.body.addresses, req.body.toAddress, req.body.sendAmount);
        break;
      }
      case 'ETH': {
        response = await ethHelper.createTx({ fromAddress: req.body.addresses[0], address: req.body.toAddress, amount: req.body.sendAmount });
        break;
      }
      default: {
        response.status = false;
        response.error = 'coin not supported'
        break;
      }
    }
  } catch (error) {
    res.status(400).send({ status: false, error: error.message || error });
    return;
  }
  return (response.status) ? res.status(200).json(response) : res.status(400).json(response);
}

/**
 * 
 * @param {unsignedHex} string
 * @param {vinOrder} Array 
 * @param {coin} string 
 * @param {privateKeys} Object 
 * @param {privateKeys.pubkeys} Array  
 * @param {privateKeys.privkeys} Array   
 * 
 */
async function signTxn(req, res) {
  if (req.body.unsignedHex == undefined || req.body.coin == undefined || req.body.vinOrder == undefined || req.body.privateKeys == undefined || req.body.privateKeys.pubkeys == undefined || req.body.privateKeys.privkeys == undefined) {
    res.status(400).send({ status: false, error: 'please provide all parameters' });
    return;
  }
  let response = {};
  try {
    let pubPriv = req.body.privateKeys;
    let keypairs = {};
    for (let i = 0; i < pubPriv.pubkeys.length; i++) {
      keypairs[pubPriv.pubkeys[i]] = pubPriv.privkeys[i];
    }

    switch (req.body.coin.toUpperCase()) {
      case 'BTC': {
        response = await btcHelper.signTx({
          vinOrder: req.body.vinOrder, unsignedHex: req.body.unsignedHex
        }, keypairs);
        break;
      }
      case 'ETH': {
        let privateKey = pubPriv.privkeys[0];
        response = await ethHelper.signTx(req.body.unsignedHex, privateKey);
        break;
      }
      default: {
        response.status = false;
        response.error = 'coin not supported'
        break;
      }
    }
  } catch (error) {
    res.status(400).send({ status: false, error: error.message || error });
    return;
  }
  return (response.status) ? res.status(200).json(response) : res.status(400).json(response);
}

/**
 * 
 * @param {coin} string 
 * @param {serializedTx} string   
 * 
 */
async function broadcastTxn(req, res) {
  if (req.body.serializedTx == undefined || req.body.coin == undefined) {
    res.status(400).send({ status: false, error: 'please provide all parameters' });
    return;
  }
  let response = {};
  try {
    switch (req.body.coin.toUpperCase()) {
      case 'BTC': {
        response = await btcHelper.broadcastTx(req.body.serializedTx);
        break;
      }
      case 'ETH': {
        response = await ethHelper.broadcastTx(req.body.serializedTx);
        break;
      }
      default: {
        response.status = false;
        response.error = 'coin not supported'
        break;
      }
    }
  } catch (error) {
    res.status(400).send({ status: false, error: error.message || error });
    return;
  }
  return (response.status) ? res.status(200).json(response) : res.status(400).json(response);
}

/**
 * 
 * @param {coin} string 
 * @param {mnemonic} string 
 * 
 */
async function importMnemonic(req, res) {
  if (req.body.mnemonic == undefined || req.body.coin == undefined) {
    res.status(400).send({ status: false, error: 'no address provided' });
    return;
  }
  let response = {};
  try {
    response = await offlineTool.importMnemonic(req.body.mnemonic, req.body.coin.toUpperCase());
  } catch (error) {
    res.status(400).send({ status: false, error: error.message || error });
    return;
  }
  return (response.status) ? res.status(200).send(response) : res.status(400).send(response);
}
module.exports = {
  balance: balance,
  tx: txStatus,
  getMnemonic: getMnemonic,
  importAccount: importMnemonic,
  generateAddress: generateAddress,
  createTxn: createTxn,
  signTxn: signTxn,
  broadcastTxn: broadcastTxn
};