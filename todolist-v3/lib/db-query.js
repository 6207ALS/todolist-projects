const config = require("./config");
const { Client } = require("pg");

const logQuery = (statement, ...parameters) => {
  let rawTimeStamp = new Date();
  let timeStamp = rawTimeStamp.toString().substring(4, 24);

  let timeArray = timeStamp.split(" ");
  let timeParts = {
    month: timeArray[0],
    day: timeArray[1],
    year: timeArray[2],
    time: timeArray[3],
  };

  let formattedTimeStamp = `[${timeParts.month}/${timeParts.day}/` +
  `${timeParts.year}:${timeParts.time}]`;
  
  console.log(formattedTimeStamp, statement, parameters);
};

const isProduction = (config.NODE_ENV === "production");
const CONNECTION = {
  connectionString: config.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
}

module.exports = {
  async dbQuery(statement, ...parameters) {
    let client = new Client( CONNECTION );

    await client.connect();
    logQuery(statement, ...parameters);
    let result = await client.query(statement, parameters);
    await client.end();

    return result;
  }
}