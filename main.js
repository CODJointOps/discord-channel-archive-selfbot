require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

const BATCH_INTERVAL = 5000;
let messageQueue = [];

const channelMappings = {
  [process.env.SOURCE_CHANNEL_ID_1]: process.env.TARGET_CHANNEL_ID_1,
  [process.env.SOURCE_CHANNEL_ID_2]: process.env.TARGET_CHANNEL_ID_2,
};

client.on('ready', () => {
  console.log(`${client.user.tag} is ready!`);
  setInterval(processMessageQueue, BATCH_INTERVAL);
});

client.on('messageCreate', async message => {
  if (channelMappings[message.channel.id]) {
    if (message.author.id === client.user.id) return;

    const timestamp = new Date(message.createdTimestamp).toISOString();
    const formattedMessage = {
      content: `<@${message.author.id}> / **${message.author.tag}**: ${message.content}        \`${timestamp}\``,
      target: channelMappings[message.channel.id]
    };

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

