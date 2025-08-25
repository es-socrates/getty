# Getty

A widget app for tip notifications, tip goals, chat rewards and display real-time alerts for your livestreams in Odysee.

The vision is for streamers on Odysee to be able to have simple tools to go live on Odysee, interact with viewers and grow. All this easily, for free and without registration. Enjoy the app and look forward to more updates in the future.

![getty](https://thumbs.odycdn.com/e80ce98bd84093e80b050db245485887.webp)
> **The dashboard view in Getty, the widgets are independent in OBS Studio**

## Not familiar with Odysee?

Odysee is a blockchain-based media platform. We host all kinds of media such as images, articles, PDFs, audio files, etc., but we're best known for hosting videos. Odysee seeks to recapture the spirit of the early 2000s era internet. Rather than favouring corporate content such as late night talk shows, network television, and TV news, Odysee is a place for everyone, including independent creators.

### If you'd like to learn more about creating and setting up a wallet on Odysee, [visit the documentation](https://help.odysee.tv/category-monetization/).

## The Ultimate Tool

Want to take your stream to the next level? With Getty, managing your widgets in OBS has never been so easy and customizable. Here are some of its amazing features: independent widgets.

## More Features

1. ⚡ Easy Setup: Run Getty with a single command, either on your PC or server.
2. 🔔 Real-Time Notifications: Get alerts for your AR token tips, chat messages, donation goals and the latest tip instantly.
3. 🎨 Unlimited Customization: Change colors, fonts, styles, titles and more to fit your style.
4. 🔄 Standalone Widgets: Activate only the ones you need, either 1, 2 or all.
5. 📢 Discord/Telegram Integration: Send tip notifications to your Discord server or Telegram group.
6. 🗣 Text-to-Speech (TTS): Listen out loud to chat messages when you get tips!
7. 🎉 Custom Commands: Increase the Excitement in your Sweepstakes with Custom Commands!
8. ❇️ Announcement: Create random messages for your viewers.
9. #️⃣ Social media: Show your social media accounts.
10. 💬 Live Chat: Add a chat widget to your OBS with different themes.

![getty](https://thumbs.odycdn.com/2c824f75e3a53242508da449d7b7a558.webp)

## Hosted mode (MVP)

You can run Getty in a hosted, multi-tenant-like mode using ephemeral tokens:

- Set REDIS_URL to enable Redis-backed session storage (recommended in Render).
- Create a hosted session by opening /new-session. This issues:
	- Admin token (stored in HttpOnly cookie `getty_admin_token`)
	- Public token (HttpOnly cookie `getty_public_token`)
- Admin API calls and settings will be stored per token namespace in Redis. Widgets can use the public token.

Environment variables:
- REDIS_URL: Redis connection string.
- SESSION_TTL_SECONDS: Optional TTL for sessions (default 259200 = 72h).

## Prerequisites to start Getty

### Node.js

- Use the favorite terminal on your system.
- Install [Node.js](https://nodejs.org/) (v16 or higher (latest LTS version recommended)
- [npm](https://www.npmjs.com/) (included with Node.js)
- Install OBS Studio, because you're a streamer. Try it on other software if you want.

## Installation

1. Clone this repository or download the files.
2. Open the terminal in the getty folder.
3. Run this command to install the dependencies: **npm install**
4. Run the **npm run build** command to build the app.
5. Then run **npm start** or **npm run start:prod**.
6. The server will run the app with the address http://localhost:3000.
7. Open Getty in your web browser and configure your widgets in admin.

**Important:** If you download an update from Getty, you must repeat the installation process. In some cases, there may be new dependencies to install, so the process may need to be repeated.

## Visit Getty in the browser:

1) Dashboard: http://localhost:3000/
2) Admin: http://localhost:3000/admin.html/

The app's admin page has all the widget links for OBS. I recommend saving the changes on the admin page and checking that all of them are active, or the ones you need.

## How to add widgets to OBS?

1. Open the OBS Studio software.
2. Add a new "Browser Source".
3. Paste the URL of your widget: (e.g. localhost:3000/widgets/chat.html).
4. Adjust the size, position and color of each widget.
5. You're done! The widgets will appear in your stream. Let's stream!

Getty's vision is to help streamers on Odysee manage their own widgets for community interaction. This opens the door to multiple options and resources never seen before. Enjoy the app and look forward to more updates in the future.

**This is an independent project; it is not an official Odysee product.** Visit **Getty's official** website for more information: [Getty.sh](https://getty.sh/).

## Made with love for Odysee ❤️
