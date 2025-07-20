# Getty

### App for Odysee streamers to manage chat tip notification, tip goals, and notification. All in real time, without registration or databases.

![getty](https://thumbs.odycdn.com/f2a06e0d66598d2da4ddb602bb9a05a4.webp)
> **This is the dashboard view in Getty, the widgets are independent in OBS Studio**

## Some features of Getty:

1) Manage **widgets individually** in OBS scenes.
2) Run a single command to run the app on your computer or server.
3) Real-time notifications of your **AR tips, chat messages, tip goal, and last tip**.
4) Customize the widgets as you like (colors, fonts, styles, titles, etc).
5) Widgets can be activated independently, in case you need 2 or even 1.
6) Send your tip notifications to your **Discord server or Telegram group**.
7) Get **text-to-speech** chat notifications when you receive tips.

![getty](https://thumbs.odycdn.com/574d042ea3836e63153124f283100163.webp)

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
4. Rename the file **.env.example to .env**
5. Edit **.env** file, then replace the three (3) xxx's with your **AR (Arweave)** wallet address on Odysee. And replace the other (3) xxx's with the **ClaimID** of your livestream on Odysee.
6. Save the changes and then run **npm start**.
7. The server will run the app with the address http://localhost:3000.

### If you'd like to learn more about creating and setting up a wallet on Odysee, [visit the documentation](https://help.odysee.tv/category-monetization/).

## Visit Getty in the browser:

1) Dashboard: http://localhost:3000/
2) Admin: http://localhost:3000/admin.html/

The app's admin page has all the widget links for OBS. I recommend saving the changes on the admin page and checking that all of them are active, or the ones you need.

![getty](https://thumbs.odycdn.com/8c6125617bf086a6046b445de0a01772.webp)

## OBS Integration:

1. In OBS Studio, add a new "Source" of type "Browser" to your scene.
2. **Example:** Set the URL to http://localhost:3000/widgets/chat.
3. Adjust the size and css according to your needs.

![getty](https://thumbs.odycdn.com/6dd538e00705ebaf66e6a179ea7a8c59.webp)

And that's it, the widget is now working. You can monitor the entire process from the Getty Dashboard. You can also monitor the entire backend process from the terminal.

![Getty](https://thumbs.odycdn.com/b0214136d90c88ed5251bc14b4e95589.webp)

---

## Customize CSS in OBS

Chat in OBS can be customized independently, so you can add these styles to the widget's browser source CSS container. This is my personal customization, but you can adjust what you need.

```
body { 
  background-color: rgba(0,0,0,0) !important; 
  overflow: hidden !important;
}

.message-text-inline {
    font-size: 22px;
}

.message-username.cyberpunk {
    font-size: 22px;
}

.message-avatar {
    width: 38px;
    height: 36px;
    border-radius: 50%;
    overflow: hidden;
    background: #21262d;
}

.message-avatar img {
    width: 38px;
    height: 38px;
    object-fit: cover;
}

.comment-emoji,
.message-content .comment-emoji {
    vertical-align: middle;
    position: relative;
    top: -2px;
    margin: 10px 2px;
    max-width: 24px;
}

.message.has-donation .message-username {
    font-size: 22px;
}

.message.has-donation .message-text-inline {
    font-size: 22px;
    font-weight: 700;
    font-family: var(--odysee-font-family);
    white-space: normal;
}

.message-donation {
    font-size: 18px;
}
```

Getty's vision is to help streamers on Odysee manage their own widgets for community interaction. This opens the door to multiple options and resources never seen before. Enjoy the app and look forward to more updates in the future.

**This is an independent project; it is not an official Odysee product.**

## Made with love for Odysee ❤️