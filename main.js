require('dotenv').config();
const { Client } = require('discord.js-selfbot-v13');
const client = new Client();

const SOURCE_CHANNEL_ID = process.env.SOURCE_CHANNEL_ID;
const TARGET_CHANNEL_ID = process.env.TARGET_CHANNEL_ID;

client.on('ready', () => {
  console.log(`${client.user.tag} is ready!`);
});

client.on('messageCreate', async message => {
  if (message.channel.id === SOURCE_CHANNEL_ID) {
    if (message.author.id === client.user.id) return;

    const targetChannel = await client.channels.fetch(TARGET_CHANNEL_ID);
    if (!targetChannel) {
      console.error('Target channel not found');
      return;
    }

    targetChannel.send(`<@${message.author.id}> / **${message.author.tag}**: ${message.content}`);
  }
});

client.login(process.env.DISCORD_TOKEN);
