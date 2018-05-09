
var bip39 = require('bip39')
var web3 = require('ethers');
var hdkey = require('hdkey');
var sysUtils = require('util');
var bitcoin = require('bitcoinjs-lib');
var ethereumUtils = require('ethereumjs-util');
var Insight = require('bitcore-explorers').Insight;
var bitcore = require('bitcore-lib');
var config = require('../config');
var coininfo = require('coininfo');
var btcHandler = new Insight(/* 'https://insight.bitpay.com', bitcoin.networks.bitcoin */);
const CHAIN_TYPE = {
    RECEIVE: { BTC: 0, ETH: 0 },
    CHANGE: { BTC: 0, ETH: 1 }
};
const CURRENT_NETWORK = bitcoin.networks[config.network.BTC[config.current]];
const CURRENT_NETWORK_VERSION = coininfo.bitcoin[config.current].versions.bip32;

let k = bitcoin.ECPair.makeRandom({ compressed: false, network: bitcoin.networks.testnet });
console.log(k.getAddress(), k.toWIF());
var MAX_GENERATOR_LIMIT = 100;
var SUPPORTED_COINS = ['BTC', 'ETH'];

var addressDerivation = {
    ETH: function (xpub, index) {
        let account = hdkey.fromExtendedKey(xpub).deriveChild(index)._publicKey;
        let nonCheckSumAddress = ethereumUtils.publicToAddress(account, true).toString('hex');
        return ethereumUtils.toChecksumAddress(nonCheckSumAddress);
    },
    BTC: function (xpub, index) {
        return bitcoin.HDNode.fromBase58(xpub,CURRENT_NETWORK).derive(index).keyPair.getAddress();
    },
};
async function generateAccount(coinType) {
    let purpose = 44, coin = '', accountIndex = 0, chainType = 0; //External = 0 (receiving addresses); Internal =1 (change addresses); 
    let path = "m/";
    var account = {
        coin: coinType.toUpperCase(),
        mnemonicPhrase: '',
        accountXpriv: '',
        accountXpub: '',
        addressDerivationXpub: '',
        addresses: []
    };
    switch (coinType.toUpperCase()) {
        case 'BTC': {
            coin = 0;
            accountIndex = 0;
            path += purpose + "'/";
            path += coin + "'/";
            path += accountIndex + "'";
            let mnemonicString = mnemonicGenerate();
            let hdNode = bitcoin.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(mnemonicString),CURRENT_NETWORK);
            let xprivImport = hdNode.derivePath(path).toBase58();
            let xpubImport = hdNode.derivePath(path).neutered().toBase58();
            let neuteredXpub = hdkey.fromExtendedKey(xpubImport, CURRENT_NETWORK_VERSION).deriveChild(chainType).toJSON().xpub;
            let receivingAddresses = await generateAddressesFromXpub(neuteredXpub, coinType.toUpperCase(), 5);
            account.mnemonicPhrase = mnemonicString;
            account.accountXpriv = xprivImport.toString();
            account.accountXpub = xpubImport.toString();
            account.addressDerivationXpub = neuteredXpub;
            account.addresses = receivingAddresses;
            break;
        }
        case 'ETH': {
            coin = 60;
            accountIndex = 0;
            path += purpose + "'/";
            path += coin + "'/";
            path += accountIndex + "'";
            let mnemonicString = mnemonicGenerate();
            let hdNode = bitcoin.HDNode.fromSeedBuffer(bip39.mnemonicToSeed(mnemonicString));
            let xprivImport = hdNode.derivePath(path).toBase58();
            let xpubImport = hdNode.derivePath(path).neutered().toBase58();
            let neuteredXpub = hdkey.fromExtendedKey(xpubImport).deriveChild(chainType).toJSON().xpub;
            let receivingAddresses = await generateAddressesFromXpub(neuteredXpub, coinType.toUpperCase(), 5);
            account.mnemonicPhrase = mnemonicString;
            account.accountXpriv = xprivImport.toString();
            account.accountXpub = xpubImport.toString();
            account.addressDerivationXpub = neuteredXpub;
            account.addresses = receivingAddresses;
            break;
        }
        default: {
            return { status: false, error: 'No such coin supported' }
            break;
        }
    }
    console.log('[offlineTool-generateAccount]', account);
    return ({ status: true, message: account });
}

function mnemonicGenerate() {
    let generatedMnemonic = bip39.generateMnemonic();
    return bip39.validateMnemonic(generatedMnemonic) ? generatedMnemonic.toString() : '';
}

