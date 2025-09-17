# getty (λ)

Complete and customizable app with tools for live streaming. Tip notifications, tip goals, chat widget, and real-time alerts for your live streams on Odysee.

🔥 Demo online version from [app.getty.sh](https://app.getty.sh/). This is an optional online version if you don't want to use the localhost version. **Please be kind and patient; resources on the server are limited.**

**The vision:** To provide Odysee streamers with comprehensive tools for their livestreams on Odysee. Everything is easy, free, and requires no registration. Enjoy the app and stay tuned for more updates in the future.

![getty](https://thumbs.odycdn.com/a3a2b6dfa1498257a7c37ea4050e217b.webp)

## Not familiar with Odysee?

Odysee is a blockchain-based media platform. We host all kinds of media such as images, articles, PDFs, audio files, etc., but we're best known for hosting videos. Odysee seeks to recapture the spirit of the early 2000s era internet. Rather than favouring corporate content such as late night talk shows, network television, and TV news, Odysee is a place for everyone, including independent creators.

### Learn more about creating and setting up a wallet on Odysee, [visit the documentation](https://help.odysee.tv/category-monetization/).

## The Ultimate Tool

Want to take your stream to the next level? With getty, managing your widgets in OBS has never been so easy and customizable. Here are some of its amazing features: independent widgets.

## More Features

1. ⚡ Easy Setup: Run getty with a single command, either on your PC or server.
2. 🔔 Real-Time Notifications: Get alerts for your AR token tips, chat messages, donation goals and the latest tip instantly.
3. 🎨 Unlimited Customization: Change colors, fonts, styles, titles and more to fit your style.
4. 🔄 Standalone Widgets: Activate only the ones you need, either 1, 2 or all.
5. 📢 Discord/Telegram Integration: Send tip notifications to your Discord server or Telegram group.
6. 🗣 Text-to-Speech (TTS): Listen out loud to chat messages when you get tips!
7. 🎉 Custom Commands: Increase the Excitement in your Sweepstakes with Custom Commands!
8. ❇️ Announcement: Create random messages for your viewers.
9. #️⃣ Social media: Show your social media accounts.
10. 💬 Live Chat: Add a chat widget to your OBS with different themes.
11. 📈 Real-time and historical statistics of your lives in Odysee.
12. 🎉 Achievements System: Receive real-time achievement notifications.

![image](https://thumbs.odycdn.com/280350ed164307082a48e00ecc59b02a.webp)

## Prerequisites to start getty

### Node.js

- Use your favorite terminal.
- Install [Node.js](https://nodejs.org/) 22.x (the project requires Node >=22 <23).
- Enable Corepack (included with Node) so pnpm is managed automatically by the version pinned in `package.json`:

```bash
corepack enable
node -v   # should print v22.x.x
pnpm -v   # Corepack will provision pnpm@9.12.3
```

- Optional: install pnpm manually (if you prefer not to use Corepack):

```bash
npm i -g pnpm@9.12.3
```

## Installation

1. Install OBS Studio, Streamlabs or any software of your choice.
2. Clone this repository or download the files.
3. Open the terminal in the getty folder.
4. Optional: Copy env file and adjust values:

   ```bash
   cp .env.example .env
   ```

5. Install dependencies with pnpm (via Corepack): **pnpm install**
6. Run the **pnpm run build** command to build the app.
7. Then run **pnpm run start:prod**.
8. The server will run the app with the address http://localhost:3000.
9. Open getty in your web browser and configure your widgets in admin.

**Important:** If you download an update from getty, you must repeat the installation process. In some cases, there may be new dependencies to install, so the process may need to be repeated.

## Visit getty in the browser:

1. Dashboard: http://localhost:3000/
2. Admin: http://localhost:3000/admin/status

The app's admin page has all the widget links for OBS. I recommend saving the changes on the admin page and checking that all of them are active, or the ones you need.

## How to add widgets to OBS?

1. Open the OBS Studio software.
2. Add a new "Browser Source".
3. Paste the URL of your widget: (e.g. http://localhost:3000/widgets/chat).
4. Adjust the size, position and color of each widget.
5. You're done! The widgets will appear in your stream. Let's stream!

getty's vision is to help streamers on Odysee manage their own widgets for community interaction. This opens the door to multiple options and resources never seen before. Enjoy the app and look forward to more updates in the future.

## Hosted mode (MVP)

Here it goes in "hosted" mode so you don't have to deal with the local stuff.

**Personally, it's easier on localhost, but it's up to you if you want to set up your own server.**

If you are going to host your own server, define the **REDIS_URL** environment variable to enable hosted mode and isolate your session. Without REDIS_URL, **data is stored globally** in that deployment.

Set REDIS_URL (for example, a Redis on Render) and then visit `app.getty.sh/new-session` to create your **isolated session**. You can check in `app.getty.sh/api/session/status` that `supported=true` and, after creating it, `active=true`.

**What does all this mean?**

Everything you do in the admin and API calls are stored in Redis by "namespace" based on your token, so each session is separate; widgets use the public token without exposing anything sensitive.

If you want, adjust SESSION_TTL_SECONDS to decide how long each session lasts (default 259200 seconds = 72 hours).

### Important

If you want to share your widget publicly, use the widget link and add the parameter ?token=YOUR_PUBLIC_TOKEN.

**Example:** `/widgets/last-tip?token=YOUR_PUBLIC_TOKEN`.

Anyone with that link will see the widget data in real time; you can revoke access by regenerating the public token from the dashboard.

**This is an independent project; it is not an official Odysee product.** Visit **getty's official** website for more information: [getty.sh](https://getty.sh/).

### With love for Odysee ❤️

## λ
