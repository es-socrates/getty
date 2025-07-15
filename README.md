# Getty.

**A Odysee Widget Hub: All the widgets for your Odysee livestream in one place.**

![Getty](https://thumbs.odycdn.com/75a10ce76465fdd305aca5144ee018a5.webp)

## Some features of the app:

1) Manage widgets individually in OBS scenes.
2) Run a single command to run the app on your computer.
3) Real-time notifications of your tips, chat messages, tip goal, and last tip.
4) Customize the widgets as you like (colors, fonts, styles, titles, etc).
5) You don't have to activate all widgets, you can activate 2 widgets if you want.

![Getty admin](https://thumbs.odycdn.com/32fdcb81930e950256eccf02ecbf002f.webp)

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

And that's it, the widget is now working. You can monitor the entire process from the Odysee Dashboard.

If you see the scroll in the widget's OBS source, check the source properties in OBS and use these CSS styles.

```
body { 
  background-color: rgba(0,0,0,0) !important; 
  overflow: hidden !important;
}
```

## Main Dependencies:

1. Express: Web server
2. WebSockets: Real-time communication
3. Axios: HTTP requests
4. dotenv: Environment variable management

**This is an independent project for fun; it is not an official Odysee product.**