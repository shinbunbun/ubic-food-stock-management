// モジュール読み込み
const line = require('@line/bot-sdk');
const crypto = require('crypto');
// 各イベントごとの処理をするファイルの読み込み
const messageFunc = require('./event/message');
const followFunc = require('./event/follow');

const client = new line.Client({
  channelAccessToken: process.env.ACCESSTOKEN,
});

module.exports.index = (event, context) => {
  // 署名検証
  const signature = crypto.createHmac('sha256', process.env.CHANNELSECRET).update(event.body).digest('base64');
  let checkHeader = (event.headers || {})['X-Line-Signature'];
  if (!checkHeader) {
    checkHeader = (event.headers || {})['x-line-signature'];
  }

  const { events } = JSON.parse(event.body);
  let message;
  if (signature === checkHeader) {
    events.forEach(async (e) => {
      switch (e.type) {
        case 'message': {
          // メッセージイベントが飛んできた時はmessage.jsのindexを呼び出す
          // 処理結果をmessageに格納
          message = await messageFunc.index(e, client);
          break;
        }
        case 'follow': {
          // フォローイベントが飛んできた時はfollow.jsのindexを呼び出す
          message = followFunc.index();
          break;
        }
        default:
          break;
      }
      if (message !== undefined) {
        console.log(`message: ${JSON.stringify(message)}`);
        client.replyMessage(e.replyToken, message)
          .then((response) => {
            console.log(`response: ${response}`);
            const lambdaResponse = {
              statusCode: 200,
              headers: {
                'X-Line-Status': 'OK',
              },
              body: '{"result":"completed"}',
            };
            context.succeed(lambdaResponse);
          }).catch((err) => console.log(`${JSON.stringify(message)}\n\n\n${err}`));
      }
    });
  } else {
    console.log('署名認証エラー');
  }
};
