title: Windows installation guide
description: Windows installation guide for WildBeast
path: tree/master/docs
source: install_windows.md

This guide will detail how to install and setup WildBeast on Windows.

## Prerequisites

- Windows system
    - Minimum: Windows 10 Home 64-bit (Additional dependencies required)
    - Recommended: Windows 10 Professional or Enterprise 64-bit
    - Administrator access
- You will also need a text editor other than Windows Notepad. Notepad++, Visual Studio Code or any of the sort will suffice.

## Installation

!!! warning "Note about Windows 10 Home"
    Windows 10 Home lacks native virtualisation support, namely Hyper-V, which is used by Docker. Before you read on, find out your edition of Windows from either the Settings app (**Settings\System\About**) or the Control Panel (**Control Panel\System and Security\System**).
    

### Installing Docker

You will need to install Docker Community Edition and Kitematic to use WildBeast. Depending on your operating system, the procedure will slightly differ.

  - If you are using W10 Professional or Enterprise, follow the instructions to install [Docker on Windows](https://docs.docker.com/docker-for-windows/install) and [Kitematic](https://github.com/docker/kitematic#installing-kitematic).
  - If you are using W10 Home, follow the instructions to install [Docker Toolbox](https://docs.docker.com/toolbox/toolbox_install_windows).

Complete the appropriate installation procedure and verify Docker is functional before proceeding.

### Installing Git

It is highly recommended to use Git to retrieve WildBeast instead of downloading a ZIP package from GitHub for ease of updating later down the line.

Download [Git](https://git-scm.com) and install it with the following options:

- Features: Desktop icon, Explorer integration and TrueType console font can be omitted at will.
- Text editor: Matter of preference.
- Use Git from the Windows Command Prompt (**Important!**)
- Use OpenSSH and OpenSSL (**Important!**)
- Checkout as-is, commit Unix-style line endings
- Use MinTTY (If you're installing Git Bash)
- Additional options: Matter of preference.

### Setup

With that done, clone the WildBeast GitHub repository by running `#!bash git clone https://github.com/TheSharks/WildBeast.git` in a terminal window. After cloning, change to the `WildBeast` directory and open **docker-compose.yml** with your preferred text editor.

Edit the following parameters:

- **BOT_TOKEN**: Add your Discord bot token here. (Eg. [create a bot and add it to a server](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token))
- **BOT_PREFIX**: Add your preferred command prefix here. (Eg. **!**, **++**, etc.)
- **WILDBEAST_MASTERS**: Add a pipe-delimited list of user IDs you wish to set as super users here. (Eg. **discorduserid1|discorduserid1|etc**)

When done, save and close the file. Then run `#!bash docker-compose up --no-start` in the WildBeast directory. When the container creation is done, open Kitematic and you should have the following containers present.

![Container list](img/kitematic-containers.png)

!!! danger
    The **docker-compose.yml** file is not excluded from Git due to it being necessary for the installation process. The Discord bot token you input into it is sensitive data, and it is highly recommended that you remove it after you're done with this guide. This should be done to avoid accidentally leaking your API token.

### Initialising

To initialise WildBeast, start the following containers in the following order (Wait for one to finish before proceeding):

- wildbeast_arango_1
- wildbeast_install_1

You may have to click back and forth between containers to see the output from one.

When **wildbeast_install_1** finishes, you may stop it. After this you do not need to run **wildbeast_install_1** again, as this only initialises the database. You can run it again if you wish to repair your database, however.

## Configuration

Open the settings for the **wildbeast_wildbeast_1** container and check the Environment Variables tab. The minimum defaults have been defined already through docker-compose.yml, but the bot will only have fairly limited functionality if left at this state.

Here is a list of the environment variables that you can define. Check the footnotes for brief instructions on how to get the API keys below.

| Variable | Description | Commands using this | Type |
| -------- | ----------- | ------------------- | ---- |
| IMGFLIP_USERNAME | Imgflip username.[^1] | meme | String |
| IMGFLIP_PASSWORD | Imgflip password.[^1] | meme | String |
| IMGUR_KEY | Imgur API key.[^2] | randommeme | String |
| TWITCH_ID | Twitch client ID.[^3] | twitch | String |
| WILDBEAST_VOICE_PERSIST | Prevent the bot from automatically leaving a voice channel after a playlist has ended. | Music | Boolean |
| WILDBEAT_DISABLE_MUSIC | Prevent all music functionality from being used. | Music | Boolean |
| WILDBEAST_LANGUAGE | Set the language of the bot. Currently only English is available. | All | String |

If you have reconfigured your ArangoDB database or use a custom instance, you can also set **ARANGO_USERNAME**, **ARANGO_PASSWORD**, **ARANGO_DATABASE** and **ARANGO_URI** to match your own database.

If you have reconfigured your Lavalink instance or use a custom instance, you may edit the **LAVA_NODES** variable to point to your Lavalink setup.

!!! note
    There are some undocumented environment variables that can be defined in addition to these. Support will not be provided for issues that stem from using undocumented or internal environment variables.

## Running the bot

Your WildBeast instance should now be good to go. Start both the **wildbeast_arango_1** and **wildbeast_lavalink_1** containers, and when they're ready, start **wildbeast_wildbeast_1**. Wait for it to start, and if your output roughly resembles the following, you're set.

![Expected output](img/kitematic-expected-output.png)

You can test the bot by running the **ping** command (With your prefix) in a text channel that the bot can see. If it answers "Pong!", then your bot is set up.

If you have further questions or need help with something, we'd be happy to help. You can find a link to the official server below.

**Enjoy your bot and have fun!**

<p align="left">
  <a href="https://discord.gg/wildbot"><img src="https://discordapp.com/api/guilds/110462143152803840/widget.png?style=banner2" alt="Discord server"></a>
</p>

[^1]: Go to https://imgflip.com, create an account and input your username and password here.

[^2]: Go to https://www.twitch.tv/settings/connections, register an application and input the client ID you get from that here.

[^3]: Go to https://api.imgur.com/oauth2/addclient, register an application and input the client ID (Not secret!) you get from that here.
