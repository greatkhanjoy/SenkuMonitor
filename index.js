const { Client, GatewayIntentBits, REST, Routes, EmbedBuilder } = require('discord.js');
const fs = require('fs');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers
    ]
});

// File to store log channels
const dataFile = './logChannels.json';

// Load log channels from JSON
const loadLogChannels = () => {
    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(dataFile, JSON.stringify({})); // Initialize file if it doesn't exist
    }
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
};

// Save log channels to JSON
const saveLogChannels = (data) => {
    fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
};

let logChannels = loadLogChannels();

client.once('ready', () => {
    console.log(`Bot is online as ${client.user.tag}`);
});

// Register slash commands
const registerCommands = async () => {
    const commands = [
        {
            name: 'senkumonitor',
            description: 'Set this channel as the log channel for voice activity'
        }
    ];

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands }
        );
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering slash commands:', error);
    }
};

// Handle slash command interaction
client.on('interactionCreate', async (interaction) => {
    if (!interaction.isCommand()) return;

    const { commandName } = interaction;

    if (commandName === 'senkumonitor') {
        if (!interaction.member.permissions.has('ManageGuild')) {
            return interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
        }

        const logChannel = interaction.channel;

        // Save the channel ID for the guild in JSON
        logChannels[interaction.guildId] = logChannel.id;
        saveLogChannels(logChannels);

        interaction.reply({ content: `This channel has been set as the log channel for voice activity.`, ephemeral: true });
    }
});

// Create stunning and beautiful embed log message
const createVoiceLogEmbed = (user, action, channel) => {
    return new EmbedBuilder()
        .setColor('#ff4500') // Beautiful orange-red color
        .setTitle(`${user.username} ${action} a voice channel`)
        .setDescription(`**User:** ${user.username}\n**Action:** ${action}\n**Channel:** ${channel.name}`)
        .addFields(
            { name: 'Time', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true } // Add timestamp
        )
        .setTimestamp() // Current time for the log
        .setFooter({ text: `Voice Activity Log`, iconURL: client.user.avatarURL() }) // Footer with bot avatar
        .setThumbnail(user.avatarURL()); // User's avatar
};

// Log voice state updates
client.on('voiceStateUpdate', (oldState, newState) => {
    if (oldState.channelId === newState.channelId) return; // Ignore if no channel change

    const guildId = oldState.guild.id || newState.guild.id;
    const logChannelId = logChannels[guildId];

    if (!logChannelId) return; // Log channel not set for this guild

    const logChannel = client.channels.cache.get(logChannelId);
    if (!logChannel) return; // Log channel no longer exists

    const user = newState.member.user;

    let action = '';
    let channel = null;

    if (newState.channel) {
        action = 'joined';
        channel = newState.channel;
    } else if (oldState.channel) {
        action = 'left';
        channel = oldState.channel;
    }

    const logEmbed = createVoiceLogEmbed(user, action, channel);
    logChannel.send({ embeds: [logEmbed] });
});

// Login and register commands
client.login(process.env.DISCORD_TOKEN).then(registerCommands);
