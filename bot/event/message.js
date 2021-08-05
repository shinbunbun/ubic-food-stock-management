// eslint-disable-next-line import/no-extraneous-dependencies
const AWS = require('aws-sdk');
// eslint-disable-next-line import/no-extraneous-dependencies
const axios = require('axios');
// eslint-disable-next-line import/no-unresolved
const { v4: uuidv4 } = require('uuid');

const dynamoDocument = new AWS.DynamoDB.DocumentClient();
const s3 = new AWS.S3();

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
    case '在庫一覧':
    case '借りる':
    case '在庫補充': {
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
        if (foodItem.IntData !== undefined) {
          foods[foodItem.ID][foodItem.DataType] = foodItem.IntData;
        } else {
          foods[foodItem.ID][foodItem.DataType] = foodItem.Data;
        }
      }
      message = [];
      for (let i = 0; i < Math.ceil(foodIds.length / 10); i += 1) {
        message.push({
          type: 'flex',
          altText: 'altText',
          contents: {
            type: 'carousel',
            contents: [],
          },
        });
      }
      switch (event.message.text) {
        case '在庫一覧':
          message.altText = '在庫一覧';
          break;
        case '借りる':
          message.altText = '借りる食材を選んでください';
          break;
        case '補充':
          message.altText = '補充する食材をえらんでください';
          break;

        default:
          break;
      }
      for (let i = 0; i < foodIds.length; i += 1) {
        const messageContent = {
          type: 'bubble',
          header: {
            type: 'box',
            layout: 'vertical',
            contents: [
              {
                type: 'text',
                text: `${i + 1}/${foodIds.length}`,
                color: '#ffffff',
                weight: 'regular',
              },
            ],
          },
          hero: {
            type: 'image',
            url: foods[foodIds[i]]['food-image'],
            size: 'full',
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
                wrap: true,
              },
              {
                type: 'text',
                text: foods[foodIds[i]]['food-maker'],
                align: 'center',
                wrap: true,
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
                    type: 'text',
                    text: `在庫: ${foods[foodIds[i]]['food-stock']}個`,
                    offsetBottom: '15px',
                    align: 'center',
                  },
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
                  {
                    type: 'button',
                    action: {
                      type: 'message',
                      label: '補充する',
                      text: `replenishment:${foodIds[i]}`,
                    },
                    style: 'primary',
                    color: '#25b7c0',
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
        };
        if (foods[foodIds[i]]['food-stock'] === 0) {
          messageContent.body.contents[3].contents[1].style = 'secondary';
          messageContent.body.contents[3].contents[1].action.text = '在庫切れ';
        }
        message[Math.floor(i / 10)].contents.contents.push(messageContent);
      }
      /* console.log(foods); */
      break;
    }
    case 'マイリスト':
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
      switch (event.message.text) {
        case '貸出中の食料':
          message[0].text = '貸出中の食料です';
          message[1].altText = '貸出中の食料です';
          break;
        case '返却':
          message[0].text = '返却する商品を選んでください';
          message[1].altText = '返却する商品を選んでください';
          break;
        default:
          break;
      }
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
      if (!foodIdsQueryRes[0]) {
        return {
          type: 'text',
          text: '現在貸出中の食料はありません',
        };
      }
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
            size: 'full',
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
                wrap: true,
              },
              {
                type: 'text',
                text: 'maker',
                align: 'center',
                wrap: true,
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
                    type: 'text',
                    text: '在庫: n個',
                    offsetBottom: '15px',
                    align: 'center',
                  },
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
          } else if (foodItemsQueryRes[i].Items[j].DataType === 'food-stock') {
            message[1].contents.contents[i].body.contents[3].contents[0].text = `在庫: ${foodItemsQueryRes[i].Items[j].IntData}個`;
          }
        }
      }
      break;
    }
    case '在庫追加': {
      const { userId } = event.source;
      const updateParam = {
        TableName: 'UBIC-FOOD',
        Key: {
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
    case 'ヘルプ': {
      message = {
        type: 'text',
        text: `使い方は以下のとおりです。
    
- 「在庫一覧」: 在庫の一覧が確認できます
- 「借りる」: 食料を借りることができます
- 「返却」: 食料の返却ができます
- 「マイリスト」: 自分が借りている食料の一覧が確認できます
- 「在庫補充」: 食材を補充できます
- 「在庫追加」: 在庫一覧にない新しい食料を追加できます
- 「ヘルプ」: 使い方が確認できます`,
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

        const stockCountUpdateParam = {
          TableName: 'UBIC-FOOD',
          Key: {
            ID: userMessage.substr(5),
            DataType: 'food-stock',
          },
          ExpressionAttributeNames: {
            '#d': 'IntData',
          },
          ExpressionAttributeValues: {
            ':IntData': 1,
          },
          UpdateExpression: 'SET #d = #d - :IntData',
        };
        await new Promise((resolve, reject) => {
          dynamoDocument.update(stockCountUpdateParam, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
        let deadLine = date.getTime() + 259200000;
        deadLine = new Date(deadLine);
        message = {
          type: 'text',
          text: `貸し出し完了しました。返却期限は${deadLine.getMonth() + 1}/${deadLine.getDate()}です`,
        };
        return message;
      }

      if (userMessage.substr(0, 7) === 'return:') {
        const transactionId = userMessage.substr(7);

        const foodQueryParam = {
          TableName: 'UBIC-FOOD',
          ExpressionAttributeNames: {
            '#i': 'ID',
            '#d': 'DataType',
          },
          ExpressionAttributeValues: {
            ':id': transactionId,
            ':DataType': 'transaction-food',
          },
          KeyConditionExpression: '#i = :id AND #d = :DataType',
        };
        const foodInformation = await new Promise((resolve, reject) => {
          dynamoDocument.query(foodQueryParam, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });

        const stockCountUpdateParam = {
          TableName: 'UBIC-FOOD',
          Key: {
            ID: foodInformation.Items[0].Data,
            DataType: 'food-stock',
          },
          ExpressionAttributeNames: {
            '#d': 'IntData',
          },
          ExpressionAttributeValues: {
            ':IntData': 1,
          },
          UpdateExpression: 'SET #d = #d + :IntData',
        };
        await new Promise((resolve, reject) => {
          dynamoDocument.update(stockCountUpdateParam, (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });

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

      if (userMessage.substr(0, 14) === 'replenishment:') {
        const foodId = userMessage.substr(14);
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
            ':Data': 'foodReplenishmentMode',
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
          text: '補充する個数を半角数字で入力してください',
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

      if (userContextQueryRes.Items[0]) {
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
                      Data: `https://${process.env.S3BUCKET}.s3.ap-northeast-1.amazonaws.com/bbc366b61cd386e32143ebafbc3f49ec.png`,
                      DataKind: 'food',
                    },
                  },
                }, {
                  PutRequest: {
                    Item: {
                      ID: foodId,
                      DataType: 'food-stock',
                      IntData: 1,
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
          case 'foodImageMode': {
            message = {
              type: 'text',
              text: '食材の画像を送信してください。',
            };
            return message;
          }
          case 'foodReplenishmentMode': {
            const dataKind = userContextQueryRes.Items[0].DataKind.split('&');
            let foodId;
            dataKind.forEach((dataKindItem) => {
              if (dataKindItem.match(/foodId/)) {
                [, foodId] = dataKindItem.split('=');
              }
            });
            const stockCountUpdateParam = {
              TableName: 'UBIC-FOOD',
              Key: {
                ID: foodId,
                DataType: 'food-stock',
              },
              ExpressionAttributeNames: {
                '#d': 'IntData',
              },
              ExpressionAttributeValues: {
                ':IntData': Number(event.message.text),
              },
              UpdateExpression: 'SET #d = #d + :IntData',
            };
            await new Promise((resolve, reject) => {
              dynamoDocument.update(stockCountUpdateParam, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              });
            });
            const userContextDeleteParam = {
              TableName: 'UBIC-FOOD',
              Key: {
                ID: event.source.userId,
                DataType: 'user-context',
              },
            };
            await new Promise((resolve, reject) => {
              dynamoDocument.delete(userContextDeleteParam, (err, data) => {
                if (err) {
                  reject(err);
                } else {
                  resolve(data);
                }
              });
            });
            message = {
              type: 'text',
              text: '在庫の追加が完了しました！',
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
const imageEvent = async (event) => {
  const messageId = event.message.id;
  /*   const imageBinary = await client.getMessageContent(messageId);
  let image = '';
  // eslint-disable-next-line no-restricted-syntax
  for await (const chunk of imageBinary) {
    console.log(chunk);
    image += chunk;
  }
  console.log(image);
  console.log(Buffer.from(image, 'base64')); */
  /* console.log(image); */
  const imageResponse = await axios.get(`https://api-data.line.me/v2/bot/message/${messageId}/content`, { responseType: 'arraybuffer', headers: { Authorization: `Bearer ${process.env.ACCESSTOKEN}` } });
  console.log(imageResponse.data);
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
  if (userContextQueryRes.Items[0]) {
    const dataKind = userContextQueryRes.Items[0].DataKind.split('&');
    let foodId;
    dataKind.forEach((dataKindItem) => {
      if (dataKindItem.match(/foodId/)) {
        [, foodId] = dataKindItem.split('=');
      }
    });
    const S3UploadParam = {
      Body: imageResponse.data,
      Bucket: process.env.S3BUCKET,
      Key: [foodId, 'jpeg'].join('.'),
      ContentType: 'image/jpeg',
      ACL: 'public-read',
    };
    await new Promise((resolve, reject) => {
      s3.upload(S3UploadParam, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    const foodImageUpdateParam = {
      TableName: 'UBIC-FOOD',
      Key: { // 更新したい項目をプライマリキー(及びソートキー)によって１つ指定
        ID: foodId,
        DataType: 'food-image',
      },
      ExpressionAttributeNames: {
        '#d': 'Data',
      },
      ExpressionAttributeValues: {
        ':Data': `https://${process.env.S3BUCKET}.s3.ap-northeast-1.amazonaws.com/${foodId}.jpeg`,
      },
      UpdateExpression: 'SET #d = :Data',
    };
    await new Promise((resolve, reject) => {
      dynamoDocument.update(foodImageUpdateParam, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    const userContextDeleteParam = {
      TableName: 'UBIC-FOOD',
      Key: {
        ID: event.source.userId,
        DataType: 'user-context',
      },
    };
    await new Promise((resolve, reject) => {
      dynamoDocument.delete(userContextDeleteParam, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
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
    const foodInformation = await new Promise((resolve, reject) => {
      dynamoDocument.query(foodQueryParam, (err, data) => {
        if (err) {
          reject(err);
        } else {
          resolve(data);
        }
      });
    });
    let foodName;
    let foodMaker;
    foodInformation.Items.forEach((item) => {
      if (item.DataType === 'food-maker') {
        foodMaker = item.Data;
      } else if (item.DataType === 'food-name') {
        foodName = item.Data;
      }
    });

    return [{
      type: 'text',
      text: '画像の登録が完了しました！以下の食材が登録されました。',
    }, {
      type: 'flex',
      altText: '追加された食材',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [],
        },
        hero: {
          type: 'image',
          url: `https://${process.env.S3BUCKET}.s3.ap-northeast-1.amazonaws.com/${foodId}.jpeg`,
          size: 'full',
        },
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: foodName,
              size: 'xl',
              weight: 'bold',
              align: 'center',
            },
            {
              type: 'text',
              text: foodMaker,
              align: 'center',
            },
          ],
        },
        styles: {
          header: {
            backgroundColor: '#008282',
          },
        },
      },
    }];
  }
  const message = {
    type: 'text',
    text: '食料の登録をしたい場合は、「食料追加」と送信してください。',
  };
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
      message = imageEvent(event, client);
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
