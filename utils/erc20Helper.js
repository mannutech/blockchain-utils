var Web3 = require('web3');
var config = require('../config');
var ethTx = require('ethereumjs-tx');
config.erc20ABI = [{ "constant": true, "inputs": [], "name": "name", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_spender", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "approve", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "totalSupply", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_from", "type": "address" }, { "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transferFrom", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [], "name": "decimals", "outputs": [{ "name": "", "type": "uint8" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }], "name": "balanceOf", "outputs": [{ "name": "balance", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": true, "inputs": [], "name": "symbol", "outputs": [{ "name": "", "type": "string" }], "payable": false, "stateMutability": "view", "type": "function" }, { "constant": false, "inputs": [{ "name": "_to", "type": "address" }, { "name": "_value", "type": "uint256" }], "name": "transfer", "outputs": [{ "name": "", "type": "bool" }], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": true, "inputs": [{ "name": "_owner", "type": "address" }, { "name": "_spender", "type": "address" }], "name": "allowance", "outputs": [{ "name": "", "type": "uint256" }], "payable": false, "stateMutability": "view", "type": "function" }, { "payable": true, "stateMutability": "payable", "type": "fallback" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "owner", "type": "address" }, { "indexed": true, "name": "spender", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Approval", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "from", "type": "address" }, { "indexed": true, "name": "to", "type": "address" }, { "indexed": false, "name": "value", "type": "uint256" }], "name": "Transfer", "type": "event" }];
var web3 = new Web3(new Web3.providers.HttpProvider(config.web3.http));

async function nonce(address) {
    if (address === undefined) { return Promise.reject({ status: false, error: 'no address provided' }); }
    try {
        var nonce = await web3.eth.getTransactionCount(address);
    } catch (error) {
        return Promise.reject({ status: false, error: error.message || error });
    }
    return parseInt(nonce);
};
async function balance(address) {
    console.log('function balance', address);
    if (address == undefined) { return ({ status: false, error: 'no address provided' }); }
    try {
        var bal = await web3.eth.getBalance(address);
    } catch (e) {
        return ({ status: false, error: e.message || e });
    }
    // .catch (e => { return ({ status: false, error: e.message || e }); });
    console.log('[balance]', bal);
    return (bal.status == null) ? { status: true, balance: bal } : bal;
};

async function broadcast(rawTxn) {
    console.log('[broadcast-REACHING]');
    if (rawTxn == undefined) { return Promise.reject('Deformed RawTXN'); }
    let serTxn = rawTxn.startsWith('0x') ? rawTxn : '0x' + rawTxn;
    try {
        var send = web3.eth.sendSignedTransaction(serTxn)
            .on('receipt', (e) => { console.error('[receipt]', e) })
            .on('transactionHash', function (hash) {
                console.log('[transactionHash]', hash);
            })
        var networkRes = await send;
    } catch (error) {
        return Promise.reject(error.message || error);
    }
    return networkRes;

};

async function type(address) {
    if (address === undefined) {
        return ({ status: false, error: 'no address provided' });

    }
    try {
        web3.eth.getCode(address, function (error, result) {
            if (error) {
                // logger.error('[api/balance] error address type local api:', { err: error, res: result });
                return ({ status: false, error: error.message });

            }
            let type = (result === '0x') ? 'account' : 'contract';
            // logger.debug('[type]  txn:', { type: type, address: address });
            return ({ status: true, type: type });
        });

    } catch (e) {
        return ({ status: false, error: e.message, type: 'contract' });

    }
};

async function erc20AddressBalance(atAddress, contractAddress) {

    if (contractAddress == undefined || atAddress == undefined) {
        return ({ status: false, error: 'no contract address provided' });

    }
    var erc20Balance = 0;
    try {
        erc20Balance = await (new web3.eth.Contract(config.erc20ABI, contractAddress, { from: atAddress })).methods.balanceOf(atAddress).call();
    } catch (err) {
        erc20Balance = 0;
        return ({ status: false, error: err.message });
    }

    erc20Balance = new web3.utils.BN(erc20Balance);
    return ({ status: true, balance: erc20Balance.gt(0) ? erc20Balance.toString() : 0 });
};

async function createTransaction(tx) {
    try {
        var res = await Promise.all([nonce(tx.fromAddress), balance(tx.fromAddress), erc20AddressBalance(tx.fromAddress, tx.contractAddress)]);
        let nonceValue = res[0], addressBalance = web3.utils.toBN(res[1].balance), addressErc20Balance = web3.utils.toBN(res[2].balance);
        const gasPrice = web3.utils.toBN(web3.utils.fromWei(await web3.eth.getGasPrice(), 'wei')).mul(web3.utils.toBN(4));

        if (addressBalance.lte(gasPrice)) {
            return ({ status: false, error: 'available Ethereum Balance is too low.' });
        }
        if (addressErc20Balance.lte(web3.utils.toBN(tx.amount))) {
            return ({ status: false, error: 'available ERC20 Balance is less than to transact' });
        }
        if (isNaN(parseInt(nonceValue))) { return ({ status: false, error: 'nonce is NAN' }); }
        if (web3.utils.toHex(tx.address) == web3.utils.toHex(0)) { return ({ status: false, error: 'not allowed address' }); }
        let contract = new web3.eth.Contract(config.erc20ABI, tx.contractAddress, { from: tx.fromAddress });
        const txParams = {
            nonce: nonceValue,
            gasPrice: gasPrice,
            gasLimit: config.gasLimit,
            to: tx.contractAddress,
            value: web3.utils.toHex(0),
            chainId: (config.net === 'MAINNET') ? 1 : 3,
            data: contract.methods.transfer(tx.address, tx.amount).encodeABI()
        }
        console.log('txParams', txParams);
        var unsignedTx = new ethTx(txParams).serialize().toString('hex');
    } catch (error) {
        console.log(error)
        return ({ status: false, error: error.message || error });
    }
    console.log('[createTransaction]', unsignedTx);
    return ({ status: true, message: { unsignedHex: unsignedTx } });
};

async function signTransaction(unsignedTx, privateKey) {
    let serializedTxn = '';
    try {
        var txn = new ethTx(unsignedTx);
        txn.sign(new Buffer(privateKey, 'hex'));
        serializedTxn = txn.serialize().toString('hex');
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }
    console.log('[signTransaction]', txn.getBaseFee().toString());
    console.log('[signTransaction]', serializedTxn, txn.getUpfrontCost().toString());
    return ({ status: true, message: { signedHex: serializedTxn } });
};

async function broadcastTransaction(serializedTx) {
    console.log('[broadcastTransaction]', serializedTx);
    let broadcastResponse = null;
    try {
        broadcastResponse = await broadcast(serializedTx);
    } catch (error) {
        return ({ status: false, error: error.message || error });
    }
    return ({ status: true, message: broadcastResponse });
};

async function getTxDetails(txHash) {
    if (txHash == null) { return ({ status: false, error: 'TxHash is null or empty' }); }
    try {
        var details = await web3.eth.getTransactionReceipt(txHash);
    } catch (e) {
        console.error('[getTxDetails]', e);
        return ({ status: false, error: e.message || e });
    }
    if (details == null)
        return ({ status: false, error: 'Not found' });
    console.log('[ethHelper-getTxDetails]', details);
    return ({ status: true, message: details });
}

module.exports = {
    nonce: nonce,
    createTx: createTransaction,
    signTx: signTransaction,
    broadcastTx: broadcastTransaction,
    txDetails: getTxDetails,
    balance: balance,
    erc20AddressBalance: erc20AddressBalance
};
(async () => {

    //Getting erc20 balance for an address
    /* console.log(await erc20AddressBalance('0x63b93223562b22e9a3b5db825be31797f2b650eb', '0xe7315c152a021db45a3858ea04cb804b4f79d1ac')); */

    //Getting transaction details from blockchain
    /* console.log(await getTxDetails('0x8a0e32e50338bb2816de8255e241783ce37101b107e9a9ace547805bbd2c08af')); */

    //Getting nonce for an address
    /* console.log(await nonce('0x63b93223562b22e9a3b5db825be31797f2b650eb')); */

    //creating Raw transaction 
    /* console.log(await createTransaction({
        fromAddress: '0x63b93223562b22e9a3b5db825be31797f2b650eb',
        amount: '100000000',
        contractAddress: '0xe7315c152a021db45a3858ea04cb804b4f79d1ac',
        address: '0xc3fb96e2ec87574ce002ecf24268d01f13ccb6f0'
    })); */

    //signing the rawTransaction
    /* console.log(await signTransaction('f8694d84ee6b28008303383894e7315c152a021db45a3858ea04cb804b4f79d1ac80b844a9059cbb000000000000000000000000c3fb96e2ec87574ce002ecf24268d01f13ccb6f00000000000000000000000000000000000000000000000000000000005f5e1001c8080', '')); */


    // broadcasting the transaction to the network
    /* console.log(await broadcastTransaction('f8a94d84ee6b28008303383894e7315c152a021db45a3858ea04cb804b4f79d1ac80b844a9059cbb000000000000000000000000c3fb96e2ec87574ce002ecf24268d01f13ccb6f00000000000000000000000000000000000000000000000000000000005f5e1001ca02e71ea6bd54bec0096eaecb249079c767554f57642d7ad30b99792e05776466ba07800cb348ed2f4fbd1fb4540b57c47eca5b289f893924dfd8f11321596f3bc0e')); */

})();