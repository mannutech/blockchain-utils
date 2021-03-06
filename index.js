var express = require('express'),
  app = express(),
  port = process.env.PORT || 3000,
  logger = require('./utils/logger'),
  api = require('./src/api'),
  router = express.Router();
app.use(express.json());
// NEW ACCOUNT
app.get('/getmnemonic', api.getMnemonic);
app.post('/importaccount', api.importAccount);

//BALANCE
app.get('/balance', api.balance);

// GENERATE ADDRESSES
app.post('/generateAddress', api.generateAddress);

// SENDING
app.post('/sendtransaction/createTxn', api.createTxn);
app.post('/sendtransaction/signTxn', api.signTxn);
app.post('/sendtransaction/broadcastTxn', api.broadcastTxn);

// TRANSACTION STATUS
app.get('/tx', api.tx);

app.listen(port);
logger.info('[Server] txns server started on: ' + port);

