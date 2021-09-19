// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
/* const line = require('@line/bot-sdk'); */

const dynamoDocument = new AWS.DynamoDB.DocumentClient();
/* const client = new line.Client({
  channelAccessToken: process.env.ACCESSTOKEN,
}); */
class Response {
  constructor() {
    this.statusCode = '';
    this.headers = {};
    this.body = '';
  }
}

module.exports.index = async (event) => {
  const response = new Response();

  const queryParam = {
    TableName: 'UBIC-FOOD',
    IndexName: 'DataKind-index',
    KeyConditionExpression: '#k = :val',
    ExpressionAttributeValues: {
      ':val': 'transaction',
    },
    ExpressionAttributeNames: {
      '#k': 'DataKind',
    },
  };
  const transactionData = await new Promise((resolve, reject) => {
    dynamoDocument.query(queryParam, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
  const transactionDataItems = transactionData.Items;

  const transactions = [];
  const transactionIds = [];
  for (let i = 0; i < transactionDataItems.length; i += 1) {
    const transactionItem = transactionDataItems[i];
    if (!transactions[transactionItem.ID]) {
      transactions[transactionItem.ID] = {};
      transactionIds.push(transactionItem.ID);
    }
    transactions[transactionItem.ID][transactionItem.DataType] = transactionItem.Data;
  }

  const transactionsList = [];
  /*   const userDataPromises = [];
  for (let i = 0; i < transactionIds.length; i += 1) {
    userDataPromises.push(client.getProfile(transactions[transactionIds[i]]['transaction-user']));
  }
  const userData = await Promise.all(userDataPromises);
  console.log(userData); */
  for (let i = 0; i < transactionIds.length; i += 1) {
    transactionsList.push({
      transactionId: transactionIds[i],
      date: transactions[transactionIds[i]]['transaction-date'],
      /*       userData: userData[i], */
      foodId: transactions[transactionIds[i]]['transaction-food'],
    });
  }

  response.statusCode = 200;
  response.body = JSON.stringify(transactionsList);
  return response;
};
