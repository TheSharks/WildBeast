---
description: Instructions to run WildBeast on Linux
---

# Setup

## The basics

{% hint style="info" %}
**Good to know:** For the purpose of this guide, we'll use [Ubuntu 20.04](https://ubuntu.com).&#x20;

Any modern Linux distribution will work, however the commands described here only work on Debian based distributions.
{% endhint %}

{% hint style="warning" %}
For safety reasons, please **don't run WildBeast with the `root` account.**

If you don't know how to create a new user on Linux, please see [DigitalOcean's guide on making new sudo-enabled users](https://www.digitalocean.com/community/tutorials/how-to-create-a-new-sudo-enabled-user-on-ubuntu-20-04-quickstart)
{% endhint %}

We need a few prerequisites:

* A computer running any [supported version of Ubuntu](https://github.com/nodesource/distributions#debian-and-ubuntu-based-distributions)
  * You need `sudo` or `doas` privileges, or access to the `root` account
  * If you want to run WildBeast 24/7, you should get a [VPS](../../extras/vps-recommendations.md)
* [Git](https://git-scm.com/download/linux)
* A text editor. We're going to use `nano`, but you can use anything you'd like.

## Installation

### Installing Node.js

1.  Run the following code in your terminal:

    ```
    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
    ```

    (Not a fan of `curl <url> | bash -`? You can do this [manually](https://github.com/nodesource/distributions#manual-installation) too.)
2.  Install Node.js with the following command:

    ```
    sudo apt-get install -y nodejs
    ```

### Installing Postgres

Postgres is available to install by default on Ubuntu, just run the following code in your terminal:

```bash
sudo apt install postgresql postgresql-contrib
```

We need to do some extra steps to prepare Postgres for use:

1.  Create a new user for WildBeast to use:

    ```bash
    sudo -u postgres createuser --interactive
    ```

    The new user does **not** need to be a superuser, and can be called whatever you want.
2.  Finally, create a new database:

    ```bash
    sudo -u postgres createdb wildbeast
    ```

    (We used `wildbeast` here as the database user, change it if you used something else in the previous step)

## Setting up

### Getting the code

Clone the code and install the required modules:

```
git clone https://github.com/TheSharks/WildBeast.git
cd ./WildBeast
npm install
```

### Setting the options

Open the example configuration file in `nano` and enter your details:

```
nano .env.example
```

When you're done, **save the file as `.env`**

### **Starting the database**

Before we can start, we need to initialize the database. Run the following code:

```
npm run-script migrations:up
```

### **Testing it out!**

Now for the fun part, testing to see if it worked!

Start WildBeast for the first time with the following command:

```
npm start
```

You should see something similar to the following if everything went well

`19:11:41 [info] Gateway: Client ready `

`19:11:41 [info] Gateway - shard 0: Gateway ready`

Test if your bot works by running the `/ping` command

![](<../../.gitbook/assets/afbeelding (6).png>)

{% hint style="info" %}
Slash commands can take a while to appear.

Don't have your bot in your server yet? Check [this guide.](../../extras/adding-your-bot-to-your-server.md)
{% endhint %}

### Next steps

* [Running as a service for autostart](running-as-a-service.md)
