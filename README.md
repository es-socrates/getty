# Getty.

### App for Odysee streamers to manage tips, goals, and chat

![Getty](https://thumbs.odycdn.com/3a2887c073c32480aeba03df33012e9f.webp)

## Some features of the app:

1) Manage widgets individually in OBS scenes.
2) Run a single command to run the app on your computer.
3) Real-time notifications of your tips, chat messages, tip goal, and last tip.
4) Customize the widgets as you like (colors, fonts, styles, titles, etc).
5) You don't have to activate all widgets, you can activate 2 widgets if you want.

![Getty](https://thumbs.odycdn.com/227b020decd149afd5ed6ec3fa0c170a.webp)

## Prerequisites

### Node.js

- [Node.js](https://nodejs.org/) (v16 or higher (latest LTS version recommended)
- [npm](https://www.npmjs.com/) (included with Node.js)
- OBS Studio.

## Installation

Clone this repository or download the files. Open a terminal in the project folder. Run the following command to install the dependencies:

Use the command: **npm install**, this will install the necessary dependencies. Rename and edit the **.env.example to .env** file, then replace the three (3) xxx's with your **AR (Arweave)** wallet address on Odysee. And replace the other (3) xxx's with the **ClaimID** of your livestream on Odysee.

Save the changes and then run **npm start** at the terminal. The server will run the app and you can monitor it in the terminal with the address http://localhost:3000.

## Visit the app in the browser:

1) Odysee Dashboard: http://localhost:3000/
2) Odysee admin: http://localhost:3000/admin.html

The app's admin page has all the widget links for OBS. I recommend saving the changes on the admin page and checking that all of them are active, or the ones you need.

## OBS Integration:

1. In OBS Studio, add a new "Source" of type "Browser" to your scene.
2. Example: Set the URL to http://localhost:3000/widgets/chat.
3. Adjust the size according to your needs.

![Getty](https://thumbs.odycdn.com/2c3fc1df0ac34b600e24a2d226176d5e.webp)

And that's it, the widget is now working. You can monitor the entire process from the Odysee Dashboard. You can also monitor the entire backend process from the terminal.

![Getty](https://thumbs.odycdn.com/b0214136d90c88ed5251bc14b4e95589.webp)

---

## Customize CSS in OBS

Chat in OBS can be customized independently, so you can add these styles to the widget's browser source CSS container.

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
```

## Dependencies in the installation:

```
"@untitledui/icons": "^0.0.17",
"arweave": "^1.15.7",
"axios": "^1.6.2",
"dotenv": "^16.3.1",
"express": "^4.18.2",
"react-aria-components": "^1.10.1",
"tailwind-merge": "^3.3.1",
"tailwindcss-react-aria-components": "^2.0.0",
"ws": "^8.13.0"
```

**This is an independent project for fun; it is not an official Odysee product.**