const line = require('@line/bot-sdk');

const client = new line.Client({
  channelAccessToken: process.env.ACCESSTOKEN,
});
class Response {
  constructor() {
    this.statusCode = '';
    this.headers = {};
    this.body = '';
  }
}

module.exports.index = async (event) => {
  const response = new Response();

  const userIds = [];
  const query = event.queryStringParameters;
  for (let i = 0; i < Object.keys(query).length; i += 1) {
    /*     console.log(`userId${i + 1}`);
    console.log(query[`userId${i + 1}`]); */
    userIds.push(query[`userId${i + 1}`]);
  }

  /*   console.log(userIds); */

  const userDataPromises = [];
  for (let i = 0; i < userIds.length; i += 1) {
    userDataPromises.push(client.getProfile(userIds[i]));
  }
  const userData = await Promise.all(userDataPromises);
  /*   console.log(userData); */
  response.statusCode = 200;
  response.body = JSON.stringify(userData);
  return response;
};
