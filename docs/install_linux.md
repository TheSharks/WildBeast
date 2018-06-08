title: Linux installation guide
description: Linux installation guide for WildBeast
path: tree/master/docs
source: install_linux.md

This guide will detail how to install and setup WildBeast on Linux.

## Prerequisites

- Linux system
	-  OS: Docker officially supports [these distributions](https://store.docker.com/search?type=edition&offering=community&operating_system=linux), but others may be used as well
  -  Sudo privileges on the server
- You will also need a text editor. For command-line you may use Nano, Vim etc. while standalone editors like Visual Studio Code, Atom and Brackets are fine for systems with a desktop environment installed.

## Installation

You will need to install Docker and Docker Compose to use WildBeast. Find the guide for your distribution [here (Docker)](https://store.docker.com/search?type=edition&offering=community&operating_system=linux) and [here (Compose)](https://docs.docker.com/compose/install). For other distributions, you may use your own resources.

You will also need Git for downloading WildBeast. Git is available on most distribution-specific package managers. Refer to an instruction manual for your distribution for installation instructions.

Complete the appropriate installation procedure and verify Docker is functional before proceeding.

### Setup

With that done, clone the WildBeast GitHub repository by running `#!bash git clone https://github.com/TheSharks/WildBeast.git`. After cloning, change to the `WildBeast` directory and open **docker-compose.yml** with your preferred text editor.

Edit the following parameters:

- **BOT_TOKEN**: Add your Discord bot token here. (Eg. [create a bot and add it to a server](https://github.com/reactiflux/discord-irc/wiki/Creating-a-discord-bot-&-getting-a-token))
- **BOT_PREFIX**: Add your preferred command prefix here. (Eg. **!**, **++**, etc.)
- **WILDBEAST_MASTERS**: Add a pipe-delimited list of user IDs you wish to set as super users here. (Eg. **discorduserid1|discorduserid1|etc**)

When done, save and close the file. Then run `#!bash sudo docker-compose up --no-start` in the WildBeast directory. When the container creation is done, run `#!bash sudo docker ps -a` and make sure that you have an output that resembles the following.

![Container list](img/compose-containers.png)

!!! danger
    The **docker-compose.yml** file is not excluded from Git due to it being necessary for the installation process. The Discord bot token you input into it is sensitive data, and it is highly recommended that you remove it after you're done with this guide. This should be done to avoid accidentally leaking your API token.

!!! bug "Weird Docker errors"
    On certain systems Docker may refuse to run commands properly without **sudo** and will throw cryptic errors as a result. Try running the command with **sudo** before consulting help and also check your system process control to see if Docker is running.

### Initialising

To initialise WildBeast, run the following commands. Leave a second or two between each to account for startup times.

```bash
sudo docker start wildbeast_arango_1
sudo docker start wildbeast_install_1
sudo docker logs wildbeast_install_1
```

If your output resembles the following, you're good to go.

![Init](img/linux-init.png)

After this, you will no longer need to run **wildbeast_install_1** unless you wish to repair the database - it's only around for database initialisation.

## Configuration

Now it's time to do some additional configuration. The minimum defaults have been defined already through docker-compose.yml, but the bot will only have fairly limited functionality if left at this state. Create a **.env** file in the WildBeast directory and open it with your preferred text editor, following the [dotenv syntax](https://www.npmjs.com/package/dotenv#usage).

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

When you're done, save the .env file and close the editor.

## Running the bot

Your WildBeast instance should now be good to go. Run the following commands in your terminal, waiting a second or two between each:

```bash
sudo docker start wildbeast_arango_1 # If you didn't start it or stopped it
sudo docker start wildbeast_lavalink_1
sudo docker start wildbeast_wildbeast_1
sudo docker logs wildbeast_wildbeast_1
```

If your output resembles the following, your bot is all set.

![Expected ouput](img/linux-expected-output.png)

!!! bug "Connect ECONNREFUSED <IP\>:80"
    An error message saying **FATAL: Error: connect ECONNREFUSED <your IP\>:80** may happen when the **wildbeast_wildbeast_1** container is started too quickly and the Lavalink server is not ready. Wait a few seconds, then run `#!bash sudo docker restart wildbeast_wildbeast_1` and check the logs again.

You can test the bot by running the **ping** command (With your prefix) in a text channel that the bot can see. If it answers "Pong!", then your bot is set up.

If you have further questions or need help with something, we'd be happy to help. You can find a link to the official server below.

**Enjoy your bot and have fun!**

<p align="left">
  <a href="https://discord.gg/wildbot"><img src="https://discordapp.com/api/guilds/110462143152803840/widget.png?style=banner2" alt="Discord server"></a>
</p>

[^1]: Go to https://imgflip.com, create an account and input your username and password here.

[^2]: Go to https://www.twitch.tv/settings/connections, register an application and input the client ID you get from that here.

[^3]: Go to https://api.imgur.com/oauth2/addclient, register an application and input the client ID (Not secret!) you get from that here.
