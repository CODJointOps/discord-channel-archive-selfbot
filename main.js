require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();
const fs = require('fs');
const path = require('path');

const BATCH_INTERVAL = 5000;
let messageQueue = [];

const channelMappings = {
  [process.env.SOURCE_CHANNEL_ID_1]: process.env.TARGET_CHANNEL_ID_1,
  [process.env.SOURCE_CHANNEL_ID_2]: process.env.TARGET_CHANNEL_ID_2,
};

let includeImages = process.env.IMAGES === '1';
const COMMAND_CHANNEL_ID = process.env.COMMAND_CHANNEL_ID;

client.on('ready', () => {
  console.log(`${client.user.tag} is ready!`);
  setInterval(processMessageQueue, BATCH_INTERVAL);
});

const outputsDir = path.join(__dirname, 'outputs');
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

function logMessageToFile(channelId, message) {
  const channelDir = path.join(outputsDir, channelId);
  if (!fs.existsSync(channelDir)) {
    fs.mkdirSync(channelDir, { recursive: true });
  }

  const logFilePath = path.join(channelDir, 'messages_logged.txt');
  fs.appendFile(logFilePath, message + '\n', err => {
    if (err) {
      console.error('Failed to log message to file:', err);
    }
  });
}

client.on('messageCreate', async message => {
  if (message.channel.id === COMMAND_CHANNEL_ID && message.content === '.toggleimages') {
    includeImages = !includeImages;
    return message.channel.send(`Image and link forwarding is now ${includeImages ? "enabled" : "disabled"}.`)
      .then(msg => setTimeout(() => msg.delete(), 5000));
  }

  if (channelMappings[message.channel.id]) {
    if (message.author.id === client.user.id) return;

    let content = message.content;
    if (!includeImages) {
      content = content.replace(/https?:\/\/\S+/g, '[Link removed]');
    }

    const timestamp = new Date(message.createdTimestamp).toISOString();
    let attachmentUrls = '';
    if (includeImages) {
      attachmentUrls = message.attachments.map(a => a.url).join(' ');
      if (attachmentUrls) {
        attachmentUrls = ' ' + attachmentUrls;
      }
    }

    const formattedMessage = {
      content: `\`${timestamp}\` <@${message.author.id}> / **${message.author.tag}**: ${content}${attachmentUrls} \`[Message ID: ${message.id}]\``,
      target: channelMappings[message.channel.id]
    };

    const formattedMessageForLog = `${timestamp} <@${message.author.id}> / ${message.author.username}: ${content}${attachmentUrls} [Message ID: ${message.id}]`;
    logMessageToFile(message.channel.id.toString(), formattedMessageForLog);

    messageQueue.push(formattedMessage);
  }
});

async function processMessageQueue() {
  if (messageQueue.length === 0) return;

  while (messageQueue.length > 0) {
    let batchMessage = '';
    let targetChannelId = messageQueue[0].target;

    while (messageQueue.length > 0 && messageQueue[0].target === targetChannelId && (batchMessage.length + messageQueue[0].content.length) <= 2000) {
      const nextMessage = messageQueue.shift().content;
      if (batchMessage.length + nextMessage.length + 1 <= 2000) {
        batchMessage += nextMessage + '\n';
      } else {
        const targetChannel = await client.channels.fetch(targetChannelId);
        await targetChannel.send(batchMessage);
        batchMessage = nextMessage + '\n'; // Start a new batch
      }
    }

    if (batchMessage.length > 0) {
      const targetChannel = await client.channels.fetch(targetChannelId);
      await targetChannel.send(batchMessage);
    }
  }
}

client.login(process.env.DISCORD_TOKEN);

