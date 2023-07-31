const legacy = require("./serverModules/legacy.js");
const logger = require("./serverModules/logger.js");
const fs = require("fs");
const JDON = require("./serverModules/jdon.js");
const accounts = require("./serverModules/accounts.js");
const sync = require("./serverModules/sync.js");

require('dotenv').config(); // give access to .env file

const config = JDON.toJSON(
  fs.readFileSync(
    __dirname + "/config.jdon",
    {
      "encoding": "utf8",
      "flag": "r"
    }
  ),
);

logger.init(fs, __dirname + "/logs", "logs.txt", "logs.html", "lastlog.txt", async () => {
  legacy.init(logger, config);
  sync.init(null, config, process.env, logger); // database from sync.js not required
  // await run1();
  await run2();

  process.exit();
});


// changing code goes in here, for migration
async function run1() {
  await legacy.connectCurrent();

  accounts.init(
    legacy.dbManager.db.collection("accounts"),
    legacy.dbManager.api,
    config
  );

  await legacy.fillReferenceQueue(
    "accounts",
    ["_id"]
  );
  
  let batch = 0;
  while (true) {
    await legacy.connectLegacy();
    await legacy.fillQueue(
      "users",
      batch++,
      200
    );

    await legacy.connectCurrent();
    accounts.init(
      legacy.dbManager.db.collection("accounts"),
      legacy.dbManager.api,
      config
    );
    
    logger.log("\n\nSTART OF BATCH");
    const length = await legacy.emptyQueue(async (id, doc) => {
      let isValid = false;
      let name = "";
      const mrCodeName = "mrcode/" + id;
      if (legacy.inReferenceQueue(mrCodeName)) {
        // name = (doc.password == "") ? mrCodeName : id; // password indicates custom account
        name = mrCodeName;
        isValid = true;
      }
      else if (Object.keys(doc.friends).length > 0) {
        // name = (doc.password == "") ? mrCodeName : id; // password indicates custom account
        name = mrCodeName;
        isValid = true;
      }

      if (isValid) { // valid mrcodes account, or in some way active (because friends)
        // only accepted friends will be carried over
        const accepted = [];
        for (const friend in doc.friends) {
          if (doc.friends[friend][1] && doc.friends[friend][2]) {
            accepted.push("mrcode/" + friend);
          }
        }

        const biography = doc.biography;
        let password = doc.password;
        if (password.length == 0) { // no actual password
          password = sync.generatePassword(name);
        }
        
        try {
          await accounts.createAccount(
            name,
            password,
            ":root:"
          );
          logger.log("Created account " + name);
        }
        catch (err) {
          if (err.code == -119) {
            logger.log(name + " already exists.");
          }
          else logger.log(err);
        }

        await new Promise((resolve, reject) => {
          legacy.dbManager.api.update(
            legacy.dbManager.db.collection("accounts"),
            {
              "_id": name
            },
            {
              $set: {
                "bio": biography,
                "friends": {
                  "confirmed": accepted
                }
              }
            }, (err, updatedCount) => {
              if (err) {
                logger.log(err);
              }
              resolve();
            }
          );
        })
      }
    });
    logger.log("\nEND OF BATCH")

    if (length == 0) {
      break;
    }
  }
}

async function run2() {
  let batch = 0;
  while (true) {
    await legacy.connectLegacy();
    await legacy.fillQueue(
      "Posts",
      batch++,
      200
    );

    await legacy.connectCurrent();

    logger.log("\n\nSTART OF BATCH");
    const length = await legacy.emptyQueue(async (id, doc) => {
      let plainBody = "";
      for (const section of doc.body) {
        plainBody += section.text;
      }
      if (Object.keys(doc.blacklist).length > 0) {
        plainBody += "\n\nBlacklisted from viewing:\n";
        for (let person in doc.blacklist) {
          plainBody += person + "\n";
        }
      }

      const time = new Date(doc.date);

      const document = {
        "title": "[" + doc.creater + "]\'s post",
        "content": plainBody,
        "published": time.getTime(),
        "user": "mrcode/" + doc.creater,
        "channel": "archives",
        "rating": doc.likes - doc.dislikes
      }
    
      await new Promise((resolve,reject) => {
        legacy.dbManager.api.insert(
          legacy.dbManager.db.collection("posts"),
          document,
          (err, finalDocId) => {
            legacy.dbManager.api.update(
              legacy.dbManager.db.collection("channels"), {
                "_id": "archives"
              }, {
                $push: {
                  "posts": finalDocId
                },
                $set: {
                  "activity": document.published
                }
              }, (err) => {
                if (err) logger.log("ERROR:", err);
                resolve();
              }
            );
          }
        );
      });
      logger.log(document.title);
    });
    logger.log("\nEND OF BATCH")

    if (length == 0) {
      break;
    }
  }
}