async function generateAddressesFromXpub(neuteredXpub, coinType, total = 2) {
    console.log(neuteredXpub, coinType, total)
    if (neuteredXpub == null || parseInt(total) < 0 || parseInt(total) > MAX_GENERATOR_LIMIT || coinType == null || !SUPPORTED_COINS.includes(coinType.toUpperCase())) throw new Error('XPUB length ');
    if (!bitcoin.HDNode.fromBase58(neuteredXpub, CURRENT_NETWORK).isNeutered()) { throw new Error('Please provide neutered Xpub ') }
    if (hdkey.fromExtendedKey(neuteredXpub, CURRENT_NETWORK_VERSION).depth !== 4) { throw new Error('Please provide neutered Xpub at depth 4') };
    let genrtdAddress = [];
    for (let i = 0; i < total; i++) {
        genrtdAddress.push({
            path: 'm/' + i,
            index: i,
            publicAddress: addressDerivation[coinType].call(null, neuteredXpub, i),
            privateKey: ''
        });
    }
    return genrtdAddress || null;
}

async function balanceAtAddress(address, coinType) {
    if (SUPPORTED_COINS.includes(coinType.toUpperCase()))
        switch (coinType.toUpperCase()) {
            case 'BTC': {
                bitcoin.address.fromBase58Check(address);
                btcHandler.address = sysUtils.promisify(btcHandler.address)
                console.log(await btcHandler.address(address));
                break;
            }
            case 'ETH': {
                ethereumUtils.isValidChecksumAddress(address);
                console.log(await web3Handler.eth.getBalance(ethereumUtils.toChecksumAddress(address)));
                break;
            }
            default: console.log('hi'); break;
        }

}
async function generateKeyPairFromXpriv(xpriv, coinType, total = 10) {
    if (!SUPPORTED_COINS.includes(coinType.toUpperCase())) { throw new Error('Coin not supported'); }
    if (bitcoin.HDNode.fromBase58(xpriv).isNeutered()) { throw new Error('Please provide Master Private key in xpriv format') }
    if (hdkey.fromExtendedKey(xpriv).depth !== 3) { throw new Error('Please provide Master Private key at Account depth or at 3') };
    let hdNode = bitcoin.HDNode.fromBase58(xpriv);
    let chainType = CHAIN_TYPE.RECEIVE[coinType.toUpperCase()];
    let result = generatePubPrivFromHDNode(hdNode, chainType, total, coinType);
    console.log('[offlineTool-generatePubPrivFromHDNode]', result);
    return result || null;
}
function generatePubPrivFromHDNode(HDNode, chainType, total = 10, coinType) {
    let chainWallet = HDNode.derive(chainType);
    let resultArray = []
    switch (coinType.toUpperCase()) {
        case 'BTC': {
            for (let i = 0; i < total; i++) {
                resultArray.push({
                    path: 'm/' + chainType + '/' + i,
                    index: i,
                    publicAddress: chainWallet.derive(i).keyPair.getAddress(),
                    privateKey: chainWallet.derive(i).keyPair.toWIF()
                });
            }
            break;
        }
        case 'ETH': {
            for (let i = 0; i < total; i++) {
                resultArray.push({
                    path: 'm/' + chainType + '/' + i,
                    index: i,
                    publicAddress: ethereumUtils.toChecksumAddress(ethereumUtils.publicToAddress(chainWallet.derive(i).getPublicKeyBuffer(), true).toString('hex')),
                    privateKey: ethereumUtils.addHexPrefix(chainWallet.derive(i).keyPair.d.toBuffer(32).toString('hex'))
                });
            }
            break;
        }
        default: { throw new Error('No such coin supported'); break; }
    }
    return resultArray || null;
}

async function generateAddresses(extendedKey, coinType, total = 10) {
    let addressArray = [];
    if (!SUPPORTED_COINS.includes(coinType.toUpperCase())) { return ({ status: false, error: error.message || error }); }
    if (bitcoin.HDNode.fromBase58(extendedKey).isNeutered()) {
        try {
            addressArray = await generateAddressesFromXpub(extendedKey, coinType.toUpperCase(), total);
        } catch (error) {
            return ({ status: false, error: error.message || error });
        }
    } else {
        try {
            addressArray = await generateKeyPairFromXpriv(extendedKey, coinType.toUpperCase(), total);
        } catch (error) {
            return ({ status: false, error: error.message || error });
        }
    }
    return ({ status: true, message: addressArray || ['Some error happened'] });
}
module.exports = {
    generateAccount: generateAccount,
    generateAddresses: generateAddresses
}
