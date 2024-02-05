require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

const SOURCE_CHANNEL_ID = process.env.SOURCE_CHANNEL_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;
const BATCH_INTERVAL = 5000;
let messageQueue = [];

client.on('ready', () => {
  console.log(`${client.user.tag} is ready!`);
  setInterval(processMessageQueue, BATCH_INTERVAL);
});

client.on('messageCreate', async message => {
  if (message.channel.id === SOURCE_CHANNEL_ID) {
    if (message.author.id === client.user.id) return;

    // Add the new message to the queue
    messageQueue.push(`<@${message.author.id}> / **${message.author.tag}**: ${message.content}`);
  }
});

async function processMessageQueue() {
  if (messageQueue.length === 0) return; // Skip if no messages
  
  const targetChannel = await client.channels.fetch(TARGET_CHANNEL_ID);
  if (!targetChannel) {
    console.error('Target channel not found');
    return;
  }

  let batchMessage = '';
  while (messageQueue.length > 0 && (batchMessage.length + messageQueue[0].length) <= 2000) {
    const nextMessage = messageQueue.shift();
    if (batchMessage.length + nextMessage.length + 1 <= 2000) {
      batchMessage += nextMessage + '\n';
    } else {
      await targetChannel.send(batchMessage);
      batchMessage = nextMessage + '\n';
    }
  }

  if (batchMessage.length > 0) {
    await targetChannel.send(batchMessage);
  }
}

client.login(process.env.DISCORD_TOKEN);

