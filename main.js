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
  [process.env.SOURCE_CHANNEL_ID_3]: process.env.TARGET_CHANNEL_ID_3,
  [process.env.SOURCE_CHANNEL_ID_4]: process.env.TARGET_CHANNEL_ID_4,
  [process.env.SOURCE_CHANNEL_ID_5]: process.env.TARGET_CHANNEL_ID_5,
  [process.env.SOURCE_CHANNEL_ID_6]: process.env.TARGET_CHANNEL_ID_6,
};

let includeImages = process.env.IMAGES === '1';
const COMMAND_CHANNEL_ID = process.env.COMMAND_CHANNEL_ID;
const confPath = path.join(__dirname, 'conf');
const settingsFilePath = path.join(confPath, 'channelSettings.json');

if (!fs.existsSync(confPath)) {
    fs.mkdirSync(confPath, { recursive: true });
}

let channelSettings = {};
if (fs.existsSync(settingsFilePath)) {
    channelSettings = JSON.parse(fs.readFileSync(settingsFilePath, 'utf8'));
} else {
    channelSettings = { includeImages: {} };
    fs.writeFileSync(settingsFilePath, JSON.stringify(channelSettings, null, 2));
}

channelSettings.filters = channelSettings.filters || {};

client.on('ready', () => {
  console.log(`${client.user.tag} is ready!`);
  client.user.setPresence({
    status: 'invisible'
  })
  setInterval(processMessageQueue, BATCH_INTERVAL);
  console.log("Channel Mappings:", channelMappings);
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

  if (message.channel.id === COMMAND_CHANNEL_ID && message.content.startsWith('.filter')) {
    const args = message.content.split(' ');
    if (args.length < 3) {
        return message.reply("Usage: .filter <channelId> add|remove|clear <userId>").then(msg => setTimeout(() => msg.delete(), 5000));
    }

    const channelId = args[1];
    const action = args[2];
    const userId = args[3];

    channelSettings.filters[channelId] = channelSettings.filters[channelId] || [];

    switch (action) {
        case 'add':
            if (!channelSettings.filters[channelId].includes(userId)) {
                channelSettings.filters[channelId].push(userId);
                message.reply(`Added user ID ${userId} to the filter for channel ID ${channelId}.`).then(msg => setTimeout(() => msg.delete(), 5000));
            } else {
                message.reply(`User ID ${userId} is already in the filter for channel ID ${channelId}.`).then(msg => setTimeout(() => msg.delete(), 5000));
            }
            break;
        case 'remove':
            channelSettings.filters[channelId] = channelSettings.filters[channelId].filter(id => id !== userId);
            message.reply(`Removed user ID ${userId} from the filter for channel ID ${channelId}.`).then(msg => setTimeout(() => msg.delete(), 5000));
            break;
        case 'clear':
            channelSettings.filters[channelId] = [];
            message.reply(`Cleared all filters for channel ID ${channelId}.`).then(msg => setTimeout(() => msg.delete(), 5000));
            break;
        default:
            message.reply("Invalid action. Use 'add', 'remove', or 'clear'.").then(msg => setTimeout(() => msg.delete(), 5000));
      }

    fs.writeFileSync(settingsFilePath, JSON.stringify(channelSettings, null, 2));
  }


  if (message.channel.id === COMMAND_CHANNEL_ID && message.content.startsWith('.toggleimages')) {
    const args = message.content.split(' ');
    if (args.length === 1) {
      let response = "Image forwarding status for channels:\n";
      for (const sourceChannelId of Object.keys(channelMappings)) {
        if (!sourceChannelId || sourceChannelId === 'undefined') continue;
        const targetChannelId = channelMappings[sourceChannelId];
        const status = channelSettings.includeImages[sourceChannelId] !== undefined ? (channelSettings.includeImages[sourceChannelId] ? "Enabled" : "Disabled") : "Not Set";
        response += `- <#${sourceChannelId}> to <#${targetChannelId}> (${sourceChannelId}) : ${status}\n`;
      }
      return message.channel.send(response).then(msg => setTimeout(() => msg.delete(), 10000));
    }
    else if (args.length === 2) {
      const channelId = args[1];
      if (!Object.keys(channelMappings).includes(channelId)) {
        return message.reply(`Channel ID ${channelId} is not a recognized source channel.`).then(msg => setTimeout(() => msg.delete(), 5000));
      }
      channelSettings.includeImages[channelId] = !channelSettings.includeImages[channelId];
      fs.writeFileSync(settingsFilePath, JSON.stringify(channelSettings, null, 2));
      return message.reply(`Image and link forwarding for channel <#${channelId}> is now ${channelSettings.includeImages[channelId] ? "enabled" : "disabled"}.`).then(msg => setTimeout(() => msg.delete(), 5000));
    } else {
      return message.reply("Usage: .toggleimages <channelId>").then(msg => setTimeout(() => msg.delete(), 5000));
    }
  }

  if (channelMappings[message.channel.id]) {
    if (message.author.id === client.user.id) return;
    const filterUserIds = channelSettings.filters[message.channel.id] || [];
    let shouldLog = filterUserIds.length === 0;

    if (filterUserIds.length > 0) {
      const isFromFilteredUsers = filterUserIds.includes(message.author.id);
      const isReplyToFilteredUsers = message.reference && message.reference.messageId ? await checkIfReplyToFilteredUsers(message, filterUserIds) : false;
      const isMentioningFilteredUsers = message.mentions.users.some(user => filterUserIds.includes(user.id));

      shouldLog = isFromFilteredUsers || isReplyToFilteredUsers || isMentioningFilteredUsers;
    }
    
    if (!shouldLog) return;

    const includeImages = channelSettings.includeImages[message.channel.id] || false;

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

async function checkIfReplyToFilteredUser(message, userId) {
  try {
      const referencedMessage = await message.channel.messages.fetch(message.reference.messageId);
      return referencedMessage.author.id === userId;
  } catch (error) {
      console.error('Failed to fetch referenced message:', error);
      return false;
  }
}

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

