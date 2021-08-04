// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
// eslint-disable-next-line import/no-unresolved
const { v4: uuidv4 } = require('uuid');

const dynamoDocument = new AWS.DynamoDB.DocumentClient();

// テキストメッセージの処理をする関数
const textEvent = async (event) => {
  let message;
  // メッセージのテキストごとに条件分岐
  switch (event.message.text) {
    // 'こんにちは'というメッセージが送られてきた時
    case 'こんにちは': {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'Hello, world',
      };
      break;
    }
    case '借りる': {
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
      const foods = {};
      const foodIds = [];
      for (let i = 0; i < foodDataItems.length; i += 1) {
        const foodItem = foodDataItems[i];
        if (!foods[foodItem.ID]) {
          foods[foodItem.ID] = {};
          foodIds.push(foodItem.ID);
        }
        foods[foodItem.ID][foodItem.DataType] = foodItem.Data;
      }
      message = {
        type: 'flex',
        altText: '借りる食材を選んでください',
        contents: {
          type: 'carousel',
          contents: [],
        },
      };
      for (let i = 0; i < foodIds.length; i += 1) {
        message.contents.contents.push({
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [],
          },
          hero: {
            type: 'image',
            url: foods[foodIds[i]]['food-image'],
            size: 'xl',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: foods[foodIds[i]]['food-name'],
                size: 'xl',
                weight: 'bold',
                align: 'center',
              },
              {
                type: 'text',
                text: foods[foodIds[i]]['food-maker'],
                align: 'center',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'message',
                      label: '借りる',
                      text: `rent:${foodIds[i]}`,
                    },
                    style: 'primary',
                    offsetBottom: '10px',
                  },
                ],
                paddingTop: '30px',
              },
            ],
          },
          styles: {
            header: {
              backgroundColor: '#008282',
            },
          },
        });
      }
      /* console.log(foods); */
      break;
    }
    case '返却': {
      message = [{
        type: 'text',
        text: '返却する商品を選んでください',
      }, {
        type: 'flex',
        altText: '返却する商品を選んでください',
        contents: {
          type: 'carousel',
          contents: [],
        },
      }];
      const queryParam = {
        TableName: 'UBIC-FOOD',
        IndexName: 'Data-DataType-index',
        KeyConditionExpression: '#k = :val AND #d = :DataType',
        ExpressionAttributeValues: {
          ':val': event.source.userId,
          ':DataType': 'transaction-user',
        },
        ExpressionAttributeNames: {
          '#k': 'Data',
          '#d': 'DataType',
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
      const foodIdsPromise = [];
      for (let i = 0; i < transactionData.Items.length; i += 1) {
        const transactionFoodQueryParam = {
          TableName: 'UBIC-FOOD',
          ExpressionAttributeNames: {
            '#i': 'ID',
            '#d': 'DataType',
          },
          ExpressionAttributeValues: {
            ':id': transactionData.Items[i].ID,
            ':DataType': 'transaction-food',
          },
          KeyConditionExpression: '#i = :id AND #d = :DataType',
        };
        foodIdsPromise.push(new Promise((resolve, reject) => {
          dynamoDocument.query(transactionFoodQueryParam, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        }));
      }
      const foodIdsQueryRes = await Promise.all(foodIdsPromise);
      console.log(foodIdsQueryRes[0].Items[0]);
      const foodItemsPromise = [];
      for (let i = 0; i < foodIdsQueryRes.length; i += 1) {
        const foodId = foodIdsQueryRes[i].Items[0].Data;
        console.log(foodId);
        const foodQueryParam = {
          TableName: 'UBIC-FOOD',
          ExpressionAttributeNames: {
            '#i': 'ID',
          },
          ExpressionAttributeValues: {
            ':id': foodId,
          },
          KeyConditionExpression: '#i = :id',
        };
        foodItemsPromise.push(new Promise((resolve, reject) => {
          dynamoDocument.query(foodQueryParam, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        }));
      }
      const foodItemsQueryRes = await Promise.all(foodItemsPromise);
      for (let i = 0; i < foodItemsQueryRes.length; i += 1) {
        message[1].contents.contents.push({
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [],
          },
          hero: {
            type: 'image',
            url: 'imageUrl',
            size: 'xl',
          },
          body: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: 'title',
                size: 'xl',
                weight: 'bold',
                align: 'center',
              },
              {
                type: 'text',
                text: 'maker',
                align: 'center',
              },
              {
                type: 'separator',
                margin: 'md',
              },
              {
                type: 'box',
                layout: 'vertical',
                contents: [
                  {
                    type: 'button',
                    action: {
                      type: 'message',
                      label: '返却',
                      text: `return:${foodIdsQueryRes[i].Items[0].ID}`,
                    },
                    style: 'primary',
                    offsetBottom: '10px',
                  },
                ],
                paddingTop: '30px',
              },
            ],
          },
          styles: {
            header: {
              backgroundColor: '#008282',
            },
          },
        });
        for (let j = 0; j < foodItemsQueryRes[i].Items.length; j += 1) {
          console.log(foodItemsQueryRes[i].Items[j].DataType);
          if (foodItemsQueryRes[i].Items[j].DataType === 'food-name') {
            message[1].contents.contents[i].body.contents[0]
              .text = foodItemsQueryRes[i].Items[j].Data;
          } else if (foodItemsQueryRes[i].Items[j].DataType === 'food-maker') {
            message[1].contents.contents[i].body.contents[1]
              .text = foodItemsQueryRes[i].Items[j].Data;
          } else if (foodItemsQueryRes[i].Items[j].DataType === 'food-image') {
            message[1].contents.contents[i].hero.url = foodItemsQueryRes[i].Items[j].Data;
          }
        }
      }
      break;
    }
    case '食料追加': {
      const { userId } = event.source;
      const updateParam = {
        TableName: 'UBIC-FOOD',
        Key: { // 更新したい項目をプライマリキー(及びソートキー)によって１つ指定
          ID: userId,
          DataType: 'user-context',
        },
        ExpressionAttributeNames: {
          '#d': 'Data',
          '#k': 'DataKind',
        },
        ExpressionAttributeValues: {
          ':Data': 'foodTitleMode',
          ':DataKind': 'user',
        },
        UpdateExpression: 'SET #d = :Data, #k = :DataKind',
      };
      await new Promise((resolve, reject) => {
        dynamoDocument.update(updateParam, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
      message = {
        type: 'text',
        text: '追加する食料の商品名を送信してください',
      };
      break;
    }
    // 上で条件分岐した以外のメッセージが送られてきた時
    default: {
      const userMessage = event.message.text;
      if (userMessage.substr(0, 5) === 'rent:') {
        const transactionId = uuidv4();
        /* console.log(transactionId); */
        const date = new Date();
        /* console.log(date); */
        const params = {
          RequestItems: {
            'UBIC-FOOD': [{
              PutRequest: {
                Item: {
                  ID: transactionId,
                  DataType: 'transaction-user',
                  Data: event.source.userId,
                  DataKind: 'transaction',
                },
              },
            }, {
              PutRequest: {
                Item: {
                  ID: transactionId,
                  DataType: 'transaction-food',
                  Data: userMessage.substr(5),
                  DataKind: 'transaction',
                },
              },
            }, {
              PutRequest: {
                Item: {
                  ID: transactionId,
                  DataType: 'transaction-date',
                  Data: date.getTime().toString(),
                  DataKind: 'transaction',
                },
              },
            }],
          },
        };
        await dynamoDocument.batchWrite(params, (e) => {
          if (e) {
            console.log(e);
          }
        }).promise();
        let deadLine = date.getTime() + 259200000;
        deadLine = new Date(deadLine);
        message = {
          type: 'text',
          text: `貸し出し完了しました。返却期限は${deadLine.getMonth() + 1}/${deadLine.getDate()}です`,
        };
        return message;
      } if (userMessage.substr(0, 7) === 'return:') {
        const transactionId = userMessage.substr(7);
        const deleteParam = {
          RequestItems: {
            'UBIC-FOOD': [{
              DeleteRequest: {
                Key: {
                  ID: transactionId,
                  DataType: 'transaction-user',
                },
              },
            }, {
              DeleteRequest: {
                Key: {
                  ID: transactionId,
                  DataType: 'transaction-food',
                },
              },
            }, {
              DeleteRequest: {
                Key: {
                  ID: transactionId,
                  DataType: 'transaction-date',
                },
              },
            }],
          },
        };
        await new Promise((resolve, reject) => {
          dynamoDocument.batchWrite(deleteParam, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
        message = {
          type: 'text',
          text: '返却が完了しました',
        };
        return message;
      }

      const userContextQueryParam = {
        TableName: 'UBIC-FOOD',
        ExpressionAttributeNames: {
          '#i': 'ID',
          '#d': 'DataType',
        },
        ExpressionAttributeValues: {
          ':id': event.source.userId,
          ':DataType': 'user-context',
        },
        KeyConditionExpression: '#i = :id AND #d = :DataType',
      };
      const userContextQueryRes = await new Promise((resolve, reject) => {
        dynamoDocument.query(userContextQueryParam, (err, data) => {
          if (err) {
            reject(err);
          } else {
            resolve(data);
          }
        });
      });
      console.log(userContextQueryRes.Items);
      if (userContextQueryRes.Items !== []) {
        const context = userContextQueryRes.Items[0].Data;
        switch (context) {
          case 'foodTitleMode': {
            const foodId = uuidv4();
            const putFoodParam = {
              RequestItems: {
                'UBIC-FOOD': [{
                  PutRequest: {
                    Item: {
                      ID: foodId,
                      DataType: 'food-name',
                      Data: event.message.text,
                      DataKind: 'food',
                    },
                  },
                }, {
                  PutRequest: {
                    Item: {
                      ID: foodId,
                      DataType: 'food-maker',
                      Data: '不明',
                      DataKind: 'food',
                    },
                  },
                }, {
                  PutRequest: {
                    Item: {
                      ID: foodId,
                      DataType: 'food-image',
                      Data: 'https://ubic-food-stock-management.s3.ap-northeast-1.amazonaws.com/bbc366b61cd386e32143ebafbc3f49ec.png',
                      DataKind: 'food',
                    },
                  },
                }],
              },
            };
            await new Promise((resolve, reject) => {
              dynamoDocument.batchWrite(putFoodParam, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              });
            });
            const userContextUpdateParam = {
              TableName: 'UBIC-FOOD',
              Key: { // 更新したい項目をプライマリキー(及びソートキー)によって１つ指定
                ID: event.source.userId,
                DataType: 'user-context',
              },
              ExpressionAttributeNames: {
                '#d': 'Data',
                '#k': 'DataKind',
              },
              ExpressionAttributeValues: {
                ':Data': 'foodMakerMode',
                ':DataKind': `user&foodId=${foodId}`,
              },
              UpdateExpression: 'SET #d = :Data, #k = :DataKind',
            };
            await new Promise((resolve, reject) => {
              dynamoDocument.update(userContextUpdateParam, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              });
            });
            message = {
              type: 'text',
              text: `「${event.message.text}」を追加しました。続いて商品のメーカーを教えてください。`,
            };
            return message;
          }
          case 'foodMakerMode': {
            const dataKind = userContextQueryRes.Items[0].DataKind.split('&');
            let foodId;
            dataKind.forEach((dataKindItem) => {
              if (dataKindItem.match(/foodId/)) {
                [, foodId] = dataKindItem.split('=');
              }
            });
            console.log(foodId);
            const foodUpdateParam = {
              TableName: 'UBIC-FOOD',
              Key: { // 更新したい項目をプライマリキー(及びソートキー)によって１つ指定
                ID: foodId,
                DataType: 'food-maker',
              },
              ExpressionAttributeNames: {
                '#d': 'Data',
              },
              ExpressionAttributeValues: {
                ':Data': event.message.text,
              },
              UpdateExpression: 'SET #d = :Data',
            };
            await new Promise((resolve, reject) => {
              dynamoDocument.update(foodUpdateParam, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              });
            });

            const userContextUpdateParam = {
              TableName: 'UBIC-FOOD',
              Key: { // 更新したい項目をプライマリキー(及びソートキー)によって１つ指定
                ID: event.source.userId,
                DataType: 'user-context',
              },
              ExpressionAttributeNames: {
                '#d': 'Data',
              },
              ExpressionAttributeValues: {
                ':Data': 'foodImageMode',
              },
              UpdateExpression: 'SET #d = :Data',
            };
            await new Promise((resolve, reject) => {
              dynamoDocument.update(userContextUpdateParam, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              });
            });
            message = {
              type: 'text',
              text: 'メーカーの登録が完了しました。続いて食材の画像を送信してください。',
            };
            return message;
          }
          default:
            break;
        }
      }

      message = {
        type: 'text',
        text: `受け取ったメッセージ: ${event.message.text}\nそのメッセージの返信には対応してません...`,
      };
      break;
    }
  }
  return message;
};

// イメージを処理する関数
const imageEvent = () => {
  // 返信するメッセージを作成
  const message = {
    type: 'text',
    text: '画像を受け取りました！',
  };
  // 関数の呼び出し元（index）に返信するメッセージを返す
  return message;
};

// メッセージイベントが飛んできた時に呼び出される
exports.index = (event, client) => {
  let message;
  // メッセージタイプごとの条件分岐
  switch (event.message.type) {
    case 'text': {
      // テキストの場合はtextEventを呼び出す
      // 実行結果をmessageに格納する
      message = textEvent(event, client);
      break;
    }
    case 'image': {
      // イメージの場合はimageEventを呼び出す
      // 実行結果をmessageに格納する
      message = imageEvent();
      break;
    }
    // それ以外の場合
    default: {
      // 返信するメッセージを作成
      message = {
        type: 'text',
        text: 'そのイベントには対応していません...',
      };
      break;
    }
  }
  // 関数の呼び出し元（bot.jsのindex）に返信するメッセージを返す
  return message;
};
