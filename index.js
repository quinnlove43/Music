require('dotenv').config();

const TelegramBot = require('node-telegram-bot-api');
const ytDlp = require('yt-dlp-exec');
const ffmpegPath = require('ffmpeg-static');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load API keys securely
const token = process.env.TELEGRAM_BOT_TOKEN;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!token || !YOUTUBE_API_KEY) {
  console.error('❌ Missing API keys! Set TELEGRAM_BOT_TOKEN and YOUTUBE_API_KEY in .env');
  process.exit(1);
}

// Create bot instance
const bot = new TelegramBot(token, { polling: true });

// Main menu
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [
        { text: "🎶 Play Music", callback_data: "play_music" },
        { text: "ℹ️ Help", callback_data: "help" },
      ]
    ]
  }
};

// Send main menu when a user starts
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, '🎵 Welcome to the Music Bot! 🎵\nChoose an option below:', mainMenu);
});

// Handle menu callbacks
bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data === 'play_music') {
    bot.sendMessage(chatId, 'To play a song, type: `/play <song name>`\nExample: `/play Shape of You`');
  } else if (data === 'help') {
    bot.sendMessage(chatId, 'ℹ️ *Help Menu*\n\n1. Use `/play <song name>` to download and play music.\n2. Provide a valid song name.\n3. For issues, contact the developer.\n\nEnjoy!', { parse_mode: 'Markdown' });
  }

  bot.answerCallbackQuery(query.id);
});

// Handle /play command
bot.onText(/\/play (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const query = match[1];

  bot.sendMessage(chatId, `🔍 Searching for "${query}" on YouTube...`);

  try {
    // Search for song using YouTube API
    const searchResponse = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: {
        part: 'snippet',
        q: query,
        maxResults: 1,
        type: 'video',
        key: YOUTUBE_API_KEY,
      },
    });

    const video = searchResponse.data.items[0];
    if (!video) return bot.sendMessage(chatId, '❌ No results found.');

    const videoId = video.id.videoId;
    const videoTitle = video.snippet.title;
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const outputFileName = `song_${Date.now()}.mp3`;
    const outputPath = path.join(__dirname, outputFileName);

    bot.sendMessage(chatId, `🎧 Downloading and converting "${videoTitle}"...`);

    // Download and convert with yt-dlp
    ytDlp(videoUrl, {
      ffmpegLocation: ffmpegPath,
      extractAudio: true,
      audioFormat: 'mp3',
      output: outputPath,
    })
      .then(() => {
        bot.sendAudio(chatId, outputPath, {
          caption: `🎶 Here's your song: *${videoTitle}*`,
          parse_mode: 'Markdown',
        }).then(() => fs.unlinkSync(outputPath)); // Delete file after sending
      })
      .catch((err) => {
        console.error('yt-dlp Error:', err.message || err);
        bot.sendMessage(chatId, '❌ Failed to download the song.');
      });
  } catch (error) {
    console.error('Error:', error.message || error);
    bot.sendMessage(chatId, '❌ An error occurred.');
  }
});
