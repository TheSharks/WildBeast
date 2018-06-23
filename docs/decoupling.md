title: Decoupling WildBeast from Docker
description: Instructions on running WildBeast from source instead of from Docker
path: tree/master/docs
source: decoupling.md

This document outlines the procedure for decoupling WildBeast from Docker and running it from source instead, enabling custom commands and other modifications to the behaviour of it.

## Preface

If you have already set up your WildBeast instance in accordance with the available installation guides, feel free to jump to the next section. If you have not done this yet, however, please follow through with that procedure before embarking onto this guide. Most of the steps assume knowledge of what has been done previously, and as such it is highly recommended to follow proper procedure first.

Additionally, be sure to shutdown all existing Docker containers pertaining to WildBeast before proceeding.

## Reconfiguring containers and WildBeast

!!! warning "Port conflicts"
    If you have other services running on ports **8529** or **2333**, select different ports for the sections below. You may encounter errors or conflicts otherwise. However, **do not modify the Docker port** in contradiction to the guide, or you will have trouble reaching the containers in the desired manner.

First, open the **.env** configuration file in the directory to which you installed the WildBeast source code, and tweak these values as follows:

```bash
LAVA_NODES=[{"host":"localhost","port":2333,"region":"us","password":"password"}]
ARANGO_URI=http://localhost:8529
```

### Windows

Open Kitematic and browse to the settings of the **wildbeast_arango_1** container and go to the **Hostname / Ports** tab. Under **Configure Ports**, change the default value to look as follows.

![Arango container settings](img/arango-container-settings.png)

Then hit Save. The container will now self-start. Proceed to the **Hostname / Ports** tab of the **wildbeast_lavalink_1** container and edit the same values as previously as follows.
  
![Lavalink container settings](img/lava-container-settings.png)

And then hit Save as mentioned previously, which will self-start the container.

You may also remove the **wildbeast_install_1** and **wildbeast_wildbeast_1** containers if you do not need them anymore. In future WildBeast will run from the source code as opposed to these images, which makes them redundant.

### Linux

!!! danger "Risk of data loss"
    Due to how Docker works on Linux, the containers created in the installation need to be removed and recreated before their networking can be altered. If you have substantial amounts of data in your database, consult relevant documentation on how to migrate your data - for instance [this article](https://medium.com/@gchudnov/copying-data-between-docker-containers-26890935da3f).

For this section, you need to browse to the WildBeast source code directory.

Before you run the following commands, make sure that all WildBeast-related containers have been turned off. This can be checked by running `#!bash sudo docker ps`, and if the output contains no WildBeast-related containers, you're ready to go. Otherwise shut them down and then proceed.

```bash
sudo docker rm wildbeast_arango_1
sudo docker rm wildbeast_lavalink_1
# Check that the ArangoDB version is the correct one via 'docker images'
sudo docker run -d --env-file arangodb.env --name wildbeast_arango_1 -p 8529:8529 arangodb:3.3.10
sudo docker run -d --env-file lavalink.env --name wildbeast_lavalink_1 -p 2333:80 fredboat/lavalink:v2
```

## Installing dependencies and starting

If you haven't already, browse to the WildBeast source code directory. Run `#!bash npm i` to install the dependencies required to run from source. If you have not yet initialised the database, do so by running `#!bash npm run dbcreate` after the dependency installation command finishes.

When the previous step has finished, run `npm start` in the terminal. If the output of that command resembles the following, you're finished.

![Source startup](img/source-startup.png)

!!! danger "Security considerations"
    With these steps, the ArangoDB and Lavalink instances are exposed to the local network. They are not exposed to the internet, which increases safety somewhat, but you should still take steps to secure at least your ArangoDB instance against unauthorised access. This can be accomplished by creating a non-root user in the ArangoDB web interface and enabling authentication for the database engine. Refer to relevant documentation on how to do this.

Now you can start making modifications to the code and adding custom commands which will be useable to your end users.

Do bear in mind that the application process is not backgrounded unlike with Docker, so you may want to look into a process manager/orchestrator like [PM2](https://pm2.keymetrics.io) to keep the process running even if you close your terminal session.
