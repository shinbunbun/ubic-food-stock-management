// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');

const dynamoDocument = new AWS.DynamoDB.DocumentClient();

class Response {
  constructor() {
    this.statusCode = '';
    this.headers = {};
    this.body = '';
  }
}

module.exports.index = async (event) => {
  const response = new Response();
  /* const { lineId } = event.queryStringParameters; */
  const queryParam = {
    TableName: 'UBIC-FOOD',
    IndexName: 'DataKind-index',
    KeyConditionExpression: '#k = :val',
    ExpressionAttributeValues: {
      ':val': 'food',
    },
    ExpressionAttributeNames: {
      '#k': 'DataKind',
    },
  };
  const foodData = await new Promise((resolve, reject) => {
    dynamoDocument.query(queryParam, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
  const foodDataItems = foodData.Items;
  console.log(foodDataItems);
  const foods = {};
  const foodIds = [];
  for (let i = 0; i < foodDataItems.length; i += 1) {
    const foodItem = foodDataItems[i];
    if (!foods[foodItem.ID]) {
      foods[foodItem.ID] = {};
      foodIds.push(foodItem.ID);
    }
    if (foodItem.IntData !== undefined) {
      foods[foodItem.ID][foodItem.DataType] = foodItem.IntData;
    } else {
      foods[foodItem.ID][foodItem.DataType] = foodItem.Data;
    }
  }

  const foodsList = [];
  for (let i = 0; i < foodIds.length; i += 1) {
    foodsList.push({
      id: foodIds[i],
      name: foods[foodIds[i]]['food-name'],
      maker: foods[foodIds[i]]['food-maker'],
      image: foods[foodIds[i]]['food-image'],
      stock: foods[foodIds[i]]['food-stock'].toString(),
    });
  }
  response.body = JSON.stringify({
    foodsList,
  });
  response.statusCode = 200;
  return response;
};
